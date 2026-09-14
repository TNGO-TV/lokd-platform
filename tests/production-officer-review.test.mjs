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
import {prepareOfficerReview,decideOfficerReview,readOfficerReviews,suspendOfficerApproval} from '../app/lib/production-officer-review.ts';
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
function noProjection(db,id){assert.equal(db.sql.prepare('SELECT count(*) AS n FROM compliance_records WHERE officer_id=?').get(id).n,0);assert.notEqual(db.sql.prepare('SELECT approval_status FROM officers WHERE id=?').get(id).approval_status,'approved');}

test('current owner-bound identity and PSiRA produce only independently approved officer/compliance records',async()=>{
 const {db,proposal}=await ready();const r=await prepareOfficerReview(db,maker,proposal);noProjection(db,proposal.officerId);
 const result=await decideBridge(db,r.reviewId);assert.equal(result.workEligible,false);
 const officer=db.sql.prepare('SELECT * FROM officers WHERE id=?').get(proposal.officerId);assert.equal(officer.approval_status,'approved');assert.equal(officer.psira_expiry,'2099-01-01');assert.equal(officer.banking_status,'unverified');
 const compliance=db.sql.prepare('SELECT * FROM compliance_records WHERE officer_id=?').all(proposal.officerId);assert.equal(compliance.length,2);
 assert.deepEqual(compliance.map(c=>c.record_type).sort(),['identity','psira']);assert.ok(compliance.every(c=>c.environment==='production'&&c.integrity_state==='verified'&&c.expires_at===r.expiresAt&&c.evidence_reference==='officer-review:'+r.reviewId));
 assert.equal(db.sql.prepare('SELECT count(*) AS n FROM officer_passports WHERE officer_id=?').get(officer.id).n,0);
 assert.equal(db.sql.prepare('SELECT count(*) AS n FROM officer_endorsements WHERE officer_id=?').get(officer.id).n,0);
 assert.equal((await readOfficerReviews(db,applicant,officer.id)).reviews[0].current,1);
 for(const table of ['production_officer_reviews','production_officer_decisions'])assert.throws(()=>db.sql.exec('DELETE FROM '+table),/immutable/);
 db.sql.close();
});

test('authorization and maker separation include applicant, entity preparer, identity and PSiRA reviewer',async()=>{
 const {db,proposal}=await ready();
 await assert.rejects(prepareOfficerReview(db,applicant,proposal),/Operations/);
 await assert.rejects(prepareOfficerReview(db,{...applicant,operations:true},proposal),/Another/);
 const r=await prepareOfficerReview(db,maker,proposal);
 for(const actor of [maker,{...maker,owner:true},{...applicant,operations:true,owner:true},{...reviewer,owner:true},{...checker,email:reviewer.email}])await assert.rejects(decideBridge(db,r.reviewId,actor),/owner|separate/);
 await assert.rejects(readOfficerReviews(db,{...applicant,userId:'other'},proposal.officerId),/not found/);
 noProjection(db,proposal.officerId);db.sql.close();
});

test('identity suspension and PSiRA recheck between preparation and decision reject stale evidence',async()=>{
 for(const kind of ['identity','psira','intake','details']){
 const {db,proposal,identity,psiraId,caseId}=await ready();const r=await prepareOfficerReview(db,maker,proposal);
 if(kind==='identity')await suspend(db,reviewer,identity.id,'Source withdrawn for isolated fixture');
 if(kind==='psira')await writePsiraCase(db,applicant,{action:'recheck',caseId:psiraId,expectedVersion:2});
 if(kind==='intake')await writeSignup(db,applicant,{action:'correct',kind:'officer',id:caseId,expectedVersion:2,changes:{city:'Sandton'}});
 if(kind==='details')db.sql.prepare('UPDATE officers SET full_name=? WHERE id=?').run('Another Person',proposal.officerId);
 await assert.rejects(decideBridge(db,r.reviewId),/required|changed/);noProjection(db,proposal.officerId);db.sql.close();
 }
});

test('wrong-owner PSiRA, unmatched name/grade and generic identity evidence cannot prepare a bridge',async()=>{
 for(const change of [{identityEvidence:'generic review'},{returnedName:'Another Person'},{grade:'B'}]){
 const {db,proposal,psiraReview}=await ready();await writePsiraCase(db,reviewer,{...psiraReview,expectedVersion:2,evidence:{...psiraReview.evidence,...change}});
 await assert.rejects(prepareOfficerReview(db,maker,proposal),/required/);noProjection(db,proposal.officerId);db.sql.close();
 }
 const {db,proposal,psiraId}=await ready();
 // Fault injection at storage boundary: same email/number is insufficient without owner ID.
 db.sql.prepare('UPDATE psira_verification_cases SET owner_user_id=? WHERE id=?').run('wrong-owner',psiraId);
 await assert.rejects(prepareOfficerReview(db,maker,proposal),/required/);db.sql.close();
});

