import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {POST as apply} from '../app/api/applications/route.ts';
import {writeSignup} from '../app/lib/signup-server.ts';
import {startProductionIdentity as start, decideProductionIdentity as decide, suspendProductionIdentity as suspend} from '../app/lib/production-identity.ts';
import {prepareProductionEntity} from '../app/lib/production-intake.ts';
import {writePsiraCase} from '../app/lib/psira-server.ts';
import {PSIRA_SOURCE} from '../app/lib/psira-verification.ts';
import {prepareOfficerReview,decideOfficerReview} from '../app/lib/production-officer-review.ts';
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync(`drizzle/${f}`,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const database=this.sql;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
async function setup(pathway='qualified',psiraStatus='active'){
 const db=new D1();env.DB=db;
 const response=await apply(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify({pathway,fullName:'Synthetic Officer',mobile:'0821234567',email:'identity@example.test',city:'Johannesburg',province:'Gauteng',psiraStatus,psiraNumber:psiraStatus==='active'?'1234567':'',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:pathway==='training'?['Entry-level security training']:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true})}));assert.equal(response.status,202);const caseId=(await response.json()).reference;
 await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'link',kind:'officer',id:caseId,expectedVersion:0});return {db,caseId,runtime:{DB:db,VERIFYNOW_API_KEY:undefined,VERIFYNOW_SANDBOX_ENABLED:'true'}};
}

const applicant={userId:'user_identity',email:'identity@example.test',operations:false};
const reviewer={userId:'independent_reviewer',email:'review@example.test',operations:true};
function fixture(){
 let submits=0,lookups=0;
 const result=b=>({...b,environment:'production',provider:'fixture-only',outcome:'verified',providerReference:'private-result',evidenceReference:'private-evidence',evidenceHash:'b'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()});
 const port={key:'fixture-only',capture:async()=>({environment:'production',bindingHash:'a'.repeat(64)}),submit:async b=>{submits++;return result(b);},lookup:async b=>{lookups++;return result(b);}};
 return {port,result,counts:()=>({submits,lookups})};
}
const input=caseId=>({applicantId:caseId,applicantVersion:1,captureReference:'private-capture-fixture',consentVersion:'fixture-consent'});
const approve=(db,s,actor=reviewer)=>decide(db,actor,{id:s.id,outcomeId:s.outcomeId,decision:'approve',reason:'Independently inspected fixture evidence',independentlyChecked:true});


const maker={userId:'bridge-maker',email:'maker@example.test',operations:true,owner:false};
const checker={userId:'bridge-checker',email:'checker@example.test',operations:true,owner:true};
async function ready(){
 const {db,caseId}=await setup();const f=fixture();
 await writeSignup(db,maker,{action:'review',kind:'officer',id:caseId,expectedVersion:1,status:'reviewed',note:'Synthetic intake review for isolated fixture'});
 let identity=await start(db,applicant,{...input(caseId),applicantVersion:2},f.port);identity=await approve(db,identity);
 const entity=await prepareProductionEntity(db,maker,{kind:'officer',caseId,caseVersion:2});
 const psiraId=await writePsiraCase(db,applicant,{action:'submit',declaration:'registered',psiraNumber:'1234567'});
 const psiraReview={action:'review',caseId:psiraId,expectedVersion:1,registrationStatus:'registered',identityMatch:'confirmed',recheckAt:new Date(Date.now()+86400000).toISOString(),evidence:{source:PSIRA_SOURCE,checkedAt:new Date().toISOString(),returnedNumber:'1234567',returnedName:'Synthetic Officer',returnedStatus:'Registered',grade:'A',certificateExpiry:'2099-01-01',employmentStatus:'Inactive',excerpt:'Isolated synthetic fixture only; no real registration assertion.',identityEvidence:'production-identity:'+identity.outcomeId}};
 await writePsiraCase(db,reviewer,psiraReview);
 const psiraEvent=db.sql.prepare('SELECT latest_event_id FROM psira_verification_cases WHERE id=?').get(psiraId).latest_event_id;
 const proposal={officerId:entity.entityId,applicantVersion:2,identityOutcomeId:identity.outcomeId,psiraEventId:psiraEvent,reason:'Synthetic independent identity and registration inspection'};
 return {db,caseId,f,identity,psiraId,psiraReview,proposal};
}
const decideBridge=(db,id,actor=checker,decision='approve')=>decideOfficerReview(db,actor,{reviewId:id,decision,independentlyChecked:true,reason:'Independent inspection of exact fixture evidence'});


