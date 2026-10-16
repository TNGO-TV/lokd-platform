import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operateEmployeePayment as operate,readEmployeePayments as read,receiveEmployeeTransferWebhook} from '../../app/lib/employee-payments.ts';
import {operatePaymentDestination} from '../../app/lib/payment-destinations.ts';
import {operateProduction} from '../../app/lib/production-operations.ts';
import {receivePaystackTest} from '../../app/lib/paystack-test.ts';
export async function employeePaymentJourney({database,db,maker,owner,finance,officer,headers,runId}){
 const now=new Date().toISOString(),item=database.prepare('SELECT * FROM payroll_items WHERE payroll_run_id=?').get(runId);
 database.prepare(`INSERT INTO officer_applications(id,pathway,full_name,mobile_normalized,email_normalized,city,province,psira_status,service_interests,training_interests,over_18_confirmed,eligibility_acknowledged,privacy_notice_version,privacy_acknowledged_at,retention_review_at,environment,integrity_state) VALUES('period-officer-case','qualified','Payment Fixture','+27820000888',?,'Sandton','Gauteng','registered','[]','[]',1,1,'fixture',?,?,'prelaunch','user_submitted')`).run(officer.email,now,now);
 database.prepare("INSERT INTO signup_cases VALUES('officer','period-officer-case',?,'reviewed','Fixture','{}',1,'fixture',?)").run(officer.userId,now);
 const runtime={PAYSTACK_TEST_SECRET_KEY:'sk_test_employee_fixture',PAYSTACK_LIVE_SECRET_KEY:'sk_live_employee_fixture'};
 const recipient={id:123,integration:456,recipient_code:'RCP_fixture001',domain:'test',type:'basa',currency:'ZAR',active:true,is_deleted:false,name:'Fixture Employee',updatedAt:'2026-09-01T00:00:00.000Z',details:{account_number:'1234567890',bank_code:'632005',bank_name:'Fixture bank',account_name:'Fixture Employee'}};
 let postCalls=0,lookupCalls=0,uncertain=false,transfer;
 const transport=async(url,options)=>{
  assert.equal(options.redirect,'manual');
  if(url==='https://api.paystack.co/transferrecipient/RCP_fixture001'){lookupCalls++;assert.equal(options.method,'GET');return Response.json({status:true,data:recipient});}
  if(url==='https://api.paystack.co/transfer'){postCalls++;assert.equal(options.method,'POST');const body=JSON.parse(options.body);assert.equal(body.amount,item.net_pay_cents);assert.equal(body.currency,'ZAR');assert.equal(body.recipient,recipient.recipient_code);assert.equal(body.source,'balance');transfer={id:987,transfer_code:'TRF_fixture001',reference:body.reference,domain:'test',amount:body.amount,currency:'ZAR',source:'balance',recipient:123,integration:456,status:'success'};if(uncertain)throw Error('timeout after provider accepted');return Response.json({status:true,data:transfer});}
  assert.equal(url,'https://api.paystack.co/transfer/verify/'+transfer.reference);assert.equal(options.method,'GET');return Response.json({status:true,data:transfer});
 };
 async function destination(mode){recipient.domain=mode;const d=await operatePaymentDestination(db,maker,{action:'prepare_destination',requestKey:'payment-destination-'+mode,profileId:item.payroll_profile_id,mode,recipientCode:recipient.recipient_code,integrationId:'456',accountNumber:'1234567890',ownershipReference:'vault:fixture:ownership-v1',ownershipHash:'a'.repeat(64),mandateReference:'vault:fixture:mandate-v1',mandateHash:'b'.repeat(64),capabilityReference:'vault:fixture:capability-v1',capabilityHash:'c'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString(),documentsReviewed:true,capabilityReviewed:true,note:'Isolated employee payment source only.'},headers,runtime,transport);const r=database.prepare('SELECT * FROM payment_destination_reviews WHERE id=?').get(d.destinationId);await operatePaymentDestination(db,owner,{action:'approve_destination',destinationId:r.id,payloadHash:r.payload_hash,accountNumber:'1234567890',evidenceReviewed:true,note:'Independent fixture destination approval.'},headers,runtime,transport);return r.id;}
 const destinationId=await destination('test');
 const input={action:'prepare_employee_payment',requestKey:'employee-payment-1',payrollItemId:item.id,destinationId,note:'Fixture exported net pay and destination reviewed.',instructionReviewed:true};
 await assert.rejects(()=>operate(db,officer,input,headers,runtime,transport),/Operations/);
 await assert.rejects(()=>operate(db,maker,{...input,payrollItemId:'missing'},headers,runtime,transport),/exported/);
 let result=await operate(db,maker,input,headers,runtime,transport),ref=result.reference;
 const current=()=>database.prepare('SELECT * FROM employee_payment_instructions WHERE reference=?').get(ref);
 const command=(action,patch={})=>({action,reference:ref,version:current().version,sourceHash:current().source_hash,note:'Independent fixture finance review.',instructionReviewed:true,...patch});
 const forged={...current(),reference:'lokd-pay-invalid-null-active-key',request_key:'invalid-null-active-key',active_key:null};assert.throws(()=>database.prepare('INSERT INTO employee_payment_instructions('+Object.keys(forged).join(',')+') VALUES('+Object.keys(forged).map(()=>'?').join(',')+')').run(...Object.values(forged)),/source or authority/);
 assert.equal((await operate(db,maker,input,headers,runtime,transport)).alreadyPrepared,true);
 await assert.rejects(()=>operate(db,maker,{...input,note:'Changed findings'},headers,runtime,transport),/different instructions/);
 await operateProduction(db,owner,{action:'grant_operator',email:maker.email,role:'finance_approver',limitCents:10000000},headers);
 await assert.rejects(()=>operate(db,maker,command('approve_employee_payment'),headers,runtime,transport),/finance approver|maker/);
 await assert.rejects(()=>operate(db,finance,command('approve_employee_payment',{sourceHash:'wrong'}),headers,runtime,transport),/exact/);
 let authorityRace=false;db.afterRead=async({sql})=>{if(!authorityRace&&sql.startsWith('SELECT payroll_item_id FROM employee_payment_sources')){authorityRace=true;database.prepare("UPDATE operator_accounts SET status='suspended' WHERE email=?").run(maker.email);}};
 await assert.rejects(()=>operate(db,finance,command('approve_employee_payment'),headers,runtime,transport),/source.*changed/);assert.equal(current().status,'prepared');db.afterRead=null;database.prepare("UPDATE operator_accounts SET status='active' WHERE email=?").run(maker.email);
 const old=command('approve_employee_payment');await operate(db,finance,old,headers,runtime,transport);await assert.rejects(()=>operate(db,finance,old,headers,runtime,transport),/changed/);
 await operate(db,finance,command('cancel_employee_payment'),headers,runtime,transport);assert.equal(current().active_key,null);assert.equal(postCalls,0);
 ref=(await operate(db,maker,{...input,requestKey:'employee-payment-2'},headers,runtime,transport)).reference;
 if(process.env.LOKD_PAYMENT_FIXTURE_EXPORT){const path=process.env.LOKD_PAYMENT_FIXTURE_EXPORT;assert.match(path,/^\/tmp\/lokd-[a-z0-9-]+\.sqlite$/);assert.equal(fs.existsSync(path),false);database.prepare('VACUUM INTO ?').run(path);}
 await operate(db,finance,command('approve_employee_payment'),headers,runtime,transport);
 await assert.rejects(()=>operate(db,finance,command('dispatch_employee_test'),headers,{},transport),/not configured/);assert.equal(current().status,'approved');assert.equal(postCalls,0);
 uncertain=true;await assert.rejects(()=>operate(db,finance,command('dispatch_employee_test'),headers,runtime,transport),/uncertain/);assert.equal(current().status,'dispatch_claimed');assert.equal(postCalls,1);
 await assert.rejects(()=>operate(db,finance,command('dispatch_employee_test'),headers,runtime,transport),/cannot be repeated/);await assert.rejects(()=>operate(db,finance,command('cancel_employee_payment'),headers,runtime,transport),/cannot be repeated/);assert.equal(postCalls,1);
 const {paymentRecoveryJourney}=await import('./payment-recovery-journey.mjs');
 await paymentRecoveryJourney({kind:'employee',database,db,maker,owner,finance,officer,headers,runtime,reference:ref,input,transfer,recipient});
 if(process.env.LOKD_RECOVERY_FIXTURE_EXPORT)return;
 assert.throws(()=>database.prepare("INSERT INTO employee_transfer_observations VALUES('invalid-watermark',?,'verify','transfer.verify','invalid-watermark','null',NULL,?)").run(ref,new Date().toISOString()),/webhook evidence changed/);
 assert.equal((await operate(db,finance,command('verify_employee_test'),headers,runtime,transport)).providerState,'awaiting_signed_confirmation');
 const signed=async(event,data=transfer)=>{const body=JSON.stringify({event,data}),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(runtime.PAYSTACK_TEST_SECRET_KEY),{name:'HMAC',hash:'SHA-512'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');return new Request('https://lokd.co.za/api/paystack/test/webhook',{method:'POST',headers:{'x-paystack-signature':signature},body});};
 await assert.rejects(()=>receiveEmployeeTransferWebhook(new Request('https://fixture',{method:'POST',body:'{}'}),db,runtime),/signature/);
 assert.equal((await receivePaystackTest(await signed('transfer.success'),{...runtime,DB:db})).status,200);assert.equal((await receivePaystackTest(await signed('transfer.success'),{...runtime,DB:db})).status,200);
 assert.equal(database.prepare("SELECT count(*) n FROM employee_transfer_observations WHERE source='webhook'").get().n,1);
 assert.equal((await read(db,finance)).employeePayments.find(i=>i.reference===ref).providerState,'verification_required');
 assert.equal((await operate(db,finance,command('verify_employee_test'),headers,runtime,transport)).providerState,'confirmed_test');
 assert.equal((await read(db,officer)).employeePayments.length,0);assert.equal((await read(db,{...maker,email:'ungranted@example.test'})).employeePaymentCandidates.length,0);assert.equal(JSON.stringify((await read(db,finance)).employeePayments).includes('1234567890'),false);
 let webhookRace=false;db.afterRead=async({sql})=>{if(!webhookRace&&sql.startsWith('SELECT source,event,transfer_json,webhook_count')){webhookRace=true;await receiveEmployeeTransferWebhook(await signed('transfer.reversed',{...transfer,status:'reversed'}),db,runtime);}};
 await assert.rejects(()=>operate(db,finance,command('verify_employee_test'),headers,runtime,transport),/webhook evidence changed/);db.afterRead=null;assert.equal((await read(db,finance)).employeePayments.find(i=>i.reference===ref).providerState,'reversed_test');
 await receiveEmployeeTransferWebhook(await signed('transfer.success',{...transfer,id:988}),db,runtime);assert.equal((await read(db,finance)).employeePayments.find(i=>i.reference===ref).providerState,'review_required');
 const liveDestinationId=await destination('live');ref=(await operate(db,maker,{...input,requestKey:'employee-payment-live',destinationId:liveDestinationId},headers,runtime,transport)).reference;await operate(db,finance,command('approve_employee_payment'),headers,runtime,transport);
 const historicalCount=database.prepare('SELECT count(*) n FROM employee_payment_instructions').get().n;
 const allPayments=(await read(db,finance)).employeePayments;
 const livePayments=(await read(db,finance,true)).employeePayments;
 assert.ok(allPayments.some(row=>row.mode==='test'),'isolated history remains available');
 assert.ok(livePayments.some(row=>row.reference===ref),'the real live instruction remains actionable');
 assert.ok(livePayments.every(row=>row.mode==='live'),'production reader excludes saved test instructions');
 assert.ok((await read(db,finance,true)).employeePaymentCandidates.every(row=>row.mode==='live'));
 assert.equal(database.prepare('SELECT count(*) n FROM employee_payment_instructions').get().n,historicalCount);
 const {operatePaymentRecovery}=await import('../../app/lib/payment-recovery.ts');
 await assert.rejects(()=>operatePaymentRecovery(db,finance,{...command('propose_test_disposition'),kind:'employee'},headers),e=>e.status===423);
 const {paymentExecutionJourney}=await import('./payment-execution-journey.mjs');
 await paymentExecutionJourney({kind:'employee',database,db,maker,owner,finance,officer,headers,runtime,reference:ref,recipient,input});
 const before=lookupCalls;await assert.rejects(()=>operate(db,finance,command('dispatch_employee_test'),headers,runtime,transport),e=>e.status===423);assert.equal(postCalls,1);assert.equal(lookupCalls,before);
 assert.equal(database.prepare('SELECT status,settlement_reference FROM payroll_runs WHERE id=?').get(runId).status,'exported');assert.equal(database.prepare('SELECT settlement_reference FROM payroll_runs WHERE id=?').get(runId).settlement_reference,null);assert.equal(database.prepare('SELECT count(*) n FROM disbursement_items').get().n,0);
 for(const table of ['employee_payment_instructions','employee_payment_commands','employee_transfer_observations'])assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);
}
