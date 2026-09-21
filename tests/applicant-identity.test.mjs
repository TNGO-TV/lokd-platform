import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {env} from 'cloudflare:workers';
import {classifyVerifyNow,dispatchVerifyNow,scenarioSignal} from '../app/lib/verifynow-adapter.ts';
import {runApplicantIdentity,readApplicantIdentity} from '../app/lib/applicant-identity.ts';
import {POST as apply} from '../app/api/applications/route.ts';
import {GET,POST} from '../app/api/identity/route.ts';
import {writeSignup} from '../app/lib/signup-server.ts';
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync(`drizzle/${f}`,'utf8').replaceAll('--> statement-breakpoint',''));}
 prepare(sql){const database=this.sql;const make=(values=[])=>({bind:(...v)=>make(v),first:async()=>database.prepare(sql).get(...values)??null,all:async()=>({results:database.prepare(sql).all(...values)}),run:async()=>({meta:{changes:Number(database.prepare(sql).run(...values).changes)}})});return make();}
 async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());this.sql.exec('COMMIT');return results;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
const key='vn_live_'+'a'.repeat(64);
const approved={success:true,results:{said_verification:{Status:'Success',realTimeResults:{Status:'ID Number Valid'}}}};
test('saved VerifyNow fixture signals preserve negatives, review and provider failures',()=>{
 for(const fixture of JSON.parse(fs.readFileSync('tests/fixtures/verifynow-outcomes.json','utf8'))){
  const body={};for(const [path,value] of Object.entries(fixture.fields)){const keys=path.split('.');let node=body;for(const k of keys.slice(0,-1))node=node[k]??={};node[keys.at(-1)]=value;}
  if(fixture.case==='drivers-licence'){body.bundle='drivers_licence_barcode';body.data={};}
  const expected=fixture.http===429?'rate_limited':({mock_id_valid:'mock_approved',mock_bank_verified:'mock_approved',mock_card_decoded:'mock_approved',provider_unavailable:'unavailable'}[fixture.expected]??fixture.expected);
  assert.equal(classifyVerifyNow(scenarioSignal[fixture.case],fixture.http,body),expected,fixture.case);
 }
 assert.equal(classifyVerifyNow('id',200,{success:true}),'unexpected');
 assert.equal(classifyVerifyNow('face',502,{success:true,results:{face_match:{status:'Approved'}}}),'unavailable');
});
test('adapter enforces fixed host, sandbox payload, redirect rejection and preserves Retry-After',async()=>{
 let calls=0;const transport=async(url,options)=>{calls++;assert.equal(url,'https://www.verifynow.co.za/api/external/verify');assert.equal(JSON.parse(options.body).mode,'sandbox');assert.equal(options.redirect,'error');assert.equal(options.headers['Idempotency-Key'],'request-id');return Response.json({},{status:429,headers:{'retry-after':'90'}});};
 const r=await dispatchVerifyNow('id-found',key,'request-id',transport);assert.equal(r.outcome,'rate_limited');assert.ok(Date.parse(r.retryAt)>=Date.now()+89000);
 await assert.rejects(()=>dispatchVerifyNow('https://attacker.test',key,'x',transport));assert.equal(calls,1);
});
async function setup(pathway='qualified',psiraStatus='active'){
 const db=new D1();env.DB=db;
 const response=await apply(new Request('https://lokd.co.za/api/applications',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify({pathway,fullName:'Synthetic Officer',mobile:'0821234567',email:'identity@example.test',city:'Johannesburg',province:'Gauteng',psiraStatus,psiraNumber:psiraStatus==='active'?'1234567':'',psiraGrade:'Grade A',services:['Unarmed'],purposes:['Commercial access'],training:pathway==='training'?['Entry-level security training']:[],over18Confirmed:true,eligibilityAcknowledged:true,contactConsent:true})}));assert.equal(response.status,202);const caseId=(await response.json()).reference;
 await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'link',kind:'officer',id:caseId,expectedVersion:0});return {db,caseId,runtime:{DB:db,VERIFYNOW_API_KEY:key,VERIFYNOW_SANDBOX_ENABLED:'true'}};
}
test('owned case dispatch is claimed once; sandbox entry unlocks correct path without real eligibility',async()=>{
 for(const [path,psira,next] of [['qualified','active','registered_enrolment'],['training','not_registered','training_options']]){
  const {db,caseId,runtime}=await setup(path,psira);let calls=0;
  const transport=async()=>{calls++;return Response.json(approved);};
  const input={caseId,caseVersion:1,scenario:'id-found'};
  await assert.rejects(()=>runApplicantIdentity(runtime,'intruder',input,transport),/own/);assert.equal(calls,0);
  await Promise.all([runApplicantIdentity(runtime,'user_identity',input,transport),runApplicantIdentity(runtime,'user_identity',input,transport)]);
  const state=await runApplicantIdentity(runtime,'user_identity',input,transport);assert.equal(calls,1);assert.equal(state.nextStep,next);assert.equal(state.identityVerified,false);assert.equal(state.workEligible,false);assert.equal(state.enrolment.amountMinor,path==='qualified'?35000:null);assert.equal(state.enrolment.liveChargingEnabled,false);
  await assert.rejects(()=>runApplicantIdentity(runtime,'user_identity',{...input,mode:'production'},transport));
  await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'correct',kind:'officer',id:caseId,expectedVersion:1,changes:{city:'Sandton'}});
  assert.equal((await readApplicantIdentity(db,'user_identity',caseId)).nextStep,'entry_id');
  await assert.rejects(()=>runApplicantIdentity(runtime,'user_identity',input,transport),/changed/);db.sql.close();
 }
});
test('unknown dispatch stays unverified and does not retry; anonymous and wrong-host access fail',async()=>{
 const {db,caseId,runtime}=await setup();let calls=0;const transport=async()=>{calls++;throw Error('timeout');};const input={caseId,caseVersion:1,scenario:'id-found'};
 let state=await runApplicantIdentity(runtime,'user_identity',input,transport);assert.equal(state.checks[0].state,'delivery_unknown');assert.equal(state.nextStep,'entry_id');await runApplicantIdentity(runtime,'user_identity',input,transport);assert.equal(calls,1);
 assert.equal((await GET(new Request('https://officers.lokd.co.za/api/identity?caseId='+caseId))).status,401);
 assert.equal((await GET(new Request('https://portal.lokd.co.za/api/identity?caseId='+caseId,{headers:{'x-lokd-verified-user-id':'user_identity','x-lokd-verified-email':'identity@example.test'}}))).status,403);
 assert.equal((await POST(new Request('https://officers.lokd.co.za/api/identity',{method:'POST',headers:{origin:'https://attacker.test','content-type':'application/json'},body:'{}'}))).status,403);db.sql.close();
});