import {prepareReadinessRule,prepareReadinessReview,decideReadiness,setReadinessOptIn,prepareReadinessPassport,holdReadiness} from '../app/lib/production-readiness.ts';
import {readPublicPassport} from '../app/lib/passport-server.ts';
const assessor={userId:'readiness-assessor',email:'assessor@example.test',operations:true,owner:false};
const independent={userId:'readiness-checker',email:'ready-checker@example.test',operations:true,owner:true};
const decision=(db,kind,id,actor=independent)=>decideReadiness(db,actor,{kind,id,decision:'approve',independentlyInspected:true,reason:'Independently inspected isolated policy or applicant fixture'});
async function base(){const x=await ready();const bridge=await prepareOfficerReview(x.db,maker,x.proposal);await decideBridge(x.db,bridge.reviewId);return {...x,officerId:x.proposal.officerId,bridgeId:bridge.reviewId};}
async function qualify(x,category,scope){
 const rule=await prepareReadinessRule(x.db,assessor,{code:category==='core'?'core_ready':category+'_'+scope.toLowerCase(),label:'Isolated '+category+' fixture',category,serviceType:category==='service'?scope:undefined,purposeCode:category==='purpose'?scope:undefined,requirements:['fixture assessment'],maxDays:7,evidenceReference:'private:isolated-policy-not-real',expiresAt:new Date(Date.now()+2*86400000).toISOString()});
 await decision(x.db,'rule',rule.id);
 const evidence=[{requirement:'fixture assessment',ownerUserId:applicant.userId,reference:'private:isolated-assessment-not-real',sha256:'c'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}];
 const input={officerId:x.officerId,officerReviewId:x.bridgeId,ruleId:rule.id,evidence,sourcesActuallyInspected:true};
 const review=await prepareReadinessReview(x.db,assessor,input);await decision(x.db,'review',review.id);return {rule,review,input};
}
async function complete(){const x=await base();x.core=await qualify(x,'core','');x.service=await qualify(x,'service','Unarmed');x.purpose=await qualify(x,'purpose','commercial_access');await setReadinessOptIn(x.db,applicant,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:0,optedIn:true});x.passportInput={officerId:x.officerId,officerReviewId:x.bridgeId,reviewIds:[x.core.review.id,x.service.review.id,x.purpose.review.id],expectedSequence:0};return x;}


import {requestOfficerRereview,prepareRereviewDisposition,decideRereviewDisposition,readRereviewStatus,suspendOfficerWorkforce} from '../app/lib/production-rereview.ts';
import {manageProductionEvidence} from '../app/lib/production-evidence.ts';
const investigator={userId:'investigator',email:'investigator@example.test',operations:true,owner:false};
const dispositionOwner={userId:'disposition-owner',email:'disposition@example.test',operations:true,owner:true};
async function permit(x,kind,holdId){
 const version=x.db.sql.prepare("SELECT version FROM signup_cases WHERE kind='officer' AND source_id=?").get(x.caseId).version;
 const p=await prepareRereviewDisposition(x.db,investigator,{kind,holdId,applicantVersion:version,evidenceReference:'private:actual-investigation-fixture',evidenceHash:'d'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),actuallyInvestigated:true});
 await decideRereviewDisposition(x.db,dispositionOwner,{proposalId:p.id,decision:'allow_replacement',independentlyInvestigated:true,reason:'Independently investigated fixture; only fresh replacement permitted'});return p;
}
async function freshAssessments(x){
 const ids=[];
 for(const q of [x.core,x.service,x.purpose]){const r=await prepareReadinessReview(x.db,assessor,{...q.input,evidence:q.input.evidence.map(e=>({...e,checkedAt:new Date().toISOString()}))});await decision(x.db,'review',r.id);ids.push(r.id);}return ids;
}

test('passport disposition never revives old token; fresh assessments and independent issuance are required',async()=>{
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'revoke',reason:'Fixture identity concern investigated'});
 const h=x.db.sql.prepare("SELECT id FROM production_readiness_holds WHERE kind='passport'").get().id;
 await assert.rejects(prepareReadinessPassport(x.db,assessor,{...x.passportInput,expectedSequence:1}),/Held/);
 await permit(x,'passport',h);assert.equal((await readPublicPassport(x.db,p.token)).result,'red');
 const stale=await prepareReadinessPassport(x.db,assessor,{...x.passportInput,expectedSequence:1});await assert.rejects(decision(x.db,'passport',stale.id),/changed/);
 const reviewIds=await freshAssessments(x),fresh=await prepareReadinessPassport(x.db,assessor,{...x.passportInput,reviewIds,expectedSequence:2});await decision(x.db,'passport',fresh.id);
 assert.equal(await readPublicPassport(x.db,p.token),null);assert.equal((await readPublicPassport(x.db,fresh.token)).result,'green');
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_readiness_holds').get().n,1);x.db.sql.close();
});

