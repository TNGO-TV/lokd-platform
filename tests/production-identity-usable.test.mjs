import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {env} from 'cloudflare:workers';
import {complete,applicant,maker,checker,assessor,independent} from './fixtures/production-identity-journey.mjs';
import {GET,POST} from '../app/api/production-identity/route.ts';
import {POST as verify} from '../app/api/passport/verify/route.ts';
import {tokenHash,readPublicPassport} from '../app/lib/passport-server.ts';
import {manageProductionEvidence} from '../app/lib/production-evidence.ts';
import {holdReadiness,decideReadiness} from '../app/lib/production-readiness.ts';
import {installFixtureClock} from './fixtures/fixture-clock.mjs';
import {createPrivatePassportMaterial} from '../app/lib/production-identity-contract.ts';
const stranger={userId:'unrelated-user',email:'unrelated@example.test',operations:false};
async function setup(t,{migration=true}={}){
 const prior=env.LOKD_PILOT_ACCESS_JSON,priorDb=env.DB;
 const x=await complete(migration?{}:{beforeMigration:'0068'});
 env.LOKD_PILOT_ACCESS_JSON=JSON.stringify({owners:[checker.email,independent.email],operations:[maker.email,assessor.email],clients:{}});
 t.after(()=>{x.db.sql.close();if(prior===undefined)delete env.LOKD_PILOT_ACCESS_JSON;else env.LOKD_PILOT_ACCESS_JSON=prior;if(priorDb===undefined)delete env.DB;else env.DB=priorDb;});return x;
}
function req(a,method,body,query=''){
 const host=a.operations?'ops.lokd.co.za':'officers.lokd.co.za',scope=a.operations?'scope=operations&':'';
 return new Request(`https://${host}/api/production-identity?${scope}${query}`,{method,headers:{origin:`https://${host}`,'content-type':'application/json','x-lokd-verified-user-id':a.userId,'x-lokd-verified-email':a.email,'x-lokd-verified-mfa-enrolled':'true','x-lokd-verified-second-factor-at':new Date().toISOString()},...(method==='POST'?{body:JSON.stringify(body)}:{})});
}
async function post(a,body,status=200){const r=await POST(req(a,'POST',body));const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));assert.equal(r.headers.get('cache-control'),'private, no-store');return b;}
async function get(a,query,status=200){const r=await GET(req(a,'GET',null,query));const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));assert.equal(r.headers.get('cache-control'),'private, no-store');return b;}
async function offer(x){const {token,...material}=await createPrivatePassportMaterial();assert.match(token,/^lokd_live_[a-f0-9]{64}$/);assert.equal(material.tokenHash,await tokenHash(token));const body={action:'request_passport_delivery',officerId:x.officerId,...material};return {token,body,delivery:await post(applicant,body)};}
async function prepare(x,o,sequence=0){return post(assessor,{action:'prepare_passport',...x.passportInput,expectedSequence:sequence,deliveryId:o.delivery.deliveryId});}
async function approve(p){return post(independent,{action:'decide_readiness',kind:'passport',id:p.id,decision:'approve',independentlyInspected:true,reason:'Independent inspection of exact fixture readiness and private delivery'});}

test('owner discovery is private and all reviewer evidence types are inspectable with audit',async t=>{
 const x=await setup(t),own=await get(applicant,'kind=cases');assert.equal(own.cases.length,1);assert.equal((await get(stranger,'kind=cases')).cases.length,0);
 const c=await get(applicant,'kind=case&id='+x.caseId);assert.equal(c.case.officerId,x.officerId);assert.equal(c.identities[0].id,x.identity.id);assert.ok(!JSON.stringify(c).includes('private:'));
 await get(stranger,'kind=case&id='+x.caseId,404);
 await get(applicant,'kind=review_queue&recordType=identity',403);
 for(const [kind,id] of [['identity',x.identity.id],['officer',x.bridgeId],['rule',x.core.rule.id],['review',x.core.review.id]]){
  await get(applicant,`kind=review_detail&recordType=${kind}&id=${id}`,403);
  const detail=await get(checker,`kind=review_detail&recordType=${kind}&id=${id}`);assert.equal(detail.record.id,id);assert.equal(detail.current,true);
  assert.equal(detail.workEligible,false);assert.ok((await get(checker,`kind=review_queue&recordType=${kind}&state=all`)).records.some(r=>r.id===id));
 }
 assert.equal(x.db.sql.prepare("SELECT count(*) AS n FROM audit_events WHERE event_type='identity_review_data_access'").get().n,4);
 await get(checker,'kind=review_queue&recordType=identity&offset=-1',400);
 await get(checker,"kind=review_detail&recordType=sqlite_master&id=anything",400);
});

