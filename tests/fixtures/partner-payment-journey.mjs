import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operatePartnerPayment as operate,readPartnerPayments as read} from '../../app/lib/partner-payments.ts';
import {operatePartnerDestination} from '../../app/lib/partner-destinations.ts';
import {operateWithProof as operateProduction} from './operations-auth.mjs';
export async function partnerPaymentJourney({database,db,maker,owner,finance,officer,client,headers,payableId}){
 const item=database.prepare('SELECT * FROM partner_payables WHERE id=?').get(payableId);
 const runtime={PAYSTACK_LIVE_SECRET_KEY:'sk_live_employee_fixture'};
 const recipient={id:123,integration:456,recipient_code:'RCP_fixture001',domain:'live',type:'basa',currency:'ZAR',active:true,is_deleted:false,name:'Fixture Employee',updatedAt:'2026-09-01T00:00:00.000Z',details:{account_number:'1234567890',bank_code:'632005',bank_name:'Fixture bank',account_name:'Fixture Employee'}};
 const transport=async(url,options)=>{
  assert.equal(options.redirect,'manual');
  if(url==='https://api.paystack.co/transferrecipient/RCP_fixture001'){assert.equal(options.method,'GET');return Response.json({status:true,data:recipient});}
  assert.fail('No provider transfer call is allowed: '+url);
 };
 async function destination(mode,representativeUserId='partner-representative-user',supersedesId=''){const d=await operatePartnerDestination(db,maker,{action:'prepare_partner_destination',requestKey:'payment-destination-'+mode+(supersedesId?'-'+supersedesId:''),supersedesId,employerId:item.employer_id,mode,recipientCode:recipient.recipient_code,integrationId:'456',accountNumber:'1234567890',ownershipReference:'vault:fixture:ownership-v1',ownershipHash:'a'.repeat(64),mandateReference:'vault:fixture:mandate-v1',mandateHash:'b'.repeat(64),capabilityReference:'vault:fixture:capability-v1',capabilityHash:'c'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString(),representativeUserId,representativeReference:'vault:fixture:authority',representativeHash:'d'.repeat(64),companyReference:'vault:fixture:registration',companyHash:'e'.repeat(64),documentsReviewed:true,capabilityReviewed:true,note:'Isolated partner company payment source only.'},headers,runtime,transport);const r=database.prepare('SELECT * FROM partner_destination_reviews WHERE id=?').get(d.destinationId);await operatePartnerDestination(db,owner,{action:'approve_partner_destination',destinationId:r.id,payloadHash:r.payload_hash,accountNumber:'1234567890',evidenceReviewed:true,note:'Independent fixture destination approval.'},headers,runtime,transport);return r.id;}
 const destinationId=await destination('live');
 const input={action:'prepare_partner_payment',requestKey:'partner-payment-1',payableId:item.id,destinationId,note:'Fixture company invoice and destination reviewed.',instructionReviewed:true};
 await assert.rejects(()=>operate(db,officer,input,headers),/Operations/);
 await assert.rejects(()=>operate(db,maker,{...input,payableId:'missing'},headers),/approved unheld/);
 for(const userId of ['partner-representative-user',officer.userId,client.userId])await assert.rejects(()=>operate(db,{...maker,userId},input,headers),/participant/);
 let result=await operate(db,maker,input,headers),ref=result.reference;
 const current=()=>database.prepare('SELECT * FROM partner_payment_instructions WHERE reference=?').get(ref);
 const command=(action,patch={})=>({action,reference:ref,version:current().version,sourceHash:current().source_hash,note:'Independent fixture finance review.',instructionReviewed:true,...patch});
 const forged={...current(),reference:'lokd-partner-pay-invalid-null-active-key',request_key:'invalid-null-active-key',active_key:null};assert.throws(()=>database.prepare('INSERT INTO partner_payment_instructions('+Object.keys(forged).join(',')+') VALUES('+Object.keys(forged).map(()=>'?').join(',')+')').run(...Object.values(forged)),/source or authority/);
 for(const userId of ['partner-representative-user',officer.userId,client.userId])await assert.rejects(()=>operate(db,{...finance,userId},command('approve_partner_payment'),headers),/Independent/);
 assert.equal((await operate(db,maker,input,headers)).alreadyPrepared,true);
 await assert.rejects(()=>operate(db,maker,{...input,note:'Changed findings'},headers),/different instructions/);
 await operateProduction(db,owner,{action:'grant_operator',email:maker.email,role:'finance_approver',limitCents:10000000},headers);
 await assert.rejects(()=>operate(db,maker,command('approve_partner_payment'),headers),/finance approver|maker/);
 await assert.rejects(()=>operate(db,finance,command('approve_partner_payment',{sourceHash:'wrong'}),headers),/exact/);
 let authorityRace=false;db.afterRead=async({sql})=>{if(!authorityRace&&sql.startsWith('SELECT payable_id FROM partner_payment_sources')){authorityRace=true;database.prepare("UPDATE operator_accounts SET status='suspended' WHERE email=?").run(maker.email);}};
 await assert.rejects(()=>operate(db,finance,command('approve_partner_payment'),headers),/source.*changed/);assert.equal(current().status,'prepared');db.afterRead=null;database.prepare("UPDATE operator_accounts SET status='active' WHERE email=?").run(maker.email);
 const old=command('approve_partner_payment');await operate(db,finance,old,headers);await assert.rejects(()=>operate(db,finance,old,headers),/changed/);
 await operate(db,finance,command('cancel_partner_payment'),headers);assert.equal(current().active_key,null);
 ref=(await operate(db,maker,{...input,requestKey:'partner-payment-2'},headers)).reference;
 if(process.env.LOKD_PARTNER_PAYMENT_FIXTURE_EXPORT){const path=process.env.LOKD_PARTNER_PAYMENT_FIXTURE_EXPORT;assert.match(path,/^\/tmp\/lokd-[a-z0-9-]+\.sqlite$/);assert.equal(fs.existsSync(path),false);database.prepare('VACUUM INTO ?').run(path);}
 await operate(db,finance,command('approve_partner_payment'),headers);
 assert.equal(current().status,'approved');
 await assert.rejects(()=>operate(db,maker,{...input,requestKey:'duplicate-after-approval'},headers),/UNIQUE/);
 assert.equal((await read(db,officer)).partnerPayments.length,0);assert.equal((await read(db,{...maker,email:'ungranted@example.test'})).partnerPaymentCandidates.length,0);assert.equal(JSON.stringify((await read(db,finance)).partnerPayments).includes('1234567890'),false);
 const payments=(await read(db,finance)).partnerPayments;
 assert.ok(payments.some(row=>row.reference===ref),'the live instruction remains actionable');
 assert.ok(payments.every(row=>row.mode==='live'));assert.ok((await read(db,finance)).partnerPaymentCandidates.every(row=>row.mode==='live'));
 const {paymentExecutionJourney}=await import('./payment-execution-journey.mjs');
 await paymentExecutionJourney({kind:'partner',database,db,maker,owner,finance,officer,headers,runtime,reference:ref,recipient,input});
 const {paymentRecoveryJourney}=await import('./payment-recovery-journey.mjs');
 await paymentRecoveryJourney({kind:'partner',database,db,maker,owner,finance,officer,headers,runtime,reference:ref,input,recipient});
 assert.equal(current().status,'approved');
 assert.equal(database.prepare('SELECT status,remittance_reference FROM partner_payables WHERE id=?').get(payableId).status,'approved_unpaid');assert.equal(database.prepare('SELECT remittance_reference FROM partner_payables WHERE id=?').get(payableId).remittance_reference,null);assert.equal(database.prepare('SELECT count(*) n FROM disbursement_items').get().n,0);
 for(const table of ['partner_payment_instructions','partner_payment_commands'])assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);
}