async function proposalFor(x,kind,holdId){return prepareRereviewDisposition(x.db,investigator,{kind,holdId,applicantVersion:x.db.sql.prepare("SELECT version FROM signup_cases WHERE kind='officer' AND source_id=?").get(x.caseId).version,evidenceReference:'private:isolated-investigation',evidenceHash:'d'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),actuallyInvestigated:true});}
const allow=(db,id,actor=dispositionOwner)=>decideRereviewDisposition(db,actor,{proposalId:id,decision:'allow_replacement',independentlyInvestigated:true,reason:'Independent fixture investigation; fresh review only'});

test('disposition enforces access, independence, immutable history and one concurrent approval',async()=>{
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'suspend',reason:'Fixture hold'});
 const h=x.db.sql.prepare("SELECT id FROM production_readiness_holds WHERE kind='passport'").get().id,proposal=await proposalFor(x,'passport',h);
 await assert.rejects(allow(x.db,proposal.id,applicant),/Operations/);await assert.rejects(allow(x.db,proposal.id,{...investigator,owner:true}),/Independent/);await assert.rejects(allow(x.db,proposal.id,{...assessor,owner:true}),/Independent/);
 await assert.rejects(readRereviewStatus(x.db,{...applicant,userId:'other'},x.caseId),/not found/);
 const decisions=await Promise.allSettled([allow(x.db,proposal.id),allow(x.db,proposal.id)]);assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);
 const status=await readRereviewStatus(x.db,applicant,x.caseId);assert.equal(status.restoresApproval,false);assert.ok(!JSON.stringify(status).includes('private:'));
 for(const table of ['proposals','decisions','cutoffs'])assert.throws(()=>x.db.sql.exec('DELETE FROM production_rereview_'+table),/immutable/);
 assert.equal((await readPublicPassport(x.db,p.token)).result,'red');x.db.sql.close();
});

test('intake changes and a late hold invalidate a prepared disposition at commit',async()=>{
 for(const cause of ['correction','hold']){
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'suspend',reason:'Fixture hold'});
 const h=x.db.sql.prepare("SELECT id FROM production_readiness_holds WHERE kind='passport'").get().id,proposal=await proposalFor(x,'passport',h);
 if(cause==='correction')await writeSignup(x.db,applicant,{action:'correct',kind:'officer',id:x.caseId,expectedVersion:2,changes:{city:'Sandton'}});
 else await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'suspend',reason:'Additional contradictory source'});
 await assert.rejects(allow(x.db,proposal.id),/changed/);assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_rereview_authorizations').get().n,0);x.db.sql.close();
 }
});

test('correction and genuine fresh identity/PSiRA review replace approval without altering prior evidence',async()=>{
 const x=await base();await suspend(x.db,reviewer,x.identity.id,'Identity evidence must be recaptured');
 const {suspendOfficerApproval}=await import('../app/lib/production-officer-review.ts');await suspendOfficerApproval(x.db,maker,x.officerId,'Officer details need investigation');
 const oldIdentity=x.db.sql.prepare('SELECT * FROM production_identity_cases WHERE id=?').get(x.identity.id),oldCompliance=x.db.sql.prepare('SELECT * FROM compliance_records WHERE officer_id=?').all(x.officerId);
 await requestOfficerRereview(x.db,maker,{applicantId:x.caseId,expectedVersion:2,message:'Please confirm corrected details and supply current evidence.'});
 await writeSignup(x.db,applicant,{action:'correct',kind:'officer',id:x.caseId,expectedVersion:3,changes:{city:'Sandton'}});
 await writeSignup(x.db,maker,{action:'review',kind:'officer',id:x.caseId,expectedVersion:4,status:'reviewed',note:'Independently reviewed actual fixture corrections'});
 await prepareProductionEntity(x.db,maker,{kind:'officer',caseId:x.caseId,caseVersion:5});
 const f=fixture();f.port.submit=async b=>({...f.result(b),providerReference:'replacement:'+b.caseId});
 const identityInput={...input(x.caseId),applicantVersion:5,captureReference:'private:new-capture'};
 await assert.rejects(start(x.db,applicant,identityInput,f.port),/disposition/);
 for(const t of x.db.sql.prepare("SELECT kind,hold_id FROM production_rereview_targets WHERE applicant_id=? AND kind IN ('identity','officer')").all(x.caseId))await permit(x,t.kind,t.hold_id);
 let next=await start(x.db,applicant,identityInput,f.port);next=await approve(x.db,next);
 await writePsiraCase(x.db,reviewer,{...x.psiraReview,expectedVersion:2,evidence:{...x.psiraReview.evidence,checkedAt:new Date().toISOString(),identityEvidence:'production-identity:'+next.outcomeId}});
 const event=x.db.sql.prepare('SELECT latest_event_id FROM psira_verification_cases WHERE id=?').get(x.psiraId).latest_event_id;
 const r=await prepareOfficerReview(x.db,maker,{...x.proposal,applicantVersion:5,identityOutcomeId:next.outcomeId,psiraEventId:event});await decideBridge(x.db,r.reviewId);
 assert.equal(x.db.sql.prepare('SELECT approval_status FROM officers WHERE id=?').get(x.officerId).approval_status,'approved');
 assert.deepEqual(x.db.sql.prepare('SELECT * FROM production_identity_cases WHERE id=?').get(x.identity.id),oldIdentity);
 for(const row of oldCompliance)assert.deepEqual(x.db.sql.prepare('SELECT * FROM compliance_records WHERE id=?').get(row.id),row);
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM current_production_identity_evidence WHERE id=?').get(x.identity.id).n,0);x.db.sql.close();
});