test('private owner request survives response loss; independent issuance exposes no token to Operations',async t=>{
 const x=await setup(t),o=await offer(x);assert.equal((await post(applicant,o.body)).deliveryId,o.delivery.deliveryId);
 await post(stranger,{...o.body,requestKey:'other'},404);await post(maker,o.body,403);
 await post(applicant,{...o.body,tokenHash:'e'.repeat(64)},409);
 await post(assessor,{action:'prepare_passport',...x.passportInput},400);
 const p=await prepare(x,o);assert.ok(!('token' in p));assert.equal(await readPublicPassport(x.db,o.token),null);
 const detail=await get(checker,'kind=review_detail&recordType=passport&id='+p.id);assert.ok(!JSON.stringify(detail).includes(o.body.tokenHash));assert.ok(!JSON.stringify(detail).includes(o.token));
 await post(assessor,{action:'decide_readiness',kind:'passport',id:p.id,decision:'approve',independentlyInspected:true,reason:'Self decision must fail'},403);
 await approve(p);assert.equal((await readPublicPassport(x.db,o.token)).result,'green');
 assert.equal((await get(applicant,'kind=deliveries&id='+x.officerId)).deliveries[0].status,'available');
 await get(stranger,'kind=deliveries&id='+x.officerId,404);
 await prepare(x,o,1).then(()=>assert.fail('Consumed request reused'),e=>assert.match(e.message,/409|consumed/));
 const fresh=await offer(x),replacement=await prepare(x,fresh,1);await approve(replacement);
 assert.equal(await readPublicPassport(x.db,o.token),null);assert.equal((await readPublicPassport(x.db,fresh.token)).result,'green');
 await holdReadiness(x.db,maker,{kind:'passport',id:replacement.id,disposition:'revoke',reason:'Fixture source withdrawn'});
 assert.equal((await readPublicPassport(x.db,fresh.token)).result,'red');assert.equal((await get(applicant,'kind=deliveries&id='+x.officerId)).deliveries[0].status,'unavailable');
 for(const table of ['production_passport_deliveries','production_passport_delivery_bindings']){assert.throws(()=>x.db.sql.exec('DELETE FROM '+table),/immutable/);assert.ok(!JSON.stringify(x.db.sql.prepare('SELECT * FROM '+table).all()).includes(fresh.token));}
});

test('HTTP corrections and independent intake review reject stale versions and invalidate delivery',async t=>{
 const x=await setup(t),o=await offer(x);
 await post(checker,{action:'correct_intake',applicantId:x.caseId,expectedVersion:2,changes:{city:'Sandton'}},403);
 await post(applicant,{action:'review_intake',applicantId:x.caseId,expectedVersion:2,status:'reviewed',note:'Self review must fail'},403);
 await post(maker,{action:'request_information',applicantId:x.caseId,expectedVersion:2,message:'Please correct the actual applicant details for review.'});
 await post(applicant,{action:'correct_intake',applicantId:x.caseId,expectedVersion:2,changes:{city:'Sandton'}},409);
 const corrected=await post(applicant,{action:'correct_intake',applicantId:x.caseId,expectedVersion:3,changes:{city:'Sandton'}});assert.equal(corrected.case.applicantVersion,4);
 const reviewed=await post(maker,{action:'review_intake',applicantId:x.caseId,expectedVersion:4,status:'reviewed',note:'Independently inspected actual synthetic correction.'});assert.equal(reviewed.case.applicantVersion,5);
 await post(maker,{action:'prepare_entity',applicantId:x.caseId,applicantVersion:4},409);
 await post(maker,{action:'prepare_entity',applicantId:x.caseId,applicantVersion:5});
 assert.equal((await get(applicant,'kind=deliveries&id='+x.officerId)).deliveries[0].status,'expired_or_stale');
 await post(applicant,o.body,409);
 await post(applicant,{action:'withdraw_intake',applicantId:x.caseId,expectedVersion:5});
 assert.equal((await get(applicant,'kind=case&id='+x.caseId)).case.intakeStatus,'withdrawn');
});

