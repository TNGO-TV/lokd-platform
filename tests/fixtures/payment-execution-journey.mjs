import assert from 'node:assert/strict';
import {operatePaymentExecution as execute,receiveLiveTransferWebhook} from '../../app/lib/payment-execution.ts';
import {operatePaymentRecovery as recover} from '../../app/lib/payment-recovery.ts';
import {operateEmployeePayment} from '../../app/lib/employee-payments.ts';
import {operatePartnerPayment} from '../../app/lib/partner-payments.ts';
export async function paymentExecutionJourney({kind,database,db,maker,owner,finance,officer,headers,runtime,reference,recipient,input}){
 const operate=kind==='employee'?operateEmployeePayment:operatePartnerPayment;
 const current=()=>database.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).get(reference),original={...current()};
 let posts=0,status='success',timeout=false;
 const raw=()=>({id:1987,transfer_code:'TRF_livefixture001',reference,domain:'live',amount:original.amount_cents,currency:'ZAR',source:'balance',recipient:123,integration:456,status});
 const transport=async(url,options)=>{
  assert.equal(options.redirect,'manual');assert.match(options.headers.Authorization,/^Bearer sk_live_/);
  if(url.includes('/transferrecipient/'))return Response.json({status:true,data:recipient});
  if(url.endsWith('/balance'))return Response.json({status:true,data:[{currency:'ZAR',balance:original.amount_cents+500}]});
  if(url.endsWith('/transfer')){posts++;assert.equal(JSON.parse(options.body).reference,reference);if(timeout)throw Error('timeout after accepted');return Response.json({status:true,data:raw()});}
  assert.equal(url,'https://api.paystack.co/transfer/verify/'+reference);return Response.json({status:true,data:raw()});
 };
 const command=(action,patch={})=>({action,kind,reference,sourceHash:original.source_hash,version:current().version,evidenceReviewed:true,note:'Isolated funds, authority and exact payment evidence review.',...patch});
 const call=(action,patch={},actor=finance,run=runtime,network=transport)=>execute(db,actor,command(action,patch),headers,run,network);
 const signed=async(event='transfer.'+status,patch={},secret=runtime.PAYSTACK_LIVE_SECRET_KEY)=>{
  const body=JSON.stringify({event,data:{...raw(),...patch}}),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);
  const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');
  return receiveLiveTransferWebhook(new Request('https://fixture/api/paystack/transfers/live/webhook',{method:'POST',headers:{'x-paystack-signature':signature},body}),db,runtime);
 };
 const oldBatch=db.batch;
 db.batch=async statements=>{database.exec('SAVEPOINT execution_batch');try{const r=statements.map(s=>s.runSync());database.exec('RELEASE execution_batch');return r;}catch(e){database.exec('ROLLBACK TO execution_batch; RELEASE execution_batch');throw e;}};
 const scenario=async(name,fn)=>{database.exec('SAVEPOINT execution_case');try{await fn();}catch(e){e.message=kind+' '+name+': '+e.message;throw e;}finally{db.afterRead=null;database.exec('ROLLBACK TO execution_case; RELEASE execution_case');status='success';timeout=false;}};
 const authorize=async()=>{
  const reserve=await call('prepare_payment_reserve',{requestKey:'reserve-'+kind,integrationId:'456',amountCents:original.amount_cents+500,fundingReference:'bank:unique-fixture-allocation-'+kind,fundingHash:'a'.repeat(64),capabilityReference:'fixture:provider-capability',capabilityHash:'c'.repeat(64)},maker);
  const r=database.prepare('SELECT * FROM payment_live_reserves WHERE id=?').get(reserve.reserveId);
  await assert.rejects(()=>call('approve_payment_reserve',{reserveId:r.id,payloadHash:r.payload_hash},maker),/maker|Independent/);
  await call('approve_payment_reserve',{reserveId:r.id,payloadHash:r.payload_hash});
  const release=await call('prepare_live_release',{requestKey:'release-'+kind,reserveId:r.id,feeCeilingCents:500,mandateHash:'b'.repeat(64),acceptanceReference:'fixture:independent-release'},maker);
  const l=database.prepare('SELECT * FROM payment_live_releases WHERE id=?').get(release.releaseId);
  await assert.rejects(()=>call('approve_live_release',{releaseId:l.id,payloadHash:l.payload_hash},maker),/maker|Independent/);
  await call('approve_live_release',{releaseId:l.id,payloadHash:l.payload_hash});return {reserve:r,release:l};
 };
 const enable=()=>database.prepare('UPDATE payment_live_control SET enabled=1 WHERE id=1').run();
 const live={...runtime,LOKD_LIVE_PAYMENTS_ENABLED:'true'};
 const financial=()=>database.prepare(`SELECT * FROM ${kind}_payment_financial_state WHERE reference=?`).get(reference);
 await scenario('default locks, independent authority and no key-only bypass',async()=>{
  await assert.rejects(()=>call('prepare_payment_reserve',{},officer),/Operations/);
  const {release}=await authorize();
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id}),e=>e.status===423);
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id},finance,live),e=>e.status===423);
  enable();await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id}),e=>e.status===423);
  assert.equal(current().status,'approved');assert.equal(posts,0);
 });
 await scenario('one durable claim, timeout, paid reconciliation and reversal history',async()=>{
  const {reserve,release}=await authorize();
  const documentKind=kind==='employee'?'payslip':'remittance',documentSource=original[kind==='employee'?'payroll_item_id':'payable_id'];
  const {readFinanceDocuments}=await import('../../app/lib/finance-documents.ts');
  assert.equal((await readFinanceDocuments(db,finance,headers)).sources.find(s=>s.kind===documentKind&&s.source_id===documentSource).currentState,'pending');
  enable();timeout=true;
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id},finance,live),/uncertain/);
  assert.equal(current().status,'dispatch_claimed');assert.equal(posts,1);
  assert.equal(database.prepare('SELECT remaining_cents FROM payment_live_reserve_current WHERE id=?').get(reserve.id).remaining_cents,0);
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id},finance,live),/cannot be resubmitted/);
  await assert.rejects(()=>operate(db,finance,{action:`cancel_${kind}_payment`,reference,version:current().version,sourceHash:original.source_hash,note:'No cancellation after claim'},headers,runtime,transport),/cannot be repeated/);
  assert.equal(financial().financial_state,'held');
  await assert.rejects(()=>signed('transfer.success',{},runtime.PAYSTACK_TEST_SECRET_KEY),/signature/);
  await assert.rejects(()=>signed('transfer.success',{domain:'test'}),/explicit live/);
  await signed();await signed();assert.equal(database.prepare(`SELECT count(*) n FROM ${kind}_transfer_observations WHERE reference=? AND source='webhook'`).get(reference).n,1);
  await call('verify_live_payment');
  assert.equal(financial().financial_state,'held','provider success alone is not paid');
  const prep=()=>call('prepare_live_reconciliation',{requestKey:'reconcile-success-'+kind,bankReference:'bank:debit-'+kind,bankHash:'d'.repeat(64),bankAmountCents:original.amount_cents+100},maker);
  const prepared=await prep(),review=database.prepare('SELECT * FROM payment_live_reconciliation_reviews WHERE id=?').get(prepared.reviewId);
  await assert.rejects(()=>call('approve_live_reconciliation',{reviewId:review.id,payloadHash:review.payload_hash},maker),/maker|Independent/);
  const decisions=await Promise.allSettled([call('approve_live_reconciliation',{reviewId:review.id,payloadHash:review.payload_hash}),call('approve_live_reconciliation',{reviewId:review.id,payloadHash:review.payload_hash})]);assert.equal(decisions.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(financial().financial_state,'paid');assert.equal(financial().paid_receipts,1);
  const {operateProduction}=await import('../../app/lib/production-operations.ts');
  await operateProduction(db,owner,{action:'grant_operator',email:maker.email,role:'payroll_preparer',limitCents:25000000},headers);
  const {financeDocumentJourney}=await import('./finance-document-journey.mjs');
  const document=await financeDocumentJourney({db,database,maker,finance,recipient:kind==='employee'?officer:{userId:'partner-representative-user',email:'partner@example.test',operations:false},kind:documentKind,sourceId:documentSource,headers});
  assert.equal((await document.read()).documents[0].asIssuedState,'paid');
  await call('verify_live_payment');assert.equal(financial().financial_state,'paid','fresh identical evidence preserves historical receipt');
  const {prepareFinanceDocument,decideFinanceDocument}=await import('../../app/lib/finance-documents.ts');
  const latest=database.prepare('SELECT * FROM finance_document_versions WHERE kind=? AND source_id=? ORDER BY version DESC LIMIT 1').get(documentKind,documentSource);
  const pending=await prepareFinanceDocument(db,maker,{kind:documentKind,sourceId:documentSource,parentId:latest.id,requestKey:'stale-document-'+kind,evidenceReviewed:true,note:'Review paid evidence before the later reversal.'},headers);
  const frozen=database.prepare('SELECT * FROM finance_document_versions WHERE id=?').get(pending.documentId);
  status='reversed';await signed();assert.equal(financial().financial_state,'held');assert.equal((await document.read()).documents[0].currentState,'held');await call('verify_live_payment');
  await assert.rejects(()=>decideFinanceDocument(db,finance,{documentId:frozen.id,payloadHash:frozen.payload_hash,decision:'approved',evidenceReviewed:true,note:'Attempt stale paid issue after signed reversal.'},headers),/current document approval/);
  assert.equal(database.prepare('SELECT count(*) AS n FROM finance_document_issues WHERE document_id=?').get(frozen.id).n,0);
  await decideFinanceDocument(db,finance,{documentId:frozen.id,payloadHash:frozen.payload_hash,decision:'rejected',evidenceReviewed:true,note:'Reject stale evidence while retaining the original history.'},headers);
  const alias=await call('prepare_live_reconciliation',{requestKey:'reused-bank-proof-'+kind,bankReference:'bank:alias-return-'+kind,bankHash:'d'.repeat(64),bankAmountCents:original.amount_cents},maker),aliased=database.prepare('SELECT * FROM payment_live_reconciliation_reviews WHERE id=?').get(alias.reviewId);
  await assert.rejects(()=>call('approve_live_reconciliation',{reviewId:aliased.id,payloadHash:aliased.payload_hash}),/exact final evidence changed/);
  const reversal=await call('prepare_live_reconciliation',{requestKey:'reconcile-reversal-'+kind,bankReference:'bank:return-'+kind,bankHash:'e'.repeat(64),bankAmountCents:original.amount_cents},maker),rev=database.prepare('SELECT * FROM payment_live_reconciliation_reviews WHERE id=?').get(reversal.reviewId);
  await call('approve_live_reconciliation',{reviewId:rev.id,payloadHash:rev.payload_hash});assert.equal(financial().financial_state,'reversed');assert.equal(financial().paid_receipts,1);
  assert.equal((await document.read()).documents[0].currentState,'reversed');assert.equal((await document.read()).documents[0].asIssuedState,'paid');
  const terminal=database.prepare(`SELECT * FROM ${kind}_recovery_terminal WHERE reference=?`).get(reference);
  const recovery={...command('propose_live_disposition'),evidenceId:terminal.evidence_id,disposition:'reversed'};
  const p=await recover(db,maker,recovery,headers),a=await recover(db,finance,{...recovery,action:'approve_live_disposition',proposalId:p.proposalId},headers);
  const child=await operate(db,maker,{...input,destinationId:original.destination_id,requestKey:'live-replacement-'+kind,replacesReference:reference,recoveryApprovalId:a.approvalId},headers,runtime,transport);
  assert.equal(database.prepare(`SELECT mode FROM ${kind}_payment_instructions WHERE reference=?`).get(child.reference).mode,'live');
  assert.equal(database.prepare('SELECT remaining_cents FROM payment_live_reserve_current WHERE id=?').get(reserve.id).remaining_cents,0,'reversal does not silently replenish allocated funds');
  for(const table of ['payment_live_claims','payment_live_reserves','payment_live_reserve_decisions','payment_live_releases','payment_live_release_decisions','payment_live_reconciliation_reviews','payment_live_reconciliation_decisions'])assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);
 });
 await scenario('concurrent submission uses one claim and one POST',async()=>{
  const {release}=await authorize();enable();const before=posts;
  const outcomes=await Promise.allSettled([call('dispatch_live_payment',{releaseId:release.id},finance,live),call('dispatch_live_payment',{releaseId:release.id},finance,live)]);
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(posts,before+1);
 });
 await scenario('recipient and authority changed before claim',async()=>{
  const {release}=await authorize();enable();const before=posts;
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id},finance,live,async(url,options)=>url.includes('/transferrecipient/')?Response.json({status:true,data:{...recipient,integration:999}}):transport(url,options)),/recipient/);
  const network=async(url,options)=>{const response=await transport(url,options);if(url.endsWith('/balance'))database.prepare("UPDATE operator_accounts SET status='suspended' WHERE email=?").run(maker.email);return response;};
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id},finance,live,network),/authority changed/);
  assert.equal(current().status,'approved');assert.equal(posts,before);
 });
 await scenario('insufficient balance, reused allocation and participant authority',async()=>{
  const {reserve,release}=await authorize();enable();const before=posts;
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id},{...finance,userId:officer.userId},live),/participants/);
  await assert.rejects(()=>call('dispatch_live_payment',{releaseId:release.id},finance,live,async(url,options)=>url.endsWith('/balance')?Response.json({status:true,data:[{currency:'ZAR',balance:original.amount_cents}]}):transport(url,options)),/balance does not cover/);
  await assert.rejects(()=>call('prepare_payment_reserve',{requestKey:'duplicate-reserve-'+kind,integrationId:'456',amountCents:original.amount_cents+500,fundingReference:reserve.funding_reference,fundingHash:'a'.repeat(64),capabilityReference:'fixture:provider-capability',capabilityHash:'c'.repeat(64)},maker),/UNIQUE/);
  await assert.rejects(()=>call('prepare_payment_reserve',{requestKey:'aliased-reserve-'+kind,integrationId:'456',amountCents:original.amount_cents+500,fundingReference:'bank:renamed-same-funds-'+kind,fundingHash:'a'.repeat(64),capabilityReference:'fixture:provider-capability',capabilityHash:'c'.repeat(64)},maker),/UNIQUE/);
  assert.equal(current().status,'approved');assert.equal(posts,before);
 });
 await scenario('event during live verification cannot endorse an older response',async()=>{
  const {release}=await authorize();enable();await call('dispatch_live_payment',{releaseId:release.id},finance,live);await signed();
  await assert.rejects(()=>call('verify_live_payment',{},finance,runtime,async(url,options)=>{const response=await transport(url,options);status='reversed';await signed();return response;}),/webhook evidence changed/);
  assert.equal(financial().financial_state,'held');
 });
 await scenario('stale reconciliation and wrong identity remain held',async()=>{
  const {release}=await authorize();enable();await call('dispatch_live_payment',{releaseId:release.id},finance,live);await signed();await call('verify_live_payment');
  const p=await call('prepare_live_reconciliation',{requestKey:'stale-reconcile-'+kind,bankReference:'bank:stale-'+kind,bankHash:'d'.repeat(64),bankAmountCents:original.amount_cents},maker),r=database.prepare('SELECT * FROM payment_live_reconciliation_reviews WHERE id=?').get(p.reviewId);
  await signed('transfer.success',{amount:original.amount_cents+1});
  await assert.rejects(()=>call('approve_live_reconciliation',{reviewId:r.id,payloadHash:r.payload_hash}),/exact final evidence changed/);assert.equal(financial().financial_state,'held');
 });
 db.batch=oldBatch;assert.deepEqual({...current()},original);assert.equal(database.prepare('SELECT enabled FROM payment_live_control').get().enabled,0);
}