test('Operations recovery enforces cooldown, exclusive dispatch, evidence history and review of unknown delivery',async()=>{
 const {recoverApplicantIdentity}=await import('../app/lib/applicant-identity.ts');
 const {db,caseId,runtime}=await setup();let calls=0;
 const rate=async()=>{calls++;return Response.json({},{status:429,headers:{'retry-after':'90'}});};
 let state=await runApplicantIdentity(runtime,'user_identity',{caseId,caseVersion:1,scenario:'id-found'},rate);
 const id=state.checks[0].id;const input={caseId,caseVersion:1,checkId:id,expectedAttempts:1,action:'retry',note:'Provider reviewed; retry window confirmed.'};
 await assert.rejects(()=>recoverApplicantIdentity(runtime,'reviewer',input,rate),/time/);
 await assert.rejects(()=>recoverApplicantIdentity(runtime,'user_identity',input,rate),/Another Operations/);
 assert.equal(calls,1);
 db.sql.prepare('UPDATE applicant_verification_checks SET retry_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',id);
 const outcomes=await Promise.allSettled([recoverApplicantIdentity(runtime,'reviewer',input,rate),recoverApplicantIdentity(runtime,'reviewer',input,rate)]);
 assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls,2);
 assert.ok((await readApplicantIdentity(db,'user_identity',caseId)).history.some(h=>JSON.parse(h.snapshot).state==='rate_limited'));
 assert.throws(()=>db.sql.exec('DELETE FROM verification_recovery_events'),/immutable/i);
 db.sql.prepare("UPDATE applicant_verification_checks SET state='delivery_unknown' WHERE id=?").run(id);
 await assert.rejects(()=>recoverApplicantIdentity(runtime,'reviewer',{...input,expectedAttempts:2},rate),/not retryable/);
 state=await recoverApplicantIdentity(runtime,'reviewer',{...input,expectedAttempts:2,action:'resolve_unknown',noResultConfirmed:true},rate);
 assert.equal(state.checks[0].state,'retry_authorized');assert.equal(calls,2);
 await assert.rejects(()=>recoverApplicantIdentity(runtime,'reviewer',{...input,expectedAttempts:2},rate),/time/);db.sql.close();
});