async function engagement(x,id){
 const fields={engagementId:id,officerId:x.officerId,employerId:'fixture-employer',model:'direct_flex',termsVersion:'fixture-terms-v1',engagementReference:'private:fixture-employment-evidence',weeklyHourCap:'40',payrollReference:'private:payroll-fixture',benefitsReference:'private:benefits-fixture'};
 const p=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind:'engagement',fields,sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString()});
 await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:p.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independently inspected isolated employment evidence'});return p;
}
async function employer(x){x.db.sql.prepare("INSERT INTO workforce_employers(id,legal_name,employer_type,environment,status,review_due_at) VALUES('fixture-employer','Isolated Employer','lokd_employer','production','current',?)").run(new Date(Date.now()+2*86400000).toISOString());}

test('workforce suspension freezes the old engagement and requires a fresh reviewed replacement',async()=>{
 const x=await complete();await employer(x);const old=await engagement(x,'fixture-engagement');
 const p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 await suspendOfficerWorkforce(x.db,maker,{reviewId:old.reviewId,reason:'Actual employer evidence needs independent review'});
 const frozen=x.db.sql.prepare("SELECT * FROM workforce_engagements WHERE id='fixture-engagement'").get();assert.equal(frozen.status,'suspended');assert.equal(frozen.active_key,null);
 assert.equal((await suspendOfficerWorkforce(x.db,maker,{reviewId:old.reviewId,reason:'Retry after lost response'})).alreadyRecorded,true);
 assert.throws(()=>x.db.sql.exec("UPDATE workforce_engagements SET status='active',active_key=officer_id WHERE id='fixture-engagement'"),/cannot be reactivated/);
 assert.equal((await readPublicPassport(x.db,p.token)).result,'red');
 await assert.rejects(engagement(x,'blocked-engagement'),/disposition/);
 const hold=x.db.sql.prepare('SELECT id FROM production_workforce_holds').get().id;await permit(x,'workforce',hold);
 await engagement(x,'replacement-engagement');
 assert.deepEqual(x.db.sql.prepare("SELECT * FROM workforce_engagements WHERE id='fixture-engagement'").get(),frozen);
 assert.equal(x.db.sql.prepare("SELECT status FROM workforce_engagements WHERE id='replacement-engagement'").get().status,'active');
 assert.equal((await readPublicPassport(x.db,p.token)).result,'red'); // Separate passport disposition is still required.
 x.db.sql.close();
});


test('replacement disposition cannot override uncertain identity delivery or submit twice',async()=>{
 const x=await setup(),f=fixture();let calls=0;f.port.submit=async()=>{calls++;throw Error('Lost provider response');};
 const old=await start(x.db,applicant,input(x.caseId),f.port);assert.equal(old.outcome,'delivery_unknown');
 await suspend(x.db,reviewer,old.id,'Investigate uncertain capture');
 await writeSignup(x.db,applicant,{action:'correct',kind:'officer',id:x.caseId,expectedVersion:1,changes:{city:'Sandton'}});
 await writeSignup(x.db,maker,{action:'review',kind:'officer',id:x.caseId,expectedVersion:2,status:'reviewed',note:'Actual fixture correction inspected'});
 const hold=x.db.sql.prepare('SELECT id FROM production_identity_suspensions').get().id;await permit(x,'identity',hold);
 await assert.rejects(start(x.db,applicant,{...input(x.caseId),applicantVersion:3,captureReference:'private:replacement'},f.port),/unresolved/);
 assert.equal(calls,1);x.db.sql.close();
});

