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


import {prepareReadinessRule,prepareReadinessReview,decideReadiness,setReadinessOptIn,prepareReadinessPassport,holdReadiness,readProductionReadiness,readinessContract} from '../app/lib/production-readiness.ts';
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

test('no implied policy, no self approval or evidence fabrication, and opt-in belongs to officer',async()=>{
 const x=await base();
 await assert.rejects(prepareReadinessReview(x.db,assessor,{officerId:x.officerId,officerReviewId:x.bridgeId,ruleId:'missing-policy',evidence:[],sourcesActuallyInspected:true}),/policy/);
 await assert.rejects(prepareReadinessRule(x.db,applicant,{}),/Operations/);
 const r=await prepareReadinessRule(x.db,assessor,{code:'core_ready',label:'Fixture',category:'core',requirements:['check'],maxDays:1,evidenceReference:'isolated policy',expiresAt:new Date(Date.now()+86400000).toISOString()});
 await assert.rejects(decision(x.db,'rule',r.id,{...assessor,owner:true}),/Independent/);
 await assert.rejects(setReadinessOptIn(x.db,assessor,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:0,optedIn:true}),/Only the officer/);
 await assert.rejects(setReadinessOptIn(x.db,applicant,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:0,optedIn:true}),/qualification/);x.db.sql.close();
});

test('current reviewed sources produce scoped passport, private token and existing activation projections',async()=>{
 const x=await complete();const p=await prepareReadinessPassport(x.db,assessor,x.passportInput);
 assert.equal((await readProductionReadiness(x.db,applicant,x.officerId)).passport,null);
 assert.equal(await readPublicPassport(x.db,p.token),null);
 await decision(x.db,'passport',p.id);
 const status=await readProductionReadiness(x.db,applicant,x.officerId);assert.equal(status.passport.id,p.id);assert.equal(status.workEligible,false);assert.ok(!JSON.stringify(status).includes('private:'));
 const publicStatus=await readPublicPassport(x.db,p.token);assert.equal(publicStatus.synthetic,false);assert.equal(publicStatus.result,'green');assert.equal(publicStatus.productionAuthorized,false);
 const proof=await readinessContract(x.db,x.officerId,new Date(Date.now()+60000).toISOString(),'Unarmed','commercial_access');assert.equal(proof.contract,'lokd.production-readiness.v1');assert.equal(proof.workEligible,false);assert.ok(!('token_hash' in proof));
 assert.equal(await readinessContract(x.db,x.officerId,new Date(Date.now()+60000).toISOString(),'Armed','commercial_access'),null);
 assert.equal(await readinessContract(x.db,x.officerId,new Date(Date.now()+2*86400000).toISOString(),'Unarmed','commercial_access'),null);
 const svc=x.db.sql.prepare('SELECT * FROM officer_services WHERE officer_id=?').get(x.officerId);assert.equal(svc.qualified,1);assert.equal(svc.opted_in,1);
 assert.equal(x.db.sql.prepare("SELECT count(*) AS n FROM officer_endorsements WHERE officer_id=? AND environment='production' AND integrity_state='verified'").get(x.officerId).n,3);
 await assert.rejects(readProductionReadiness(x.db,{...applicant,userId:'other'},x.officerId),/not found/);
 for(const table of ['rules','reviews','decisions','optins','passports'])assert.throws(()=>x.db.sql.exec('DELETE FROM production_readiness_'+table),/immutable/);x.db.sql.close();
});

test('wrong-person, incomplete, duplicated and expired assessment evidence cannot create readiness',async()=>{
 const x=await base(),q=await qualify(x,'core','');
 for(const evidence of [[],[...q.input.evidence,...q.input.evidence],q.input.evidence.map(e=>({...e,ownerUserId:'other'})),q.input.evidence.map(e=>({...e,sha256:'fake'})),q.input.evidence.map(e=>({...e,checkedAt:'2000-01-01T00:00:00Z'})),q.input.evidence.map(e=>({...e,expiresAt:'2000-01-01T00:00:00Z'}))])await assert.rejects(prepareReadinessReview(x.db,assessor,{...q.input,evidence}),/evidence|Evidence/);
 const r=await prepareReadinessReview(x.db,assessor,q.input);
 await assert.rejects(decision(x.db,'review',r.id,{...assessor,owner:true}),/Independent/);
 await assert.rejects(decision(x.db,'review',r.id,checker),/Independent/); // ID-02 approver cannot approve their own prerequisite.
 x.db.sql.close();
});