test('applicant-bound R350 test checkout reuses dispatch and requires exact verified transaction plus signed webhook',async()=>{
 const {initializeTestEnrolment,reconcileTestEnrolment,expectedMetadata,ENROLMENT_PACKAGE}=await import('../app/lib/test-enrolment.ts');
 const {receivePaystackTest}=await import('../app/lib/paystack-test.ts');const {createHmac}=await import('node:crypto');
 const {db,caseId,runtime}=await setup();runtime.PAYSTACK_TEST_SECRET_KEY='sk_test_fixture';
 await runApplicantIdentity(runtime,'user_identity',{caseId,caseVersion:1,scenario:'id-found'},async()=>Response.json(approved));
 const input={caseId,caseVersion:1,packageVersion:ENROLMENT_PACKAGE.version};let calls=0;
 const initialize=async(url,opts)=>{calls++;const body=JSON.parse(opts.body);assert.equal(body.amount,'35000');assert.equal(body.currency,'ZAR');assert.equal(JSON.parse(body.metadata).applicant_id,'user_identity');return Response.json({status:true,data:{reference:body.reference,authorization_url:'https://checkout.paystack.com/test-fixture'}});};
 await assert.rejects(()=>initializeTestEnrolment(runtime,'intruder','x@example.test',input,initialize));
 await assert.rejects(()=>initializeTestEnrolment(runtime,'user_identity','x@example.test',{...input,packageVersion:'wrong'},initialize));
 await Promise.all([initializeTestEnrolment(runtime,'user_identity','identity@example.test',input,initialize),initializeTestEnrolment(runtime,'user_identity','identity@example.test',input,initialize)]);assert.equal(calls,1);
 let result=await initializeTestEnrolment(runtime,'user_identity','identity@example.test',input,initialize);let order=result.order;
 const data={domain:'test',id:77,reference:order.reference,status:'success',amount:35000,currency:'ZAR',metadata:expectedMetadata(order)};
 const verify=async()=>Response.json({status:true,data});
 const reconcile=()=>reconcileTestEnrolment(runtime,'user_identity',{caseId,reference:order.reference,expectedRevision:order.revision},verify);
 result=await reconcile();order=result.order;assert.equal(order.state,'awaiting_webhook');
 const webhook=async event=>{const body=JSON.stringify({event:'charge.success',data:event});return receivePaystackTest(new Request('https://lokd.co.za/api/paystack/test/webhook',{method:'POST',body,headers:{'x-paystack-signature':createHmac('sha512',runtime.PAYSTACK_TEST_SECRET_KEY).update(body).digest('hex')}}),runtime);};
 assert.equal((await webhook(data)).status,200);assert.equal((await webhook(data)).status,200);
 result=await reconcile();order=result.order;assert.equal(order.state,'paid_test');assert.equal(result.workEligible,false);
 const revision=order.revision;result=await reconcile();assert.equal(result.order.revision,revision);
 for(const [field,value] of [['amount',35001],['currency','USD'],['id',78],['metadata',{...data.metadata,applicant_id:'other'}]]){const original=data[field];data[field]=value;result=await reconcile();order=result.order;assert.equal(order.state,'review_required',field);data[field]=original;}
 // A conflicting signed event must never grant acceptance, even with a valid signature.
 await webhook({...data,amount:1});result=await reconcile();order=result.order;assert.equal(order.state,'review_required');
 assert.throws(()=>db.sql.prepare('UPDATE test_enrolment_orders SET amount_minor=1 WHERE reference=?').run(order.reference),/immutable/i);
 assert.throws(()=>db.sql.exec('DELETE FROM test_enrolment_events'),/immutable/i);
 data.status='abandoned';result=await reconcile();order=result.order;assert.equal(order.state,'abandoned');
 await writeSignup(db,{userId:'user_identity',email:'identity@example.test',operations:false},{action:'correct',kind:'officer',id:caseId,expectedVersion:1,changes:{city:'Sandton'}});
 db.sql.prepare('UPDATE applicant_verification_checks SET retry_at=?').run('2000-01-01T00:00:00.000Z');
 await runApplicantIdentity(runtime,'user_identity',{caseId,caseVersion:2,scenario:'id-found'},async()=>Response.json(approved));
 await assert.rejects(()=>initializeTestEnrolment(runtime,'user_identity','identity@example.test',{...input,caseVersion:2},initialize),/previous application/);assert.equal(calls,1);db.sql.close();
});