async function engagement(x){
 x.db.sql.prepare("INSERT INTO workforce_employers(id,legal_name,employer_type,environment,status,review_due_at) VALUES('fixture-employer','Isolated Employer','lokd_employer','production','current',?)").run(new Date(Date.now()+2*86400000).toISOString());
 const p=await manageProductionEvidence(x.db,maker,{action:'prepare_evidence',kind:'engagement',fields:{engagementId:'usable-engagement',officerId:x.officerId,employerId:'fixture-employer',model:'direct_flex',termsVersion:'fixture-v1',engagementReference:'private:fixture-engagement',weeklyHourCap:'24',payrollReference:'private:fixture-payroll',benefitsReference:'private:fixture-benefits'},sourceDocumentsReviewed:true,expiresAt:new Date(Date.now()+86400000).toISOString()});
 await manageProductionEvidence(x.db,checker,{action:'decide_evidence',reviewId:p.reviewId,decision:'approve',evidenceIndependentlyChecked:true,reason:'Independent fixture workforce review'});return p;
}
test('workforce and automatic passport holds show exact human audit and forbid that human deciding disposition',async t=>{
 const x=await setup(t),eng=await engagement(x),o=await offer(x),p=await prepare(x,o);await approve(p);
 await post(checker,{action:'suspend_workforce',reviewId:eng.reviewId,reason:'Human operator inspected contradictory fixture workforce evidence'});
 const detail=await get(maker,'kind=review_detail&recordType=workforce&id='+eng.reviewId);
 for(const kind of ['workforce','passport']){const h=detail.holds.find(h=>h.kind===kind);assert.equal(h.held_by,'system');assert.equal(h.attribution,'linked_human_action');assert.equal(h.humanAudit[0].actorId,checker.userId);assert.equal(h.humanAudit[0].detail.sourceVersion,1);}
 const hold=detail.holds.find(h=>h.kind==='workforce');
 const investigation=await post(assessor,{action:'prepare_disposition',kind:'workforce',holdId:hold.hold_id,applicantVersion:2,evidenceReference:'private:fixture-investigation',evidenceHash:'d'.repeat(64),checkedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),actuallyInvestigated:true});
 assert.equal((await get(independent,'kind=review_detail&recordType=disposition&id='+investigation.id)).record.id,investigation.id);
 const command={action:'decide_disposition',proposalId:investigation.id,decision:'allow_replacement',independentlyInvestigated:true,reason:'Independent fixture hold investigation'};
 await post(checker,command,409);await post(independent,command);
 assert.equal((await post(checker,{action:'suspend_workforce',reviewId:eng.reviewId,reason:'Retry after lost response'})).alreadyRecorded,true);
 assert.throws(()=>x.db.sql.exec('DELETE FROM production_hold_provenance'),/immutable/);
 assert.throws(()=>x.db.sql.exec("UPDATE audit_events SET actor_id='forged' WHERE id IN (SELECT audit_event_id FROM production_hold_provenance)"),/immutable/);
 assert.equal((await get(maker,'kind=holds&id='+x.caseId)).holds.length,detail.holds.length);
 await get(applicant,'kind=holds&id='+x.caseId,403);
 assert.equal((await readPublicPassport(x.db,o.token)).result,'red');
});

test('request and approval expiry use the database clock and preserve independent decisions',async t=>{
 const x=await setup(t),clock=installFixtureClock(t,x.db.sql),o=await offer(x),p=await prepare(x,o);
 clock.advance(86400001);
 await assert.rejects(decideReadiness(x.db,independent,{kind:'passport',id:p.id,decision:'approve',independentlyInspected:true,reason:'Expired request cannot be approved'}),/Private delivery changed or expired/);
 await post(independent,{action:'decide_readiness',kind:'passport',id:p.id,decision:'approve',independentlyInspected:true,reason:'Expired delivery must not issue'},409);
 assert.equal(await readPublicPassport(x.db,o.token),null);
 assert.equal((await get(applicant,'kind=deliveries&id='+x.officerId)).deliveries[0].status,'unavailable');
 assert.equal(x.db.sql.prepare("SELECT count(*) AS n FROM production_readiness_decisions WHERE kind='passport' AND target_id=?").get(p.id).n,0);
});