test('source invalidation suspends approved officer, preserves consumed evidence and advances activation epoch',async()=>{
 for(const kind of ['identity','psira','intake','details','suspend']){
 const {db,proposal,identity,psiraId,caseId}=await ready();const r=await prepareOfficerReview(db,maker,proposal);await decideBridge(db,r.reviewId);
 const old=db.sql.prepare('SELECT * FROM compliance_records WHERE officer_id=?').all(proposal.officerId),epoch=db.sql.prepare('SELECT revision FROM activation_evidence_epoch').get().revision;
 if(kind==='identity')await suspend(db,reviewer,identity.id,'Fixture source withdrawn');
 if(kind==='psira')await writePsiraCase(db,applicant,{action:'recheck',caseId:psiraId,expectedVersion:2});
 if(kind==='intake')await writeSignup(db,applicant,{action:'withdraw',kind:'officer',id:caseId,expectedVersion:2});
 if(kind==='details')db.sql.prepare('UPDATE officers SET city=? WHERE id=?').run('Sandton',proposal.officerId);
 if(kind==='suspend')await suspendOfficerApproval(db,maker,proposal.officerId,'Fixture operational suspension');
 assert.equal(db.sql.prepare('SELECT approval_status FROM officers WHERE id=?').get(proposal.officerId).approval_status,'suspended');
 assert.deepEqual(db.sql.prepare('SELECT * FROM compliance_records WHERE officer_id=?').all(proposal.officerId),old);
 assert.equal((await readOfficerReviews(db,applicant,proposal.officerId)).reviews[0].current,0);
 assert.ok(db.sql.prepare('SELECT revision FROM activation_evidence_epoch').get().revision>epoch);db.sql.close();
 }
});

test('concurrent decisions project once; rejection never creates compliance and direct approval bypass fails',async()=>{
 const {db,proposal}=await ready();
 assert.throws(()=>db.sql.prepare("UPDATE officers SET approval_status='approved' WHERE id=?").run(proposal.officerId),/Independent/);
 const r=await prepareOfficerReview(db,maker,proposal);
 const outcomes=await Promise.allSettled([decideBridge(db,r.reviewId),decideBridge(db,r.reviewId)]);
 assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(db.sql.prepare('SELECT count(*) AS n FROM compliance_records WHERE officer_id=?').get(proposal.officerId).n,2);db.sql.close();
 const other=await ready();const rejection=await prepareOfficerReview(other.db,maker,other.proposal);await decideBridge(other.db,rejection.reviewId,checker,'reject');noProjection(other.db,other.proposal.officerId);other.db.sql.close();
});

test('commit-time race rejects the decision after its application-level source read',async()=>{
 const {db,proposal,psiraId}=await ready();const r=await prepareOfficerReview(db,maker,proposal);
 const original=db.prepare.bind(db);
 db.prepare=sql=>{const stmt=original(sql);if(!sql.startsWith('INSERT INTO production_officer_decisions'))return stmt;return {bind(...values){const bound=stmt.bind(...values);return {async run(){db.prepare=original;await writePsiraCase(db,applicant,{action:'recheck',caseId:psiraId,expectedVersion:2});return bound.run();}};}};};
 await assert.rejects(decideBridge(db,r.reviewId),/changed or expired/);noProjection(db,proposal.officerId);
 assert.equal(db.sql.prepare('SELECT count(*) AS n FROM production_officer_decisions').get().n,0);db.sql.close();
});


test('expired certificate cannot prepare; evidence expiry bounds approval and assignment deadline',async()=>{
 const {db,proposal,psiraReview}=await ready();
 const r=await prepareOfficerReview(db,maker,proposal);await decideBridge(db,r.reviewId);
 assert.equal(db.sql.prepare('SELECT count(*) AS n FROM current_production_officer_approvals WHERE officer_id=? AND julianday(expires_at)>=julianday(?)').get(proposal.officerId,new Date(Date.now()+2*86400000).toISOString()).n,0);
 assert.throws(()=>db.sql.prepare("UPDATE compliance_records SET expires_at='2099-01-01' WHERE officer_id=?").run(proposal.officerId),/immutable/);
 assert.throws(()=>db.sql.prepare('DELETE FROM compliance_records WHERE officer_id=?').run(proposal.officerId),/immutable/);
 await writePsiraCase(db,reviewer,{...psiraReview,expectedVersion:2,evidence:{...psiraReview.evidence,certificateExpiry:'2000-01-01'}});
 await assert.rejects(prepareOfficerReview(db,maker,proposal),/required/);
 assert.equal(db.sql.prepare('SELECT count(*) AS n FROM current_production_officer_approvals').get().n,0);
 // Compile the installed commit guards against the complete migrated schema.
 db.sql.prepare("EXPLAIN UPDATE assignment_activation_commands SET state='activated' WHERE id=?").all('fixture');
 db.sql.prepare("EXPLAIN UPDATE shifts SET status='on_post' WHERE id=?").all('fixture');
 db.sql.close();
});