test('training cannot initialize registered enrolment and uncertain initialization never dispatches twice',async()=>{
 const {initializeTestEnrolment,ENROLMENT_PACKAGE}=await import('../app/lib/test-enrolment.ts');
 for(const training of [true,false]){const {db,caseId,runtime}=await setup(training?'training':'qualified',training?'not_registered':'active');runtime.PAYSTACK_TEST_SECRET_KEY='sk_test_fixture';
 await runApplicantIdentity(runtime,'user_identity',{caseId,caseVersion:1,scenario:'id-found'},async()=>Response.json(approved));
 let calls=0;const transport=async()=>{calls++;throw Error('timeout');};const run=()=>initializeTestEnrolment(runtime,'user_identity','identity@example.test',{caseId,caseVersion:1,packageVersion:ENROLMENT_PACKAGE.version},transport);
 if(training){await assert.rejects(run,/entry checks/);assert.equal(calls,0);}else{assert.equal((await run()).order.state,'initialization_unknown');await run();assert.equal(calls,1);}db.sql.close();}
});

test('test agreements bind delivery, signature, review and reissue to the current owned application',async()=>{
 const {writeTestAgreement,readTestAgreements}=await import('../app/lib/test-agreements.ts');const {db,caseId}=await setup();
 const applicant={userId:'user_identity',email:'identity@example.test',operations:false},ops={userId:'reviewer',email:'reviewer@example.test',operations:true};
 const input={kind:'officer',caseId,caseVersion:1,action:'issue',note:'Test signing delivery authorised by the owner.'};
 await assert.rejects(()=>writeTestAgreement(db,applicant,input),/Operations/);
 let result=await writeTestAgreement(db,ops,input);assert.equal(result.documents.length,1);
 await Promise.all([writeTestAgreement(db,ops,input),writeTestAgreement(db,ops,input)]);result=await readTestAgreements(db,applicant,'officer',caseId);assert.equal(result.documents.length,1);
 let e=result.documents[0];const sign={...input,action:'sign',envelopeId:e.id,expectedRevision:e.revision,contentHash:e.content_hash,contextHash:e.context_hash,signerName:'Synthetic Officer',affirmative:true,testAcknowledged:true};
 await assert.rejects(()=>writeTestAgreement(db,ops,sign),/Only the named/);
 await assert.rejects(()=>writeTestAgreement(db,applicant,{...sign,contentHash:'wrong'}),/exact/);
 await assert.rejects(()=>readTestAgreements(db,{...applicant,userId:'other'},'officer',caseId),/not found/);
 result=await writeTestAgreement(db,applicant,sign);e=result.documents[0];assert.equal(e.state,'signed_test');assert.equal(result.liveAgreement,false);assert.equal(result.workEligible,false);
 await assert.rejects(()=>writeTestAgreement(db,applicant,sign),/changed/);
 const review={...input,action:'review',envelopeId:e.id,expectedRevision:e.revision,identityAndAuthorityReviewed:true,note:'Reviewed test identity and representative authority fixture.'};
 await assert.rejects(()=>writeTestAgreement(db,{...applicant,operations:true},review),/independent/);
 result=await writeTestAgreement(db,ops,review);e=result.documents[0];assert.equal(e.state,'reviewed_test');
 result=await writeTestAgreement(db,applicant,{...input,action:'cancel',envelopeId:e.id,expectedRevision:e.revision,note:'Cancel this test agreement for recovery acceptance.'});assert.equal(result.documents[0].state,'cancelled');
 result=await writeTestAgreement(db,ops,input);assert.equal(result.documents.length,2);assert.equal(result.documents[0].state,'issued');
 assert.ok(result.events.some(r=>JSON.parse(r.snapshot).state==='signed_test'));
 assert.throws(()=>db.sql.exec('DELETE FROM test_agreement_events'),/immutable/);
 assert.throws(()=>db.sql.exec("UPDATE test_agreement_envelopes SET wording='changed'"),/immutable/);
 await writeSignup(db,applicant,{action:'correct',kind:'officer',id:caseId,expectedVersion:1,changes:{city:'Sandton'}});
 result=await readTestAgreements(db,applicant,'officer',caseId);assert.ok(result.documents.every(e=>e.stale&&!e.usable));
 await assert.rejects(()=>writeTestAgreement(db,ops,input),/changed/);db.sql.close();
});