test('concurrent private preparations consume a request once; a new hold blocks delayed approval',async t=>{
 const x=await setup(t),o=await offer(x);
 const command={action:'prepare_passport',...x.passportInput,deliveryId:o.delivery.deliveryId};
 const results=await Promise.all([POST(req(assessor,'POST',command)),POST(req(maker,'POST',command))]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const p=await results.find(r=>r.status===200).json();
 await holdReadiness(x.db,maker,{kind:'review',id:x.core.review.id,disposition:'suspend',reason:'Fresh contradictory fixture source before approval'});
 await post(independent,{action:'decide_readiness',kind:'passport',id:p.id,decision:'approve',independentlyInspected:true,reason:'Stale selected evidence must fail'},409);
 assert.equal(await readPublicPassport(x.db,o.token),null);assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_passport_delivery_bindings').get().n,1);
});

test('request owner/version is rechecked if correction races passport preparation',async t=>{
 const x=await setup(t),o=await offer(x),original=x.db.batch.bind(x.db);let changed=false;
 x.db.batch=async statements=>{
  if(!changed){changed=true;await post(applicant,{action:'correct_intake',applicantId:x.caseId,expectedVersion:2,changes:{city:'Sandton'}});}
  return original(statements);
 };
 await post(assessor,{action:'prepare_passport',...x.passportInput,deliveryId:o.delivery.deliveryId},409);
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_passport_delivery_bindings').get().n,0);
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_readiness_passports WHERE officer_id=?').get(x.officerId).n,0);
});


test('historical system holds retain unattributed status and separate related human audit',async t=>{
 const x=await setup(t,{migration:false}),eng=await engagement(x);
 await manageProductionEvidence(x.db,checker,{action:'suspend_evidence',reviewId:eng.reviewId,reason:'Historical operator inspection'});
 // Reproduce the original generic-audit format in this disposable pre-migration fixture.
 x.db.sql.prepare("UPDATE audit_events SET detail='Historical operator inspection' WHERE event_type='production_evidence_suspended'").run();
 for(const file of fs.readdirSync('drizzle').filter(file=>file.startsWith('0068')&&file.endsWith('.sql')))x.db.sql.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const detail=await get(maker,'kind=review_detail&recordType=workforce&id='+eng.reviewId);
 assert.equal(detail.holds[0].attribution,'system_only');assert.equal(detail.holds[0].humanAudit.length,0);
 assert.equal(detail.related.suspensionAudit[0].actorId,checker.userId);assert.equal(detail.current,false);
});

test('a changed workforce version rolls back suspension instead of misattributing the human audit',async t=>{
 const x=await setup(t),eng=await engagement(x),original=x.db.batch.bind(x.db);let changed=false;
 x.db.batch=async statements=>{if(!changed){changed=true;x.db.sql.prepare("UPDATE workforce_engagements SET version=version+1 WHERE id='usable-engagement'").run();}return original(statements);};
 await post(checker,{action:'suspend_workforce',reviewId:eng.reviewId,reason:'Stale fixture suspension must not create a false receipt'},409);
 assert.equal(x.db.sql.prepare("SELECT status FROM workforce_engagements WHERE id='usable-engagement'").get().status,'active');
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_workforce_holds').get().n,0);assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM production_hold_provenance').get().n,0);
});


test('private verifier receives bearer in body only and remains read-only across revocation',async t=>{
 const x=await setup(t),o=await offer(x),p=await prepare(x,o);
 const request=(token=o.token,origin='https://lokd.co.za')=>new Request('https://lokd.co.za/api/passport/verify',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({token})});
 assert.equal((await verify(request())).status,404);await approve(p);
 const before=x.db.sql.prepare('SELECT count(*) AS n FROM audit_events').get().n,response=await verify(request());assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal((await response.json()).passport.result,'green');
 assert.equal(x.db.sql.prepare('SELECT count(*) AS n FROM audit_events').get().n,before);
 assert.equal((await verify(request(o.token,'https://attacker.example'))).status,403);assert.equal((await verify(request('bad'))).status,400);
 await post(applicant,{action:'request_passport_delivery',officerId:x.officerId,requestKey:'raw-not-allowed',token:o.token},400);
 await holdReadiness(x.db,maker,{kind:'passport',id:p.id,disposition:'revoke',reason:'Fixture evidence withdrawn'});
 const revoked=await verify(request());assert.equal((await revoked.json()).passport.result,'red');
});