test('old tokens and old assessment approvals cannot replace later independently approved versions',async()=>{
 const x=await complete();const first=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',first.id);
 const second=await prepareReadinessPassport(x.db,assessor,{...x.passportInput,expectedSequence:1});
 await assert.rejects(decision(x.db,'passport',second.id,{...assessor,owner:true}),/Independent/);
 await decision(x.db,'passport',second.id);
 assert.equal(await readPublicPassport(x.db,first.token),null);assert.equal((await readPublicPassport(x.db,second.token)).result,'green');
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_readiness_passports').get().n,2);
 const old=await prepareReadinessReview(x.db,assessor,x.core.input),newer=await prepareReadinessReview(x.db,assessor,x.core.input);await decision(x.db,'review',newer.id);
 await assert.rejects(decision(x.db,'review',old.id),/changed/);
 assert.equal((await readPublicPassport(x.db,second.token)).result,'red');x.db.sql.close();
});

test('opt-out, identity/PSiRA change, policy hold and readiness suspension invalidate without rewriting history',async()=>{
 for(const change of ['optout','identity','psira','policy','review']){
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 const immutable=x.db.sql.prepare('SELECT * FROM production_readiness_reviews').all(),epoch=x.db.sql.prepare('SELECT revision FROM activation_evidence_epoch').get().revision;
 if(change==='optout')await setReadinessOptIn(x.db,applicant,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:1,optedIn:false});
 if(change==='identity')await suspend(x.db,reviewer,x.identity.id,'Fixture identity withdrawal');
 if(change==='psira')await writePsiraCase(x.db,applicant,{action:'recheck',caseId:x.psiraId,expectedVersion:2});
 if(change==='policy'||change==='review')await holdReadiness(x.db,assessor,{kind:change==='policy'?'rule':'review',id:change==='policy'?x.core.rule.id:x.core.review.id,disposition:'suspend',reason:'Source needs a new independent review'});
 assert.equal((await readProductionReadiness(x.db,applicant,x.officerId)).passport,null);
 assert.equal((await readPublicPassport(x.db,p.token)).result,'red');assert.deepEqual(x.db.sql.prepare('SELECT * FROM production_readiness_reviews').all(),immutable);
 assert.ok(x.db.sql.prepare('SELECT revision FROM activation_evidence_epoch').get().revision>epoch);
 if(change==='optout'){await setReadinessOptIn(x.db,applicant,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:2,optedIn:true});assert.equal((await readPublicPassport(x.db,p.token)).result,'red');}
 x.db.sql.close();
 }
});

test('revoked passport cannot be renewed and direct projection edits cannot revive or extend evidence',async()=>{
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 assert.throws(()=>x.db.sql.prepare("UPDATE officer_passports SET next_review_at='2099-01-01' WHERE officer_id=?").run(x.officerId),/Exact approved/);
 assert.throws(()=>x.db.sql.prepare("UPDATE officer_endorsements SET expires_at='2099-01-01' WHERE officer_id=?").run(x.officerId),/Exact approved/);
 await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'revoke',reason:'Revoked fixture credential'});
 const pub=await readPublicPassport(x.db,p.token);assert.equal(pub.result,'red');assert.equal(pub.status,'revoked');
 await assert.rejects(prepareReadinessPassport(x.db,assessor,{...x.passportInput,expectedSequence:1}),/Held/);
 assert.throws(()=>x.db.sql.prepare("UPDATE officer_passports SET status='active' WHERE officer_id=?").run(x.officerId),/Exact approved/);x.db.sql.close();
});