test('three-party test operating cycle requires exact signatures and handles dispute, refund and stale evidence',async()=>{
 const {writeTestAgreement}=await import('../app/lib/test-agreements.ts'),{writeTestCycle,readTestCycles}=await import('../app/lib/test-operating-cycle.ts'),{POST:enquire}=await import('../app/api/enquiries/route.ts');
 const {db,caseId}=await setup();env.DB=db;
 const officer={userId:'user_identity',email:'identity@example.test',operations:false},client={userId:'client_test',email:'cycle@example.test',operations:false},ops={userId:'ops_test',email:'ops@example.test',operations:true};
 const res=await enquire(new Request('https://lokd.co.za/api/enquiries',{method:'POST',headers:{origin:'https://lokd.co.za','content-type':'application/json'},body:JSON.stringify({organisationName:'Synthetic Cycle Client',contactName:'Test Client',email:client.email,mobile:'0822345678',siteArea:'Sandton',siteType:'commercial_property',requiredStart:'planning',message:'Controlled test of the complete security service journey.',advanceFundingAcknowledged:true,privacyConsent:true})}));assert.equal(res.status,202);const clientId=(await res.json()).reference;
 await writeSignup(db,client,{action:'link',kind:'client',id:clientId,expectedVersion:0});
 for(const [kind,id,party] of [['client',clientId,client],['officer',caseId,officer]]){
  await writeSignup(db,ops,{action:'review',kind,id,expectedVersion:1,status:'reviewed',note:'Intake reviewed for a synthetic operating cycle.'});
  const base={kind,caseId:id,caseVersion:2,note:'Controlled test evidence reviewed and recorded.'};let d=await writeTestAgreement(db,ops,{...base,action:'issue'}),e=d.documents[0];
  d=await writeTestAgreement(db,party,{...base,action:'sign',envelopeId:e.id,expectedRevision:e.revision,signerName:'Synthetic Participant',affirmative:true,testAcknowledged:true,contentHash:e.content_hash,contextHash:e.context_hash});e=d.documents[0];
  await writeTestAgreement(db,ops,{...base,action:'review',envelopeId:e.id,expectedRevision:e.revision,identityAndAuthorityReviewed:true});
 }
 const create={action:'create',id:'test-cycle-'+crypto.randomUUID(),clientCaseId:clientId,officerCaseId:caseId,siteBrief:'Synthetic Sandton gate service, tomorrow 08:00–10:00.',amountMinor:10000,officerAmountMinor:6000,testAcknowledged:true,note:'Synthetic preparation only; no service or live financial effect.'};
 let result=await writeTestCycle(db,ops,create);assert.equal(result.cycles.length,1);await writeTestCycle(db,ops,create);assert.equal((await readTestCycles(db,ops)).cycles.length,1);
 let c=result.cycles[0];const act=async(actor,action)=>{const d=await writeTestCycle(db,actor,{id:c.id,expectedRevision:c.revision,action,testAcknowledged:true,note:'Synthetic evidence for '+action+' recorded during acceptance.'});c=d.cycles.find(x=>x.id===c.id);return d;};
 await assert.rejects(()=>act(officer,'accept_booking'),/other participant/);
 for(const [actor,action] of [[client,'accept_booking'],[ops,'record_test_collection'],[officer,'start_service'],[officer,'complete_service'],[client,'dispute'],[ops,'resolve_dispute'],[client,'sign_off'],[ops,'prepare_payment'],[ops,'record_test_payment'],[officer,'acknowledge_test_receipt']])result=await act(actor,action);
 assert.equal(c.state,'completed');assert.equal(result.financialEffect,false);assert.equal(result.workEligible,false);assert.equal(c.events.length,11);
 assert.equal((await readTestCycles(db,{...client,userId:'intruder'})).cycles.length,0);
 result=await writeTestCycle(db,ops,{...create,id:'test-cycle-'+crypto.randomUUID()});c=result.cycles.find(x=>x.state==='proposed');
 await act(client,'accept_booking');await act(ops,'record_test_collection');await act(client,'cancel');assert.equal(c.state,'refund_pending');await act(ops,'record_test_refund');assert.equal(c.state,'cancelled');
 result=await writeTestCycle(db,ops,{...create,id:'test-cycle-'+crypto.randomUUID()});c=result.cycles.find(x=>x.state==='proposed');
 await writeSignup(db,officer,{action:'correct',kind:'officer',id:caseId,expectedVersion:2,changes:{city:'Midrand'}});
 await assert.rejects(()=>act(client,'accept_booking'),/changed/);await act(client,'cancel');assert.equal(c.state,'cancelled');
 assert.throws(()=>db.sql.exec('DELETE FROM test_operating_events'),/immutable/);db.sql.close();
});