test('assessment disposition rejects old drafts and requires newly checked evidence',async()=>{
 const x=await complete(),draft=await prepareReadinessReview(x.db,assessor,x.core.input);
 await holdReadiness(x.db,assessor,{kind:'review',id:x.core.review.id,disposition:'suspend',reason:'Recheck assessment source'});
 const h=x.db.sql.prepare("SELECT id FROM production_readiness_holds WHERE kind='review'").get().id;await permit(x,'review',h);
 await assert.rejects(decision(x.db,'review',draft.id),/fresh disposition|changed/);
 const fresh=await prepareReadinessReview(x.db,assessor,{...x.core.input,evidence:x.core.input.evidence.map(e=>({...e,checkedAt:new Date().toISOString()}))});await decision(x.db,'review',fresh.id);
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_readiness_holds').get().n,1);x.db.sql.close();
});

test('keep-held disposition grants nothing and expired or wrong-version investigations fail',async()=>{
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'suspend',reason:'Fixture investigation'});
 const h=x.db.sql.prepare("SELECT id FROM production_readiness_holds WHERE kind='passport'").get().id;
 const fields={kind:'passport',holdId:h,applicantVersion:2,evidenceReference:'private:fixture',evidenceHash:'d'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),actuallyInvestigated:true};
 for(const override of [{applicantVersion:1},{expiresAt:'2000-01-01T00:00:00.000Z'},{checkedAt:'2000-01-01T00:00:00.000Z'}])await assert.rejects(prepareRereviewDisposition(x.db,investigator,{...fields,...override}),/current|reviewed|follow/);
 const proposal=await proposalFor(x,'passport',h);await decideRereviewDisposition(x.db,dispositionOwner,{proposalId:proposal.id,decision:'keep_held',independentlyInvestigated:true,reason:'Evidence remains insufficient'});
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_rereview_authorizations').get().n,0);
 await assert.rejects(prepareReadinessPassport(x.db,assessor,{...x.passportInput,expectedSequence:1}),/Held/);x.db.sql.close();
});

test('intake correction and officer suspension preserve and suspend workforce records',async()=>{
 for(const cause of ['intake','officer']){
 const x=await base();await employer(x);await engagement(x,'fixture-engagement');
 if(cause==='intake')await writeSignup(x.db,applicant,{action:'correct',kind:'officer',id:x.caseId,expectedVersion:2,changes:{city:'Sandton'}});
 else {const {suspendOfficerApproval}=await import('../app/lib/production-officer-review.ts');await suspendOfficerApproval(x.db,maker,x.officerId,'Investigate current officer evidence');}
 const w=x.db.sql.prepare("SELECT * FROM workforce_engagements WHERE id='fixture-engagement'").get();assert.equal(w.status,'suspended');assert.equal(w.engagement_reference,'private:fixture-employment-evidence');
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_workforce_holds').get().n,1);x.db.sql.close();
 }
});

test('a new hold racing replacement issuance blocks the independent approval',async()=>{
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'suspend',reason:'First concern'});
 const h=x.db.sql.prepare("SELECT id FROM production_readiness_holds WHERE kind='passport'").get().id;await permit(x,'passport',h);
 const reviewIds=await freshAssessments(x),fresh=await prepareReadinessPassport(x.db,assessor,{...x.passportInput,reviewIds,expectedSequence:1});
 await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'revoke',reason:'New contradictory evidence after preparation'});
 await assert.rejects(decision(x.db,'passport',fresh.id),/changed/);assert.equal(await readPublicPassport(x.db,fresh.token),null);x.db.sql.close();
});

test('investigation expiry is rechecked at the independent decision commit',async()=>{
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'suspend',reason:'Time-bounded investigation'});
 const h=x.db.sql.prepare("SELECT id FROM production_readiness_holds WHERE kind='passport'").get().id;
 const expiry=Date.now()+1000;
 const proposal=await prepareRereviewDisposition(x.db,investigator,{kind:'passport',holdId:h,applicantVersion:2,evidenceReference:'private:fixture',evidenceHash:'d'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(expiry).toISOString(),actuallyInvestigated:true});
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,expiry-Date.now())+30));
 await assert.rejects(allow(x.db,proposal.id),/expired/);assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_rereview_authorizations').get().n,0);x.db.sql.close();
});
