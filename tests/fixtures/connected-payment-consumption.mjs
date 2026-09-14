// Uses the actual connected payroll item and applicant; all provider/bank evidence
// is synthetic and every payment mutation is rolled back before suspension QA.
import assert from 'node:assert/strict';
import {suspendOfficerWorkforce} from '../../app/lib/production-rereview.ts';
import {operateProduction} from '../../app/lib/production-operations.ts';
import {operatePaymentDestination} from '../../app/lib/payment-destinations.ts';
import {operateEmployeePayment} from '../../app/lib/employee-payments.ts';
import {operatePaymentExecution,receiveLiveTransferWebhook} from '../../app/lib/payment-execution.ts';

export async function consumeConnectedPayment({db,database,runId,officerId,maker,checker,finance,applicant,document,headers}){
 const item=database.prepare('SELECT * FROM payroll_items WHERE payroll_run_id=? AND officer_id=?').get(runId,officerId);
 assert.ok(item);assert.ok(item.net_pay_cents>0);
 const linked=database.prepare("SELECT * FROM production_entity_links WHERE kind='officer' AND entity_id=?").get(officerId);
 assert.equal(linked.owner_user_id,applicant.userId);
 const intakeBefore=JSON.stringify(database.prepare('SELECT * FROM signup_cases ORDER BY rowid').all());
 const payrollBefore=JSON.stringify(database.prepare('SELECT * FROM payroll_items WHERE id=?').get(item.id));
 const issuedBefore=JSON.stringify(database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(document.documentId));
 const gateBefore=database.prepare('SELECT enabled FROM payment_live_control WHERE id=1').get().enabled;
 assert.equal(gateBefore,0);
 const runtime={PAYSTACK_TEST_SECRET_KEY:'sk_test_connected_fixture',PAYSTACK_LIVE_SECRET_KEY:'sk_live_connected_fixture'};
 const recipient={id:123,integration:456,recipient_code:'RCP_connected001',domain:'live',type:'basa',currency:'ZAR',active:true,is_deleted:false,name:'Synthetic connected officer',updatedAt:'2026-09-01T00:00:00.000Z',details:{account_number:'1234567890',bank_code:'632005',bank_name:'Fixture bank',account_name:'Synthetic connected officer'}};
 let reference,posts=0,status='success';
 const raw=()=>({id:1987,transfer_code:'TRF_connected001',reference,domain:'live',amount:item.net_pay_cents,currency:'ZAR',source:'balance',recipient:123,integration:456,status});
 const transport=async(url,options)=>{
  assert.equal(options.redirect,'error');assert.match(options.headers.Authorization,/^Bearer sk_live_/);
  if(url==='https://api.paystack.co/transferrecipient/'+recipient.recipient_code)return Response.json({status:true,data:recipient});
  if(url==='https://api.paystack.co/balance')return Response.json({status:true,data:[{currency:'ZAR',balance:item.net_pay_cents+500}]});
  if(url==='https://api.paystack.co/transfer'){
   const body=JSON.parse(options.body);assert.equal(body.reference,reference);assert.equal(body.amount,item.net_pay_cents);assert.equal(body.recipient,recipient.recipient_code);assert.equal(body.currency,'ZAR');posts++;throw Error('Synthetic timeout after acceptance; no network performed');
  }
  assert.equal(url,'https://api.paystack.co/transfer/verify/'+reference);assert.equal(options.method,'GET');return Response.json({status:true,data:raw()});
 };
 const current=()=>database.prepare('SELECT * FROM employee_payment_instructions WHERE reference=?').get(reference);
 const financial=()=>database.prepare('SELECT * FROM employee_payment_financial_state WHERE reference=?').get(reference);
 const command=(action,extra={})=>({action,kind:'employee',reference,sourceHash:current()?.source_hash,version:current()?.version,evidenceReviewed:true,note:'Independent synthetic connected payment evidence.',...extra});
 const execute=(actor,action,extra={},rt=runtime)=>operatePaymentExecution(db,actor,command(action,extra),headers(actor),rt,transport);
 const signed=async()=>{
  const body=JSON.stringify({event:'transfer.'+status,data:raw()}),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(runtime.PAYSTACK_LIVE_SECRET_KEY),{name:'HMAC',hash:'SHA-512'},false,['sign']);
  const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');
  return receiveLiveTransferWebhook(new Request('https://fixture/api/paystack/transfers/live/webhook',{method:'POST',headers:{'x-paystack-signature':signature},body}),db,runtime);
 };
 const oldBatch=db.batch;
 database.exec('SAVEPOINT connected_payment');
 db.batch=async statements=>{database.exec('SAVEPOINT connected_payment_batch');try{const values=statements.map(s=>s.runSync());database.exec('RELEASE connected_payment_batch');return values;}catch(error){database.exec('ROLLBACK TO connected_payment_batch; RELEASE connected_payment_batch');throw error;}};
 try{
  await operateProduction(db,checker,{action:'grant_operator',email:maker.email,role:'finance_approver',limitCents:10000000},headers(checker));
  const source=database.prepare('SELECT * FROM payment_destination_sources WHERE profile_id=?').get(item.payroll_profile_id);
  assert.equal(source.owner_user_id,applicant.userId);assert.equal(JSON.parse(source.source_json).caseId,linked.case_id);
  const expiry=Math.min(Date.now()+3600000,Date.parse(JSON.parse(source.source_json).expiresAt));
  const destination=await operatePaymentDestination(db,maker,{action:'prepare_destination',requestKey:'connected-destination',profileId:item.payroll_profile_id,mode:'live',recipientCode:recipient.recipient_code,integrationId:'456',accountNumber:'1234567890',ownershipReference:'vault:connected:ownership',ownershipHash:'a'.repeat(64),mandateReference:'vault:connected:mandate',mandateHash:'b'.repeat(64),capabilityReference:'vault:connected:capability',capabilityHash:'c'.repeat(64),expiresAt:new Date(expiry).toISOString(),documentsReviewed:true,capabilityReviewed:true,note:'Synthetic ownership evidence for the already linked officer.'},headers(maker),runtime,transport);
  const d=database.prepare('SELECT * FROM payment_destination_reviews WHERE id=?').get(destination.destinationId);
  const approveDestination={action:'approve_destination',destinationId:d.id,payloadHash:d.payload_hash,accountNumber:'1234567890',evidenceReviewed:true,note:'Independent synthetic destination review.'};
  await assert.rejects(()=>operatePaymentDestination(db,maker,approveDestination,headers(maker),runtime,transport),/preparer|maker/);
  await operatePaymentDestination(db,checker,approveDestination,headers(checker),runtime,transport);
  const input={action:'prepare_employee_payment',requestKey:'connected-instruction',payrollItemId:item.id,destinationId:d.id,note:'Actual connected exported payroll item; synthetic destination.',instructionReviewed:true};
  await assert.rejects(()=>operateEmployeePayment(db,applicant,input,headers(applicant),runtime,transport),/Operations/);
  reference=(await operateEmployeePayment(db,maker,input,headers(maker),runtime,transport)).reference;
  const actual=JSON.parse(current().source_json);assert.equal(actual.runId,runId);assert.equal(actual.officerId,officerId);assert.equal(actual.ownerUser,applicant.userId);assert.equal(current().amount_cents,item.net_pay_cents);
  const approval={...command('approve_employee_payment'),instructionReviewed:true};
  await assert.rejects(()=>operateEmployeePayment(db,maker,approval,headers(maker),runtime,transport),/maker|Independent/);
  await operateEmployeePayment(db,finance,approval,headers(finance),runtime,transport);
  const reserve=await execute(maker,'prepare_payment_reserve',{requestKey:'connected-reserve',integrationId:'456',amountCents:item.net_pay_cents+500,fundingReference:'bank:connected:allocation',fundingHash:'a'.repeat(64),capabilityReference:'fixture:connected-capability',capabilityHash:'c'.repeat(64)});
  const r=database.prepare('SELECT * FROM payment_live_reserves WHERE id=?').get(reserve.reserveId);
  await assert.rejects(()=>execute(maker,'approve_payment_reserve',{reserveId:r.id,payloadHash:r.payload_hash}),/maker|Independent/);
  await execute(finance,'approve_payment_reserve',{reserveId:r.id,payloadHash:r.payload_hash});
  const release=await execute(maker,'prepare_live_release',{requestKey:'connected-release',reserveId:r.id,feeCeilingCents:500,acceptanceReference:'fixture:connected-independent-release'});
  const l=database.prepare('SELECT * FROM payment_live_releases WHERE id=?').get(release.releaseId);
  await assert.rejects(()=>execute(maker,'approve_live_release',{releaseId:l.id,payloadHash:l.payload_hash}),/maker|Independent/);
  await execute(finance,'approve_live_release',{releaseId:l.id,payloadHash:l.payload_hash});
  const live={...runtime,LOKD_LIVE_PAYMENTS_ENABLED:'true'};
  await assert.rejects(()=>execute(finance,'dispatch_live_payment',{releaseId:l.id}),e=>e.status===423);
  await assert.rejects(()=>execute(finance,'dispatch_live_payment',{releaseId:l.id},live),e=>e.status===423);
  database.exec('UPDATE payment_live_control SET enabled=1 WHERE id=1');
  await assert.rejects(()=>execute(finance,'dispatch_live_payment',{releaseId:l.id}),e=>e.status===423);assert.equal(posts,0);
  assert.equal((await document.read()).documents[0].currentState,'pending');
  await assert.rejects(()=>execute(finance,'dispatch_live_payment',{releaseId:l.id},live),/uncertain/);assert.equal(posts,1);
  assert.equal(current().status,'dispatch_claimed');
  await assert.rejects(()=>execute(finance,'dispatch_live_payment',{releaseId:l.id},live),/cannot be resubmitted/);assert.equal(posts,1);
  await signed();await signed();await execute(finance,'verify_live_payment');
  assert.equal(financial().financial_state,'held');assert.notEqual((await document.read()).documents[0].currentState,'paid');
  const reconcile=async(suffix,bankHash,bankAmount)=>{
   const prepared=await execute(maker,'prepare_live_reconciliation',{requestKey:'connected-reconcile-'+suffix,bankReference:'bank:connected:'+suffix,bankHash,bankAmountCents:bankAmount});
   const review=database.prepare('SELECT * FROM payment_live_reconciliation_reviews WHERE id=?').get(prepared.reviewId);
   await assert.rejects(()=>execute(maker,'approve_live_reconciliation',{reviewId:review.id,payloadHash:review.payload_hash}),/maker|Independent/);
   await execute(finance,'approve_live_reconciliation',{reviewId:review.id,payloadHash:review.payload_hash});
  };
  await reconcile('paid','d'.repeat(64),item.net_pay_cents+100);
  assert.equal(financial().financial_state,'paid');assert.equal(financial().paid_receipts,1);
  assert.equal((await document.read()).documents[0].currentState,'paid');assert.equal((await document.read()).documents[0].asIssuedState,'unpaid');
  const paidHistory=JSON.stringify(database.prepare('SELECT * FROM payment_live_reconciliation_decisions ORDER BY rowid').all());
  status='reversed';await signed();assert.equal(financial().financial_state,'held');assert.equal((await document.read()).documents[0].currentState,'held');
  await execute(finance,'verify_live_payment');await reconcile('returned','e'.repeat(64),item.net_pay_cents);
  assert.equal(financial().financial_state,'reversed');assert.equal(financial().paid_receipts,1);assert.equal(posts,1);
  assert.equal((await document.read()).documents[0].currentState,'reversed');assert.equal((await document.read()).documents[0].asIssuedState,'unpaid');
  const decisions=database.prepare('SELECT * FROM payment_live_reconciliation_decisions ORDER BY rowid').all();assert.equal(JSON.stringify(decisions.slice(0,JSON.parse(paidHistory).length)),paidHistory);
  assert.equal(database.prepare('SELECT remaining_cents FROM payment_live_reserve_current WHERE id=?').get(r.id).remaining_cents,0);
  assert.equal(JSON.stringify(database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(document.documentId)),issuedBefore);
  assert.equal(JSON.stringify(database.prepare('SELECT * FROM payroll_items WHERE id=?').get(item.id)),payrollBefore);
  assert.equal(JSON.stringify(database.prepare('SELECT * FROM signup_cases ORDER BY rowid').all()),intakeBefore);
  assert.equal(database.prepare('SELECT count(*) n FROM disbursement_items').get().n,0);
  // Suspend the genuine linked engagement while paid AND reversed evidence still
  // exists. This is a guarded domain action, not a raw history/state mutation.
  const engagementReview=database.prepare("SELECT id FROM production_evidence_reviews WHERE kind='engagement' AND state='approved' AND json_extract(payload_json,'$.engagementId')=?").get(item.workforce_engagement_id);
  assert.ok(engagementReview);
  const historyTables=['employee_payment_instructions','employee_payment_commands','employee_transfer_observations','payment_live_claims','payment_live_reserves','payment_live_reserve_decisions','payment_live_releases','payment_live_release_decisions','payment_live_reconciliation_reviews','payment_live_reconciliation_decisions','payroll_runs','payroll_items','pay_item_sources','production_payroll_snapshots','production_payroll_decisions','finance_document_versions','finance_document_decisions','finance_document_issues'];
  const retainedHistory=()=>Object.fromEntries(historyTables.map(table=>[table,database.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const beforeSuspension=retainedHistory();
  assert.deepEqual(decisions.filter(d=>d.decision==='approved').map(d=>d.disposition),['success','reversed']);
  const suspension=await suspendOfficerWorkforce(db,maker,{reviewId:engagementReview.id,reason:'Synthetic workforce source withdrawn after reconciled payment reversal.'});
  assert.equal(suspension.suspended,true);assert.equal(suspension.workEligible,false);
  assert.equal(database.prepare('SELECT status FROM workforce_engagements WHERE id=?').get(item.workforce_engagement_id).status,'suspended');
  assert.ok(database.prepare('SELECT id FROM production_workforce_holds WHERE engagement_id=?').get(item.workforce_engagement_id));
  assert.equal(database.prepare('SELECT count(*) n FROM current_production_readiness_passports WHERE officer_id=?').get(officerId).n,0);
  assert.deepEqual(retainedHistory(),beforeSuspension,'workforce suspension cannot rewrite paid/reversed, payroll or issued-document history');
  // Financial evidence remains reconciled reversed; revoked work eligibility
  // does not pretend returned funds disappeared or rewrite as-issued facts.
  assert.equal(financial().financial_state,'reversed');assert.equal(financial().paid_receipts,1);
  const afterSuspension=(await document.read()).documents[0];
  assert.equal(afterSuspension.currentState,'reversed');assert.equal(afterSuspension.asIssuedState,'unpaid');
  assert.equal(posts,1);

 }finally{db.batch=oldBatch;database.exec('ROLLBACK TO connected_payment; RELEASE connected_payment');}
 assert.equal(database.prepare('SELECT enabled FROM payment_live_control WHERE id=1').get().enabled,gateBefore);
 assert.equal(database.prepare('SELECT count(*) n FROM employee_payment_instructions').get().n,0);
 assert.equal((await document.read()).documents[0].currentState,'unpaid');
 return {payrollItemId:item.id,runId,officerId,dispatches:posts,restored:true};
}
