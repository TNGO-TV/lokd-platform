import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operatePartnerPayment as operate,readPartnerPayments as read,receivePartnerTransferWebhook} from '../../app/lib/partner-payments.ts';
import {operatePartnerDestination} from '../../app/lib/partner-destinations.ts';
import {operateProduction} from '../../app/lib/production-operations.ts';
import {receivePaystackTest} from '../../app/lib/paystack-test.ts';
export async function partnerPaymentJourney({database,db,maker,owner,finance,officer,client,headers,payableId}){
 const item=database.prepare('SELECT * FROM partner_payables WHERE id=?').get(payableId);
 const runtime={PAYSTACK_TEST_SECRET_KEY:'sk_test_employee_fixture',PAYSTACK_LIVE_SECRET_KEY:'sk_live_employee_fixture'};
 const recipient={id:123,integration:456,recipient_code:'RCP_fixture001',domain:'test',type:'basa',currency:'ZAR',active:true,is_deleted:false,name:'Fixture Employee',updatedAt:'2026-09-01T00:00:00.000Z',details:{account_number:'1234567890',bank_code:'632005',bank_name:'Fixture bank',account_name:'Fixture Employee'}};
 let postCalls=0,lookupCalls=0,uncertain=false,transfer;
 const transport=async(url,options)=>{
  assert.equal(options.redirect,'error');
  if(url==='https://api.paystack.co/transferrecipient/RCP_fixture001'){lookupCalls++;assert.equal(options.method,'GET');return Response.json({status:true,data:recipient});}
  if(url==='https://api.paystack.co/transfer'){postCalls++;assert.equal(options.method,'POST');const body=JSON.parse(options.body);assert.equal(body.amount,item.amount_cents);assert.equal(body.currency,'ZAR');assert.equal(body.recipient,recipient.recipient_code);assert.equal(body.source,'balance');transfer={id:987,transfer_code:'TRF_fixture001',reference:body.reference,domain:'test',amount:body.amount,currency:'ZAR',source:'balance',recipient:123,integration:456,status:'success'};if(uncertain)throw Error('timeout after provider accepted');return Response.json({status:true,data:transfer});}
  assert.equal(url,'https://api.paystack.co/transfer/verify/'+transfer.reference);assert.equal(options.method,'GET');return Response.json({status:true,data:transfer});
 };
 async function destination(mode){recipient.domain=mode;const d=await operatePartnerDestination(db,maker,{action:'prepare_partner_destination',requestKey:'payment-destination-'+mode,employerId:item.employer_id,mode,recipientCode:recipient.recipient_code,integrationId:'456',accountNumber:'1234567890',ownershipReference:'vault:fixture:ownership-v1',ownershipHash:'a'.repeat(64),mandateReference:'vault:fixture:mandate-v1',mandateHash:'b'.repeat(64),capabilityReference:'vault:fixture:capability-v1',capabilityHash:'c'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString(),representativeUserId:'partner-representative-user',representativeReference:'vault:fixture:authority',representativeHash:'d'.repeat(64),companyReference:'vault:fixture:registration',companyHash:'e'.repeat(64),documentsReviewed:true,capabilityReviewed:true,note:'Isolated partner company payment source only.'},headers,runtime,transport);const r=database.prepare('SELECT * FROM partner_destination_reviews WHERE id=?').get(d.destinationId);await operatePartnerDestination(db,owner,{action:'approve_partner_destination',destinationId:r.id,payloadHash:r.payload_hash,accountNumber:'1234567890',evidenceReviewed:true,note:'Independent fixture destination approval.'},headers,runtime,transport);return r.id;}
 const destinationId=await destination('test');
 const input={action:'prepare_partner_payment',requestKey:'partner-payment-1',payableId:item.id,destinationId,note:'Fixture company invoice and destination reviewed.',instructionReviewed:true};
 await assert.rejects(()=>operate(db,officer,input,headers,runtime,transport),/Operations/);
 await assert.rejects(()=>operate(db,maker,{...input,payableId:'missing'},headers,runtime,transport),/approved unheld/);
 for(const userId of ['partner-representative-user',officer.userId,client.userId])await assert.rejects(()=>operate(db,{...maker,userId},input,headers,runtime,transport),/participant/);
 let result=await operate(db,maker,input,headers,runtime,transport),ref=result.reference;
 const current=()=>database.prepare('SELECT * FROM partner_payment_instructions WHERE reference=?').get(ref);
 const command=(action,patch={})=>({action,reference:ref,version:current().version,sourceHash:current().source_hash,note:'Independent fixture finance review.',instructionReviewed:true,...patch});
 const forged={...current(),reference:'lokd-partner-pay-invalid-null-active-key',request_key:'invalid-null-active-key',active_key:null};assert.throws(()=>database.prepare('INSERT INTO partner_payment_instructions('+Object.keys(forged).join(',')+') VALUES('+Object.keys(forged).map(()=>'?').join(',')+')').run(...Object.values(forged)),/source or authority/);
 for(const userId of ['partner-representative-user',officer.userId,client.userId])await assert.rejects(()=>operate(db,{...finance,userId},command('approve_partner_payment'),headers,runtime,transport),/Independent/);
 assert.equal((await operate(db,maker,input,headers,runtime,transport)).alreadyPrepared,true);
 await assert.rejects(()=>operate(db,maker,{...input,note:'Changed findings'},headers,runtime,transport),/different instructions/);
 await operateProduction(db,owner,{action:'grant_operator',email:maker.email,role:'finance_approver',limitCents:10000000},headers);
 await assert.rejects(()=>operate(db,maker,command('approve_partner_payment'),headers,runtime,transport),/finance approver|maker/);
 await assert.rejects(()=>operate(db,finance,command('approve_partner_payment',{sourceHash:'wrong'}),headers,runtime,transport),/exact/);
 let authorityRace=false;db.afterRead=async({sql})=>{if(!authorityRace&&sql.startsWith('SELECT payable_id FROM partner_payment_sources')){authorityRace=true;database.prepare("UPDATE operator_accounts SET status='suspended' WHERE email=?").run(maker.email);}};
 await assert.rejects(()=>operate(db,finance,command('approve_partner_payment'),headers,runtime,transport),/source.*changed/);assert.equal(current().status,'prepared');db.afterRead=null;database.prepare("UPDATE operator_accounts SET status='active' WHERE email=?").run(maker.email);
 const old=command('approve_partner_payment');await operate(db,finance,old,headers,runtime,transport);await assert.rejects(()=>operate(db,finance,old,headers,runtime,transport),/changed/);
 await operate(db,finance,command('cancel_partner_payment'),headers,runtime,transport);assert.equal(current().active_key,null);assert.equal(postCalls,0);
 ref=(await operate(db,maker,{...input,requestKey:'partner-payment-2'},headers,runtime,transport)).reference;
 if(process.env.LOKD_PARTNER_PAYMENT_FIXTURE_EXPORT){const path=process.env.LOKD_PARTNER_PAYMENT_FIXTURE_EXPORT;assert.match(path,/^\/tmp\/lokd-[a-z0-9-]+\.sqlite$/);assert.equal(fs.existsSync(path),false);database.prepare('VACUUM INTO ?').run(path);}
 await operate(db,finance,command('approve_partner_payment'),headers,runtime,transport);
 await assert.rejects(()=>operate(db,finance,command('dispatch_partner_test'),headers,{},transport),/not configured/);assert.equal(current().status,'approved');assert.equal(postCalls,0);
 // Employer revision and destination authority changes at dispatch must roll back the claim before POST.
 let changed=false;const race=async(...args)=>{const result=await transport(...args);if(!changed&&args[0].includes('/transferrecipient/')){changed=true;database.prepare('UPDATE workforce_employers SET version=version+1 WHERE id=?').run(item.employer_id);}return result;};
 await assert.rejects(()=>operate(db,finance,command('dispatch_partner_test'),headers,runtime,race),/source.*changed/);assert.equal(current().status,'approved');assert.equal(postCalls,0);
 database.prepare('UPDATE workforce_employers SET version=version-1 WHERE id=?').run(item.employer_id);
 // A destination-provider mismatch records a stop condition and permits only unsent cancellation.
 recipient.details.account_number='9999999999';await assert.rejects(()=>operate(db,finance,command('dispatch_partner_test'),headers,runtime,transport),/recipient changed/);assert.equal(postCalls,0);recipient.details.account_number='1234567890';
 await assert.rejects(()=>operate(db,finance,command('dispatch_partner_test'),headers,runtime,transport),/evidence changed/);
 await operate(db,finance,command('cancel_partner_payment'),headers,runtime,transport);
 ref=(await operate(db,maker,{...input,requestKey:'partner-payment-after-mismatch'},headers,runtime,transport)).reference;await operate(db,finance,command('approve_partner_payment'),headers,runtime,transport);
 uncertain=true;await assert.rejects(()=>operate(db,finance,command('dispatch_partner_test'),headers,runtime,transport),/uncertain/);assert.equal(current().status,'dispatch_claimed');assert.equal(postCalls,1);
 await assert.rejects(()=>operate(db,finance,command('dispatch_partner_test'),headers,runtime,transport),/cannot be repeated/);await assert.rejects(()=>operate(db,finance,command('cancel_partner_payment'),headers,runtime,transport),/cannot be repeated/);assert.equal(postCalls,1);
 await assert.rejects(()=>operate(db,maker,{...input,requestKey:'duplicate-after-claim'},headers,runtime,transport),/UNIQUE/);
 const {paymentRecoveryJourney}=await import('./payment-recovery-journey.mjs');
 await paymentRecoveryJourney({kind:'partner',database,db,maker,finance,officer,headers,runtime,reference:ref,input,transfer,recipient});
 assert.throws(()=>database.prepare("INSERT INTO partner_transfer_observations VALUES('invalid-watermark',?,'verify','transfer.verify','invalid-watermark','null',NULL,?)").run(ref,new Date().toISOString()),/webhook evidence changed/);
 assert.equal((await operate(db,finance,command('verify_partner_test'),headers,runtime,transport)).providerState,'awaiting_signed_confirmation');
 const signed=async(event,data=transfer)=>{const body=JSON.stringify({event,data}),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(runtime.PAYSTACK_TEST_SECRET_KEY),{name:'HMAC',hash:'SHA-512'},false,['sign']);const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');return new Request('https://lokd.co.za/api/paystack/test/webhook',{method:'POST',headers:{'x-paystack-signature':signature},body});};
 await assert.rejects(()=>receivePartnerTransferWebhook(new Request('https://fixture',{method:'POST',body:'{}'}),db,runtime),/signature/);
 assert.equal((await receivePaystackTest(await signed('transfer.success',{...transfer,domain:'live'}),{...runtime,DB:db})).status,422);
 assert.equal((await receivePaystackTest(await signed('transfer.success'),{...runtime,DB:db})).status,200);assert.equal((await receivePaystackTest(await signed('transfer.success'),{...runtime,DB:db})).status,200);
 assert.equal(database.prepare("SELECT count(*) n FROM partner_transfer_observations WHERE source='webhook'").get().n,1);
 assert.equal((await read(db,finance)).partnerPayments.find(i=>i.reference===ref).providerState,'verification_required');
 assert.equal((await operate(db,finance,command('verify_partner_test'),headers,runtime,transport)).providerState,'confirmed_test');
 assert.equal((await read(db,officer)).partnerPayments.length,0);assert.equal((await read(db,{...maker,email:'ungranted@example.test'})).partnerPaymentCandidates.length,0);assert.equal(JSON.stringify((await read(db,finance)).partnerPayments).includes('1234567890'),false);
 let webhookRace=false;db.afterRead=async({sql})=>{if(!webhookRace&&sql.startsWith('SELECT source,event,transfer_json,webhook_count')){webhookRace=true;await receivePartnerTransferWebhook(await signed('transfer.reversed',{...transfer,status:'reversed'}),db,runtime);}};
 await assert.rejects(()=>operate(db,finance,command('verify_partner_test'),headers,runtime,transport),/webhook evidence changed/);db.afterRead=null;assert.equal((await read(db,finance)).partnerPayments.find(i=>i.reference===ref).providerState,'reversed_test');
 await receivePartnerTransferWebhook(await signed('transfer.success',{...transfer,id:988}),db,runtime);assert.equal((await read(db,finance)).partnerPayments.find(i=>i.reference===ref).providerState,'review_required');
 const liveDestinationId=await destination('live');ref=(await operate(db,maker,{...input,requestKey:'partner-payment-live',destinationId:liveDestinationId},headers,runtime,transport)).reference;await operate(db,finance,command('approve_partner_payment'),headers,runtime,transport);
 const {operatePaymentRecovery}=await import('../../app/lib/payment-recovery.ts');
 await assert.rejects(()=>operatePaymentRecovery(db,finance,{...command('propose_test_disposition'),kind:'partner'},headers),e=>e.status===423);
 const before=lookupCalls;await assert.rejects(()=>operate(db,finance,command('dispatch_partner_test'),headers,runtime,transport),e=>e.status===423);assert.equal(postCalls,1);assert.equal(lookupCalls,before);
 assert.equal(database.prepare('SELECT status,remittance_reference FROM partner_payables WHERE id=?').get(payableId).status,'approved_unpaid');assert.equal(database.prepare('SELECT remittance_reference FROM partner_payables WHERE id=?').get(payableId).remittance_reference,null);assert.equal(database.prepare('SELECT count(*) n FROM disbursement_items').get().n,0);
 for(const table of ['partner_payment_instructions','partner_payment_commands','partner_transfer_observations'])assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);
}