test('presence requires consent, rejects unassigned live sharing and never exposes private test locations',async()=>{
 const {publicPresence,writePresence}=await import('../app/lib/officer-presence.ts');const {db}=await setup();
 const input={action:'share',mode:'test',consent:true,latitude:-26.20412,longitude:28.04733};
 await assert.rejects(()=>writePresence(db,'user_identity',null,{...input,consent:false}),/consent/);
 await assert.rejects(()=>writePresence(db,'user_identity',null,{...input,mode:'live'}),/assigned/);
 await assert.rejects(()=>writePresence(db,'user_identity','OFF-SYNTHETIC',{...input,mode:'live'}),/production assignment/);
 await assert.rejects(()=>writePresence(db,'user_identity',null,{...input,latitude:Infinity}),/location/);
 const result=await writePresence(db,'user_identity',null,input);assert.equal(result.latitude,-26.2);assert.equal(result.longitude,28);assert.equal((await publicPresence(db)).areas.length,0);
 await writePresence(db,'user_identity',null,{...input,longitude:28.25});assert.equal(db.sql.prepare('SELECT count(*) AS n FROM public_officer_presence').get().n,1);
 await writePresence(db,'user_identity',null,{mode:'test',action:'stop'});assert.equal(db.sql.prepare('SELECT count(*) AS n FROM public_officer_presence').get().n,0);db.sql.close();
});
