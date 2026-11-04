import assert from 'node:assert/strict';
import fs from 'node:fs';
import {operateEmployeePayment as operate,readEmployeePayments as read} from '../../app/lib/employee-payments.ts';
import {operatePaymentDestination} from '../../app/lib/payment-destinations.ts';
import {operateWithProof as operateProduction} from './operations-auth.mjs';
export async function employeePaymentJourney({database,db,maker,owner,finance,officer,headers,runId}){
 const now=new Date().toISOString(),item=database.prepare('SELECT * FROM payroll_items WHERE payroll_run_id=?').get(runId);
 database.prepare(`INSERT INTO officer_applications(id,pathway,full_name,mobile_normalized,email_normalized,city,province,psira_status,service_interests,training_interests,over_18_confirmed,eligibility_acknowledged,privacy_notice_version,privacy_acknowledged_at,retention_review_at,environment,integrity_state) VALUES('period-officer-case','qualified','Payment Fixture','+27820000888',?,'Sandton','Gauteng','registered','[]','[]',1,1,'fixture',?,?,'production','user_submitted')`).run(officer.email,now,now);
 database.prepare("INSERT INTO signup_cases VALUES('officer','period-officer-case',?,'reviewed','Fixture','{}',1,'fixture',?)").run(officer.userId,now);
 const runtime={PAYSTACK_LIVE_SECRET_KEY:'sk_live_employee_fixture'};
 const recipient={id:123,integration:456,recipient_code:'RCP_fixture001',domain:'live',type:'basa',currency:'ZAR',active:true,is_deleted:false,name:'Fixture Employee',updatedAt:'2026-09-01T00:00:00.000Z',details:{account_number:'1234567890',bank_code:'632005',bank_name:'Fixture bank',account_name:'Fixture Employee'}};
 const transport=async(url,options)=>{
  assert.equal(options.redirect,'manual');
  if(url==='https://api.paystack.co/transferrecipient/RCP_fixture001'){assert.equal(options.method,'GET');return Response.json({status:true,data:recipient});}
  assert.fail('No provider transfer call is allowed: '+url);
 };
 async function destination(mode){const d=await operatePaymentDestination(db,maker,{action:'prepare_destination',requestKey:'payment-destination-'+mode,profileId:item.payroll_profile_id,mode,recipientCode:recipient.recipient_code,integrationId:'456',accountNumber:'1234567890',ownershipReference:'vault:fixture:ownership-v1',ownershipHash:'a'.repeat(64),mandateReference:'vault:fixture:mandate-v1',mandateHash:'b'.repeat(64),capabilityReference:'vault:fixture:capability-v1',capabilityHash:'c'.repeat(64),expiresAt:new Date(Date.now()+3600000).toISOString(),documentsReviewed:true,capabilityReviewed:true,note:'Isolated employee payment source only.'},headers,runtime,transport);const r=database.prepare('SELECT * FROM payment_destination_reviews WHERE id=?').get(d.destinationId);await operatePaymentDestination(db,owner,{action:'approve_destination',destinationId:r.id,payloadHash:r.payload_hash,accountNumber:'1234567890',evidenceReviewed:true,note:'Independent fixture destination approval.'},headers,runtime,transport);return r.id;}
 const destinationId=await destination('live');
 const input={action:'prepare_employee_payment',requestKey:'employee-payment-1',payrollItemId:item.id,destinationId,note:'Fixture exported net pay and destination reviewed.',instructionReviewed:true};
 await assert.rejects(()=>operate(db,officer,input,headers),/Operations/);
 await assert.rejects(()=>operate(db,maker,{...input,payrollItemId:'missing'},headers),/exported/);
 let result=await operate(db,maker,input,headers),ref=result.reference;
 const current=()=>database.prepare('SELECT * FROM employee_payment_instructions WHERE reference=?').get(ref);
 const command=(action,patch={})=>({action,reference:ref,version:current().version,sourceHash:current().source_hash,note:'Independent fixture finance review.',instructionReviewed:true,...patch});
 const forged={...current(),reference:'lokd-pay-invalid-null-active-key',request_key:'invalid-null-active-key',active_key:null};assert.throws(()=>database.prepare('INSERT INTO employee_payment_instructions('+Object.keys(forged).join(',')+') VALUES('+Object.keys(forged).map(()=>'?').join(',')+')').run(...Object.values(forged)),/source or authority/);
 assert.equal((await operate(db,maker,input,headers)).alreadyPrepared,true);
 await assert.rejects(()=>operate(db,maker,{...input,note:'Changed findings'},headers),/different instructions/);
 await operateProduction(db,owner,{action:'grant_operator',email:maker.email,role:'finance_approver',limitCents:10000000},headers);
 await assert.rejects(()=>operate(db,maker,command('approve_employee_payment'),headers),/finance approver|maker/);
 await assert.rejects(()=>operate(db,finance,command('approve_employee_payment',{sourceHash:'wrong'}),headers),/exact/);
 let authorityRace=false;db.afterRead=async({sql})=>{if(!authorityRace&&sql.startsWith('SELECT payroll_item_id FROM employee_payment_sources')){authorityRace=true;database.prepare("UPDATE operator_accounts SET status='suspended' WHERE email=?").run(maker.email);}};
 await assert.rejects(()=>operate(db,finance,command('approve_employee_payment'),headers),/source.*changed/);assert.equal(current().status,'prepared');db.afterRead=null;database.prepare("UPDATE operator_accounts SET status='active' WHERE email=?").run(maker.email);
 const old=command('approve_employee_payment');await operate(db,finance,old,headers);await assert.rejects(()=>operate(db,finance,old,headers),/changed/);
 await operate(db,finance,command('cancel_employee_payment'),headers);assert.equal(current().active_key,null);
 ref=(await operate(db,maker,{...input,requestKey:'employee-payment-2'},headers)).reference;
 if(process.env.LOKD_PAYMENT_FIXTURE_EXPORT){const path=process.env.LOKD_PAYMENT_FIXTURE_EXPORT;assert.match(path,/^\/tmp\/lokd-[a-z0-9-]+\.sqlite$/);assert.equal(fs.existsSync(path),false);database.prepare('VACUUM INTO ?').run(path);}
 await operate(db,finance,command('approve_employee_payment'),headers);
 assert.equal(current().status,'approved');
 assert.equal((await read(db,officer)).employeePayments.length,0);assert.equal((await read(db,{...maker,email:'ungranted@example.test'})).employeePaymentCandidates.length,0);assert.equal(JSON.stringify((await read(db,finance)).employeePayments).includes('1234567890'),false);
 const payments=(await read(db,finance)).employeePayments;
 assert.ok(payments.some(row=>row.reference===ref),'the live instruction remains actionable');
 assert.ok(payments.every(row=>row.mode==='live'));assert.ok((await read(db,finance)).employeePaymentCandidates.every(row=>row.mode==='live'));
 const {paymentExecutionJourney}=await import('./payment-execution-journey.mjs');
 await paymentExecutionJourney({kind:'employee',database,db,maker,owner,finance,officer,headers,runtime,reference:ref,recipient,input});
 const {paymentRecoveryJourney}=await import('./payment-recovery-journey.mjs');
 await paymentRecoveryJourney({kind:'employee',database,db,maker,owner,finance,officer,headers,runtime,reference:ref,input,recipient});
 assert.equal(current().status,'approved');
 assert.equal(database.prepare('SELECT status,settlement_reference FROM payroll_runs WHERE id=?').get(runId).status,'exported');assert.equal(database.prepare('SELECT settlement_reference FROM payroll_runs WHERE id=?').get(runId).settlement_reference,null);assert.equal(database.prepare('SELECT count(*) n FROM disbursement_items').get().n,0);
 for(const table of ['employee_payment_instructions','employee_payment_commands'])assert.throws(()=>database.exec('DELETE FROM '+table),/immutable/);
}
