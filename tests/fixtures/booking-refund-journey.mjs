import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {operateBookingRefund,readBookingRefunds} from '../../app/lib/booking-refunds.ts';
import {receiveBookingCollectionWebhook} from '../../app/lib/booking-collections.ts';
export async function bookingRefundJourney({database,db,reviewer,owner,applicant,headers,collection,transaction,runtime}){
 const scalar=sql=>database.prepare(sql).get();
 const ref=collection.reference,mode=collection.mode,amount=collection.amount_minor;
 const savedFunding=JSON.stringify(database.prepare('SELECT * FROM booking_funding_reconciliations WHERE provider_reference=?').get(ref));
 const secret=mode==='test'?runtime.PAYSTACK_TEST_SECRET_KEY:runtime.PAYSTACK_LIVE_SECRET_KEY;
 const run=(a,input,transport=async()=>{throw Error('Unexpected network call');},rt=runtime)=>operateBookingRefund(db,a,{reference:ref,...input},headers,rt,transport);
 const request={action:'prepare_refund_case',requestKey:'fixture-refund-'+mode,intent:'refund',evidenceReviewed:true,liabilitiesReviewed:true,policyReference:'fixture-approved-policy',policyHash:'a'.repeat(64),evidenceHash:'b'.repeat(64),liabilityPlan:'Hold funding. Existing service and earned payroll remain payable pending separate review.',note:'Local fixture full refund, no actual customer or bank.'};
 const scenario=async fn=>{database.exec('SAVEPOINT refund_scenario');try{await fn();}finally{database.exec('ROLLBACK TO refund_scenario; RELEASE refund_scenario');}};
 const {operateCreditNote,readCreditNotes}=await import('../../app/lib/credit-notes.ts');
 const oldBatch=db.batch;db.batch=async statements=>{database.exec('SAVEPOINT refund_batch');try{const results=statements.map(s=>s.runSync());database.exec('RELEASE refund_batch');return results;}catch(e){database.exec('ROLLBACK TO refund_batch; RELEASE refund_batch');throw e;}};
 const {operateProduction}=await import('../../app/lib/production-operations.ts');
 await operateProduction(db,owner,{action:'grant_operator',email:reviewer.email,role:'finance_approver',limitCents:25000000},headers);
 const invoice=database.prepare('SELECT * FROM credit_note_sources WHERE booking_id=?').get(collection.order_id);
 const prepare=async(net=invoice.subtotal_cents,tax=invoice.tax_cents,suffix='full',externalRefundId)=>{
 request.requestKey='fixture-refund-'+mode+'-'+suffix;
 if(externalRefundId)request.externalRefundId=externalRefundId;else delete request.externalRefundId;
 const creditInput={...request,action:'prepare_credit_note',invoiceId:invoice.invoice_id,netCents:net,taxCents:tax,taxReference:'fixture-reviewed-tax',taxHash:'e'.repeat(64)};
 const credit=await operateCreditNote(db,reviewer,creditInput,headers),row=database.prepare('SELECT * FROM credit_notes WHERE id=?').get(credit.creditId);
 await assert.rejects(()=>operateCreditNote(db,reviewer,{...creditInput,action:'approve_credit_note',creditId:row.id,payloadHash:row.payload_hash},headers),/maker|Independent/i);
 await operateCreditNote(db,owner,{...creditInput,action:'approve_credit_note',creditId:row.id,payloadHash:row.payload_hash},headers);
 assert.ok((await readCreditNotes(db,applicant,headers,invoice.invoice_id)).creditNotes.some(n=>n.id===credit.creditId));
 await assert.rejects(()=>readCreditNotes(db,{...applicant,userId:'other-client'},headers,invoice.invoice_id),/not found/);
 request.creditNoteId=credit.creditId;
 const p=await run(reviewer,request);const c=database.prepare('SELECT * FROM booking_refund_cases WHERE id=?').get(p.caseId);return c;};
 const approve=async(c,a=owner)=>run(a,{action:'approve_refund_case',caseId:c.id,payloadHash:c.payload_hash,evidenceReviewed:true,note:'Independent fixture review of source, funds and liabilities.'});
 const dispatch=c=>({action:'dispatch_refund',caseId:c.id,payloadHash:c.payload_hash,evidenceReviewed:true});
 const refund=(c,status='processed')=>({id:80001+Number(JSON.parse(c.payload_json).amountMinor!==amount),integration:456,transaction:Number(collection.provider_id),domain:mode,currency:'ZAR',amount:JSON.parse(c.payload_json).amountMinor,status,merchant_note:c.id,fully_deducted:status==='processed',deducted_amount:status==='processed'?JSON.parse(c.payload_json).amountMinor:0});
 const event=async(c,changes={})=>{const body=JSON.stringify({event:'refund.processed',data:{...refund(c),...changes}});return receiveBookingCollectionWebhook(new Request('https://lokd.co.za/api/paystack/booking/webhook',{method:'POST',body,headers:{'x-paystack-signature':createHmac('sha512',secret).update(body).digest('hex')}}),db,runtime,mode);};
 const enable=()=>database.exec('UPDATE booking_refund_control SET enabled=1; UPDATE payment_live_control SET enabled=1');
 const unlocked={...runtime,LOKD_LIVE_REFUNDS_ENABLED:'true',LOKD_LIVE_PAYMENTS_ENABLED:'true'};
 await scenario(async()=>{
  await assert.rejects(()=>run(applicant,request),/Operations/);
  const c=await prepare();assert.equal((await run(reviewer,request)).caseId,c.id);
  await assert.rejects(()=>run(reviewer,{...request,note:'Different findings'}),/different/);
  await assert.rejects(()=>approve(c,reviewer),/maker|independent/i);
  const decisions=await Promise.allSettled([approve(c),approve(c)]);assert.equal(decisions.filter(r=>r.status==='fulfilled').length,1);
  if(mode==='live'){
   await assert.rejects(()=>run(owner,dispatch(c)),/locked/);
   await assert.rejects(()=>run(owner,dispatch(c),undefined,unlocked),/locked/);
   enable();await assert.rejects(()=>run(owner,dispatch(c)),/locked/);
   for(const flag of ['LOKD_LIVE_PAYMENTS_ENABLED','LOKD_LIVE_REFUNDS_ENABLED'])await assert.rejects(()=>run(owner,dispatch(c),undefined,{...unlocked,[flag]:'false'}),/locked/);
   for(const table of ['payment_live_control','booking_refund_control']){database.exec('UPDATE '+table+' SET enabled=0');await assert.rejects(()=>run(owner,dispatch(c),undefined,unlocked),/locked/);database.exec('UPDATE '+table+' SET enabled=1');}

  }
  let posts=0;const tx=async(url)=>{if(url.endsWith('/refund')){posts++;assert.equal(scalar('SELECT count(*) n FROM booking_refund_claims').n,1);throw Error('Timeout after accepted request');}return Response.json({status:true,data:transaction});};
  await assert.rejects(()=>run(owner,dispatch(c),tx,unlocked),/uncertain/);assert.equal(posts,1);
  await assert.rejects(()=>run(owner,dispatch(c),tx,unlocked),/claim/);assert.equal(posts,1);

  assert.equal(scalar('SELECT count(*) n FROM booking_refund_claims').n,1);
  // Unknown delivery is recovered by fetching a provider ID, but can only reconcile its exact original merchant note and collection binding.
  await run(owner,{action:'verify_refund',caseId:c.id,refundId:'80001'},async()=>Response.json({status:true,data:refund(c)}));
  const receipt={action:'prepare_refund_receipt',caseId:c.id,evidenceReviewed:true,bankReference:'fixture-bank-'+mode,bankHash:'c'.repeat(64),bankAmountMinor:amount,note:'Isolated full bank debit evidence.'};
  await assert.rejects(()=>run(reviewer,receipt),/signed/);
  await event(c);const n=database.prepare('SELECT count(*) n FROM booking_collection_recoveries WHERE reference=?').get(ref).n;await event(c);assert.equal(database.prepare('SELECT count(*) n FROM booking_collection_recoveries WHERE reference=?').get(ref).n,n);
  await assert.rejects(()=>run(reviewer,receipt),/signed/); // old verification watermark
  await run(owner,{action:'verify_refund',caseId:c.id,refundId:'80001'},async()=>Response.json({status:true,data:refund(c)}));
  const old=database.prepare('SELECT * FROM booking_refund_observations WHERE case_id=? ORDER BY rowid DESC LIMIT 1').get(c.id);
  database.prepare('INSERT INTO booking_refund_observations VALUES(?,?,?,?,?,?)').run('stale-'+mode,c.id,'verify',old.evidence_json,old.hold_watermark,new Date(Date.now()-6*60000).toISOString());
  await assert.rejects(()=>run(reviewer,receipt),/Fresh exact/);
  await run(owner,{action:'verify_refund',caseId:c.id,refundId:'80001'},async()=>Response.json({status:true,data:refund(c)}));
  const prepared=await run(reviewer,receipt),r=database.prepare('SELECT * FROM booking_refund_receipts WHERE id=?').get(prepared.receiptId);
  const decision={action:'approve_refund_receipt',caseId:c.id,receiptId:r.id,payloadHash:r.payload_hash,evidenceReviewed:true,note:'Independent bank and provider refund evidence approved.'};
  await assert.rejects(()=>run(reviewer,decision),/maker|independent/i);
  // A second receipt cannot spend the same final result/bank proof, even if it renames the reference.
  const duplicate=await run(reviewer,{...receipt,bankReference:'renamed-bank-'+mode});
  const duplicateRow=database.prepare('SELECT * FROM booking_refund_receipts WHERE id=?').get(duplicate.receiptId);
  const settled=await Promise.allSettled([run(owner,decision),run(owner,decision)]);assert.equal(settled.filter(r=>r.status==='fulfilled').length,1);
  await assert.rejects(()=>run(owner,{...decision,receiptId:duplicateRow.id,payloadHash:duplicateRow.payload_hash}),/already reconciled/);
  const state=database.prepare('SELECT * FROM booking_refund_state WHERE reference=?').get(ref);assert.equal(state.state,mode==='test'?'test_refund_confirmed':'refunded_funding_held');assert.equal(state.funding_available,0);assert.equal(state.liabilities_cancelled,0);
  // Historical approval survives, but a new contradictory event holds the current projection.
  await assert.rejects(()=>run(owner,{action:'verify_refund',caseId:c.id,refundId:'80001'},async()=>Response.json({status:false},{status:404})),/unavailable/);
  assert.equal(database.prepare('SELECT state FROM booking_refund_state WHERE reference=?').get(ref).state,'reconciled_history_currently_held');
  await event(c,{status:'failed',amount:amount-1});
  assert.equal(database.prepare('SELECT state FROM booking_refund_state WHERE reference=?').get(ref).state,'reconciled_history_currently_held');
  assert.equal(scalar('SELECT count(*) n FROM booking_refund_receipt_decisions').n,1);
  for(const table of ['cases','decisions','claims','observations','receipts','receipt_decisions']){
   assert.throws(()=>database.exec(`DELETE FROM booking_refund_${table}`),/immutable/);
  }
  assert.equal((await readBookingRefunds(db,owner,headers,runtime)).liveRefundsEnabled,false);
 });
 await scenario(async()=>{
  const c=await prepare();await approve(c);enable();let posts=0;
  const tx=async url=>{if(url.endsWith('/refund')){posts++;return Response.json({status:true,data:refund(c,'pending')});}return Response.json({status:true,data:transaction});};
  const attempts=await Promise.allSettled([run(owner,dispatch(c),tx,unlocked),run(owner,dispatch(c),tx,unlocked)]);assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);assert.equal(posts,1);
  await event(c);await run(owner,{action:'verify_refund',caseId:c.id,refundId:'80001'},async()=>Response.json({status:true,data:{...refund(c),amount:amount-1}}));
  assert.equal(scalar('SELECT count(*) n FROM booking_refund_final_evidence').n,0);
  await run(owner,{action:'verify_refund',caseId:c.id,refundId:'80001'},async()=>Response.json({status:true,data:refund(c)}));assert.equal(scalar('SELECT count(*) n FROM booking_refund_final_evidence').n,0); // contradiction cannot be washed away
 });
 await scenario(async()=>{
  const c=await prepare();await approve(c);enable();let posts=0;
  await assert.rejects(()=>run(owner,dispatch(c),async url=>{if(url.endsWith('/refund'))posts++;database.prepare("UPDATE operator_accounts SET status='suspended' WHERE id=?").run(c.operator_id);return Response.json({status:true,data:transaction});},unlocked),/approval changed|remains held/);assert.equal(posts,0);assert.equal(scalar('SELECT count(*) n FROM booking_refund_claims').n,0);
 });
 await scenario(async()=>{
  const c=await prepare();await approve(c);enable();let posts=0;
  await assert.rejects(()=>run(owner,dispatch(c),async url=>{if(url.endsWith('/refund'))posts++;await event(c);return Response.json({status:true,data:transaction});},unlocked),/approval changed|remains held/);assert.equal(posts,0);
 });
 await scenario(async()=>{
  const c=await prepare();
  const outsider={...owner,email:'ungranted-refund@example.test',userId:'ungranted-refund'};
  await assert.rejects(()=>approve(c,outsider),/operator account/);
  // A newly recorded hold invalidates the old source snapshot before approval.
  database.prepare("INSERT INTO booking_collection_recoveries VALUES(?,?,'operations','manual_hold',?,?,?,?)").run('later-'+mode,ref,'d'.repeat(64),'{}',owner.userId,new Date().toISOString());
  await assert.rejects(()=>approve(c),/current refund/);
 });
 await scenario(async()=>{
  const firstNet=Math.floor(invoice.subtotal_cents/3),firstTax=Math.floor(invoice.tax_cents/3);
  const first=await prepare(firstNet,firstTax,'partial-one');await approve(first);enable();
  const firstAmount=JSON.parse(first.payload_json).amountMinor;
  const tx=async(url)=>Response.json({status:true,data:url.endsWith('/refund')?refund(first,'pending'):transaction});
  await run(owner,dispatch(first),tx,unlocked);
  const creditRow=database.prepare('SELECT * FROM credit_notes WHERE id=?').get(JSON.parse(first.payload_json).creditNoteId);
  const voidInput={action:'prepare_credit_note',invoiceId:invoice.invoice_id,reversesId:creditRow.id,netCents:firstNet,taxCents:firstTax,requestKey:'void-claimed-'+mode,evidenceReviewed:true,liabilitiesReviewed:true,policyReference:'fixture-credit-policy',policyHash:'a'.repeat(64),taxReference:'fixture-tax',taxHash:'b'.repeat(64),liabilityPlan:'Retain earned liabilities.',note:'Cannot void a credit committed to a refund.'};
  const voided=await operateCreditNote(db,reviewer,voidInput,headers),voidRow=database.prepare('SELECT * FROM credit_notes WHERE id=?').get(voided.creditId);
  await assert.rejects(()=>operateCreditNote(db,owner,{...voidInput,action:'approve_credit_note',creditId:voidRow.id,payloadHash:voidRow.payload_hash},headers),/cannot be reversed/);
  const sparse={event:'refund.processed',data:{transaction_reference:ref,refund_reference:null,amount:String(firstAmount),currency:'ZAR',domain:mode,status:'processed',integration:456}};
  const raw=JSON.stringify(sparse);await receiveBookingCollectionWebhook(new Request('https://lokd.co.za/api/paystack/booking/webhook',{method:'POST',body:raw,headers:{'x-paystack-signature':createHmac('sha512',secret).update(raw).digest('hex')}}),db,runtime,mode);
  await run(owner,{action:'verify_refund',caseId:first.id,refundId:'80002'},async()=>Response.json({status:true,data:refund(first)}));
  const settlePartial=async(c,bank)=>{const p=await run(reviewer,{action:'prepare_refund_receipt',caseId:c.id,evidenceReviewed:true,bankReference:bank,bankHash:(bank.endsWith('one')?'1':'2').repeat(64),bankAmountMinor:JSON.parse(c.payload_json).amountMinor,note:'Exact independent partial debit evidence.'});const r=database.prepare('SELECT * FROM booking_refund_receipts WHERE id=?').get(p.receiptId);await run(owner,{action:'approve_refund_receipt',caseId:c.id,receiptId:r.id,payloadHash:r.payload_hash,evidenceReviewed:true,note:'Exact partial reconciliation approved.'});};
  await settlePartial(first,'bank-partial-one');
  assert.equal(database.prepare('SELECT reconciled_minor FROM booking_refund_accounting WHERE reference=?').get(ref).reconciled_minor,firstAmount);
  assert.equal(database.prepare('SELECT state FROM booking_refund_state WHERE reference=?').get(ref).state,mode==='test'?'test_refund_confirmed':'partially_refunded_funding_held');
  const second=await prepare(invoice.subtotal_cents-firstNet,invoice.tax_cents-firstTax,'partial-two');await approve(second);
  const secondRefund=(status='processed')=>({...refund(second,status),id:80003});
  await run(owner,dispatch(second),async url=>Response.json({status:true,data:url.endsWith('/refund')?secondRefund('pending'):transaction}),unlocked);
  const body=JSON.stringify({event:'refund.processed',data:secondRefund()});await receiveBookingCollectionWebhook(new Request('https://lokd.co.za/api/paystack/booking/webhook',{method:'POST',body,headers:{'x-paystack-signature':createHmac('sha512',secret).update(body).digest('hex')}}),db,runtime,mode);
  await run(owner,{action:'verify_refund',caseId:second.id,refundId:'80003'},async()=>Response.json({status:true,data:secondRefund()}));
  await settlePartial(second,'bank-partial-two');
  const accounted=database.prepare('SELECT * FROM booking_refund_accounting WHERE reference=?').get(ref);assert.equal(accounted.reconciled_minor,amount);assert.equal(accounted.currently_held,0);
  assert.equal(database.prepare('SELECT state FROM document_invoice_payment_states WHERE reference=?').get(ref).state,mode==='test'?'held':'reversed');
  await assert.rejects(()=>prepare(1,0,'over-credit'),/capacity/);
  assert.equal(database.prepare('SELECT enabled FROM payment_live_control').get().enabled,1); // synthetic scenario only; rollback restores default
 });
 await scenario(async()=>{
  const c=await prepare(undefined,undefined,'existing','1');await approve(c);
  const existing={...refund(c),id:1,merchant_note:'Provider originated reviewed refund'};
  const body=JSON.stringify({event:'refund.processed',data:existing});await receiveBookingCollectionWebhook(new Request('https://lokd.co.za/api/paystack/booking/webhook',{method:'POST',body,headers:{'x-paystack-signature':createHmac('sha512',secret).update(body).digest('hex')}}),db,runtime,mode);
  // The event invalidates the prepared case. Prepare another exact current case, retaining the same issued credit.
  request.requestKey+='-fresh';const fresh=await run(reviewer,request),adopt=database.prepare('SELECT * FROM booking_refund_cases WHERE id=?').get(fresh.caseId);await approve(adopt);
  let posts=0;await run(owner,{action:'adopt_refund',caseId:adopt.id,payloadHash:adopt.payload_hash,evidenceReviewed:true},async(url,options)=>{if(options.method==='POST')posts++;return Response.json({status:true,data:existing});});assert.equal(posts,0);
  let gets=0;const lookup=async(url,options)=>{gets++;assert.equal(options.method,'GET');assert.equal(url,'https://api.paystack.co/refund/1');return Response.json({status:true,data:existing});};
  for(const refundId of ['0','01','1/2','1 ','9'.repeat(41),1])await assert.rejects(()=>run(owner,{action:'verify_refund',caseId:adopt.id,refundId},lookup),/positive numeric/);assert.equal(gets,0);
  await run(owner,{action:'verify_refund',caseId:adopt.id,refundId:'1'},lookup);assert.equal(gets,1);
  assert.equal(database.prepare('SELECT count(*) AS n FROM booking_refund_final_evidence WHERE case_id=?').get(adopt.id).n,1);
  const receipt=await run(reviewer,{action:'prepare_refund_receipt',caseId:adopt.id,evidenceReviewed:true,bankReference:'adopted-bank-'+mode,bankHash:'9'.repeat(64),bankAmountMinor:amount,note:'Existing provider refund reconciles exact bank debit.'});
  const row=database.prepare('SELECT * FROM booking_refund_receipts WHERE id=?').get(receipt.receiptId);
  await run(owner,{action:'approve_refund_receipt',caseId:adopt.id,receiptId:row.id,payloadHash:row.payload_hash,evidenceReviewed:true,note:'Independent adoption and bank evidence accepted.'});
  assert.equal(database.prepare('SELECT reconciled_minor FROM booking_refund_accounting WHERE reference=?').get(ref).reconciled_minor,amount);
  await assert.rejects(()=>run(owner,dispatch(adopt)),/never create another/);
 });
 await scenario(async()=>{
  const original=await prepare(undefined,undefined,'credit-correction'),creditId=JSON.parse(original.payload_json).creditNoteId;
  const before=JSON.stringify(database.prepare('SELECT * FROM credit_notes WHERE id=?').get(creditId));
  const input={action:'prepare_credit_note',invoiceId:invoice.invoice_id,reversesId:creditId,netCents:invoice.subtotal_cents,taxCents:invoice.tax_cents,requestKey:'void-unclaimed-'+mode,evidenceReviewed:true,liabilitiesReviewed:true,policyReference:'fixture-credit-policy',policyHash:'a'.repeat(64),taxReference:'fixture-tax',taxHash:'b'.repeat(64),liabilityPlan:'Retain liabilities; reverse only the unclaimed credit.',note:'Correct an unclaimed credit by a separately numbered reversal.'};
  const prepared=await operateCreditNote(db,reviewer,input,headers),row=database.prepare('SELECT * FROM credit_notes WHERE id=?').get(prepared.creditId);
  const decision={...input,action:'approve_credit_note',creditId:row.id,payloadHash:row.payload_hash};
  const outcomes=await Promise.allSettled([operateCreditNote(db,owner,decision,headers),operateCreditNote(db,owner,decision,headers)]);assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await readCreditNotes(db,applicant,headers,invoice.invoice_id)).invoice.credited_cents,0);
  assert.equal(JSON.stringify(database.prepare('SELECT * FROM credit_notes WHERE id=?').get(creditId)),before);
  const corrected=await prepare(undefined,undefined,'corrected-reissue');assert.notEqual(JSON.parse(corrected.payload_json).creditNoteId,creditId);
  assert.equal((await readCreditNotes(db,applicant,headers,invoice.invoice_id)).invoice.credited_cents,amount);
  for(const table of ['credit_notes','credit_note_decisions','credit_note_issues']){assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);assert.throws(()=>database.exec('UPDATE '+table+' SET '+(table==='credit_notes'?'payload_hash=payload_hash':table==='credit_note_decisions'?'note=note':'number=number')),/immutable/);}
 });
 await scenario(async()=>{
  const input={action:'prepare_credit_note',invoiceId:invoice.invoice_id,netCents:invoice.subtotal_cents,taxCents:invoice.tax_cents,evidenceReviewed:true,liabilitiesReviewed:true,policyReference:'fixture-credit-policy',policyHash:'a'.repeat(64),taxReference:'fixture-tax',taxHash:'b'.repeat(64),liabilityPlan:'Retain all earned liabilities.',note:'Competing full credits cannot exceed the original invoice.'};
  const left=await operateCreditNote(db,reviewer,{...input,requestKey:'race-left-'+mode},headers),right=await operateCreditNote(db,reviewer,{...input,requestKey:'race-right-'+mode},headers);
  const approveCredit=async id=>{const c=database.prepare('SELECT * FROM credit_notes WHERE id=?').get(id);return operateCreditNote(db,owner,{...input,action:'approve_credit_note',creditId:id,payloadHash:c.payload_hash},headers);};
  const results=await Promise.allSettled([approveCredit(left.creditId),approveCredit(right.creditId)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await readCreditNotes(db,applicant,headers,invoice.invoice_id)).invoice.credited_cents,amount);
  const {GET}=await import('../../app/api/credit-notes/route.ts'),{env}=await import('cloudflare:workers');const saved=env.DB;env.DB=db;
  try{const req=user=>new Request('https://lokd.co.za/api/credit-notes?invoiceId='+invoice.invoice_id,{headers:{'x-lokd-verified-user-id':user,'x-lokd-verified-email':applicant.email}});const ok=await GET(req(applicant.userId));assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'private, no-store');assert.equal((await GET(req('wrong-client'))).status,404);}finally{env.DB=saved;}
 });
 db.batch=oldBatch;
 assert.equal(scalar('SELECT enabled FROM booking_refund_control').enabled,0);
 assert.equal(JSON.stringify(database.prepare('SELECT * FROM booking_funding_reconciliations WHERE provider_reference=?').get(ref)),savedFunding);
}