test('concurrent passport preparation and decisions claim once; source race fails at commit',async()=>{
 const x=await complete();const outcomes=await Promise.allSettled([prepareReadinessPassport(x.db,assessor,x.passportInput),prepareReadinessPassport(x.db,assessor,x.passportInput)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);const p=outcomes.find(r=>r.status==='fulfilled').value;
 const results=await Promise.allSettled([decision(x.db,'passport',p.id),decision(x.db,'passport',p.id)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const next=await prepareReadinessPassport(x.db,assessor,{...x.passportInput,expectedSequence:1});
 await setReadinessOptIn(x.db,applicant,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:1,optedIn:false});
 await assert.rejects(decision(x.db,'passport',next.id),/changed/);
 assert.equal(x.db.sql.prepare("SELECT count(*) AS n FROM production_readiness_decisions WHERE kind='passport'").get().n,1);x.db.sql.close();
});

test('sandbox passport and endorsements cannot be converted by production issuance',async()=>{
 for(const kind of ['passport','endorsement']){
 const x=await base();
 if(kind==='endorsement'){
  x.db.sql.prepare("INSERT INTO officer_endorsements(id,officer_id,code,label,category,status,environment,integrity_state) VALUES('sandbox',?,'core_ready','Synthetic','core','current','demo','synthetic')").run(x.officerId);
  await assert.rejects(qualify(x,'core',''),/cannot be promoted/);
  assert.equal(x.db.sql.prepare("SELECT environment FROM officer_endorsements WHERE id='sandbox'").get().environment,'demo');
 }else{
  x.core=await qualify(x,'core','');x.service=await qualify(x,'service','Unarmed');x.purpose=await qualify(x,'purpose','commercial_access');
  await setReadinessOptIn(x.db,applicant,{officerId:x.officerId,serviceType:'Unarmed',expectedRevision:0,optedIn:true});
  x.db.sql.prepare("INSERT INTO officer_passports(officer_id,passport_number,public_token_hash,environment,integrity_state) VALUES(?,'synthetic-passport','synthetic-hash','demo','synthetic')").run(x.officerId);
  await assert.rejects(prepareReadinessPassport(x.db,assessor,{officerId:x.officerId,officerReviewId:x.bridgeId,reviewIds:[x.core.review.id,x.service.review.id,x.purpose.review.id],expectedSequence:0}),/cannot be promoted/);
 }x.db.sql.close();
 }
});

test('policy replacement, withdrawal and late decisions never revive old versions',async()=>{
 const x=await complete();const p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 const updated=await prepareReadinessRule(x.db,assessor,{code:'core_ready',label:'Replacement fixture policy',category:'core',requirements:['replacement assessment'],maxDays:1,evidenceReference:'isolated replacement policy',expiresAt:new Date(Date.now()+86400000).toISOString()});
 await decision(x.db,'rule',updated.id);assert.equal((await readPublicPassport(x.db,p.token)).result,'red');
 await holdReadiness(x.db,assessor,{kind:'rule',id:updated.id,disposition:'suspend',reason:'Replacement policy withdrawn'});
 assert.equal(x.db.sql.prepare("SELECT count(*) AS n FROM current_production_readiness_rules WHERE code='core_ready'").get().n,0);
 await assert.rejects(prepareReadinessReview(x.db,assessor,x.core.input),/policy/);x.db.sql.close();
});


test('same-day evidence expiry immediately invalidates public passport and deadline contract',async()=>{
 const x=await complete();const soon=new Date(Date.now()+3000).toISOString();
 const core=await prepareReadinessReview(x.db,assessor,{...x.core.input,evidence:x.core.input.evidence.map(e=>({...e,expiresAt:soon}))});await decision(x.db,'review',core.id);
 const p=await prepareReadinessPassport(x.db,assessor,{...x.passportInput,reviewIds:[core.id,x.service.review.id,x.purpose.review.id]});await decision(x.db,'passport',p.id);
 assert.equal((await readPublicPassport(x.db,p.token)).result,'green');
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(soon)-Date.now()+20)));
 assert.equal((await readPublicPassport(x.db,p.token)).result,'red');assert.equal((await readProductionReadiness(x.db,applicant,x.officerId)).passport,null);
 assert.equal(await readinessContract(x.db,x.officerId,new Date(Date.now()+60000).toISOString(),'Unarmed','commercial_access'),null);x.db.sql.close();
});


test('passport suspension cannot be bypassed by issuing a new sequence',async()=>{
 const x=await complete(),p=await prepareReadinessPassport(x.db,assessor,x.passportInput);await decision(x.db,'passport',p.id);
 await holdReadiness(x.db,assessor,{kind:'passport',id:p.id,disposition:'suspend',reason:'Hold pending independent source investigation'});
 await assert.rejects(prepareReadinessPassport(x.db,assessor,{...x.passportInput,expectedSequence:1}),/Held/);
 assert.equal((await readPublicPassport(x.db,p.token)).result,'red');assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_readiness_passports').get().n,1);x.db.sql.close();
});
