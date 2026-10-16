import {fetchWithoutRedirect} from './provider-fetch';
import {identityCase,readApplicantIdentity} from './applicant-identity';
import {SignupError} from './signup-server';
export const ENROLMENT_PACKAGE={id:'registered-officer-enrolment',version:'owner-approved-20260911-test-v1',amount:35000,currency:'ZAR'} as const;
type Runtime={DB?:D1Database;PAYSTACK_TEST_SECRET_KEY?:string};
export type TestOrder={reference:string;case_id:string;owner_user_id:string;case_version:number;package_id:string;package_version:string;amount_minor:number;currency:string;state:string;checkout_url:string|null;provider_id:string|null;revision:number;note:string;created_at:string;updated_at:string};
const currentOrder=(db:D1Database,user:string,caseId:string,version:number)=>db.prepare('SELECT * FROM test_enrolment_orders WHERE case_id=? AND owner_user_id=? AND case_version=? AND package_id=? AND package_version=?').bind(caseId,user,version,ENROLMENT_PACKAGE.id,ENROLMENT_PACKAGE.version).first<TestOrder>();
function secret(runtime:Runtime){if(!runtime.DB||!runtime.PAYSTACK_TEST_SECRET_KEY?.startsWith('sk_test_'))throw new SignupError('Test payments are not configured.',503);return runtime.PAYSTACK_TEST_SECRET_KEY;}
export function expectedMetadata(order:TestOrder){return {application_id:order.case_id,applicant_id:order.owner_user_id,application_version:order.case_version,package_id:order.package_id,package_version:order.package_version,mode:'test'};}
export function matchesMetadata(value:unknown,order:TestOrder){if(typeof value==='string'){try{value=JSON.parse(value);}catch{return false;}}if(!value||typeof value!=='object')return false;const m=value as Record<string,unknown>;return Object.entries(expectedMetadata(order)).every(([k,v])=>m[k]===v);}
async function callPaystack(key:string,path:string,body:unknown,transport:typeof fetch){
 const response=await fetchWithoutRedirect(transport,'https://api.paystack.co'+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${key}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const payload=await response.json() as {status?:boolean;data?:Record<string,unknown>};if(!response.ok||payload.status!==true||!payload.data)throw new SignupError('Paystack did not confirm the request. Recheck the saved transaction; do not create a replacement.',503);return payload.data;
}
export async function readTestEnrolment(db:D1Database,user:string,caseId:string){const c=await identityCase(db,user,caseId);const order=await currentOrder(db,user,caseId,c.version);const history=await db.prepare('SELECT o.reference,o.case_version,o.state,o.created_at,o.revision,o.note,o.checkout_url FROM test_enrolment_orders o WHERE o.case_id=? AND o.owner_user_id=? ORDER BY o.created_at DESC LIMIT 20').bind(caseId,user).all();const events=order?await db.prepare('SELECT snapshot,recorded_at FROM test_enrolment_events WHERE reference=? ORDER BY rowid DESC LIMIT 40').bind(order.reference).all():{results:[]};const identity=await readApplicantIdentity(db,user,caseId);return {canInitialize:identity.nextStep==='registered_enrolment',package:ENROLMENT_PACKAGE,order,history:history.results,events:events.results,liveChargingEnabled:false,workEligible:false};}
export async function initializeTestEnrolment(runtime:Runtime,user:string,email:string,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const key=secret(runtime),db=runtime.DB!;if(typeof input.caseId!=='string'||input.packageVersion!==ENROLMENT_PACKAGE.version)throw new SignupError('Refresh the current enrolment package.');
 const c=await identityCase(db,user,input.caseId);if(c.version!==input.caseVersion)throw new SignupError('Application changed. Refresh.',409);
 const state=await readApplicantIdentity(db,user,input.caseId);if(state.nextStep!=='registered_enrolment')throw new SignupError('Registered-officer entry checks must precede this test enrolment.',409);
 const existing=await currentOrder(db,user,c.source_id,c.version);if(existing)return readTestEnrolment(db,user,c.source_id);
 // A previous version's open or paid order must be reconciled, never charged again.
 if(await db.prepare("SELECT reference FROM test_enrolment_orders WHERE case_id=? AND owner_user_id=? AND state != 'reversed' LIMIT 1").bind(c.source_id,user).first())throw new SignupError('A previous application version has an unresolved or paid order. Operations must reconcile it before another checkout.',409);
 const reference='lokd-enrolment-'+crypto.randomUUID(),now=new Date().toISOString();
 const created=await db.prepare(`INSERT OR IGNORE INTO test_enrolment_orders(reference,case_id,owner_user_id,case_version,package_id,package_version,amount_minor,currency,state,revision,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'initializing',1,'',?,?)`).bind(reference,c.source_id,user,c.version,ENROLMENT_PACKAGE.id,ENROLMENT_PACKAGE.version,35000,'ZAR',now,now).run();
 if(created.meta.changes){
  const order=await currentOrder(db,user,c.source_id,c.version);
  try{
   const data=await callPaystack(key,'/transaction/initialize',{email,reference,amount:'35000',currency:'ZAR',channels:['card'],callback_url:'https://demo.lokd.co.za/payments/paystack/test/callback',metadata:JSON.stringify(expectedMetadata(order!))},transport);
   if(data.reference!==reference||typeof data.authorization_url!=='string'||new URL(data.authorization_url).origin!=='https://checkout.paystack.com')throw Error('Unexpected checkout binding');
   await db.prepare("UPDATE test_enrolment_orders SET state='awaiting_checkout',checkout_url=?,revision=revision+1,updated_at=? WHERE reference=? AND state='initializing'").bind(data.authorization_url,new Date().toISOString(),reference).run();
  }catch{
   await db.prepare("UPDATE test_enrolment_orders SET state='initialization_unknown',note='Reconcile this reference before retrying; checkout may exist.',revision=revision+1,updated_at=? WHERE reference=? AND state='initializing'").bind(new Date().toISOString(),reference).run();
  }
 }
 return readTestEnrolment(db,user,c.source_id);
}
export async function reconcileTestEnrolment(runtime:Runtime,user:string,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const key=secret(runtime),db=runtime.DB!;if(typeof input.caseId!=='string'||typeof input.reference!=='string')throw new SignupError('Choose the saved order.');
 const c=await identityCase(db,user,input.caseId);
 const order=await db.prepare('SELECT * FROM test_enrolment_orders WHERE reference=? AND case_id=? AND owner_user_id=?').bind(input.reference,input.caseId,user).first<TestOrder>();if(!order)throw new SignupError('Order not found for this applicant.',404);
 if(order.revision!==input.expectedRevision)throw new SignupError('Payment record changed. Refresh before checking.',409);
 const data=await callPaystack(key,'/transaction/verify/'+encodeURIComponent(order.reference),null,transport);
 let state='review_required',note='Provider details do not match the saved applicant/package order.';
 const identity=await readApplicantIdentity(db,user,input.caseId);
 const current=c.version===order.case_version&&identity.nextStep==='registered_enrolment';
 const match=data.domain==='test'&&data.reference===order.reference&&data.amount===order.amount_minor&&data.currency===order.currency&&matchesMetadata(data.metadata,order)&&order.package_version===ENROLMENT_PACKAGE.version;
 const providerId=typeof data.id==='number'&&Number.isSafeInteger(data.id)?String(data.id):typeof data.id==='string'?data.id:null;
 if(match&&providerId&&(!order.provider_id||order.provider_id===providerId)){
  const providerState=String(data.status);
  if(providerState==='success'){
   const events=await db.prepare("SELECT * FROM paystack_test_deliveries WHERE reference=? AND event_type='charge.success'").bind(order.reference).all<{provider_id:string;provider_status:string;amount_minor:number;currency:string;metadata_json:string}>();
   const agrees=(e:typeof events.results[number])=>e.provider_id===providerId&&e.provider_status==='success'&&e.amount_minor===order.amount_minor&&e.currency===order.currency&&matchesMetadata(e.metadata_json,order);
   const contradictory=events.results.some(e=>!agrees(e));
   state=!current?'review_required':contradictory?'review_required':events.results.some(agrees)?'paid_test':'awaiting_webhook';
   note=!current?'Application or registration changed; payment cannot approve the current version.':contradictory?'Signed webhook details conflict; Operations review required.':state==='paid_test'?'Test transaction and signed webhook agree. No live eligibility granted.':'Provider success verified; waiting for matching signed webhook.';
  }else if(['failed','abandoned','reversed'].includes(providerState)){state=providerState;note=providerState==='reversed'?'Provider reports reversal.':'No successful payment. Resume the same checkout if available, then recheck.';}
  else if(['pending','ongoing','processing','queued'].includes(providerState)){state='pending';note='Paystack has not completed this test payment.';}
 }
 if(order.state===state&&order.note===note&&order.provider_id===providerId)return readTestEnrolment(db,user,input.caseId);
 const changed=await db.prepare('UPDATE test_enrolment_orders SET state=?,note=?,provider_id=?,revision=revision+1,updated_at=? WHERE reference=? AND revision=?').bind(state,note,providerId,new Date().toISOString(),order.reference,order.revision).run();
 if(!changed.meta.changes)throw new SignupError('Another reconciliation completed. Refresh.',409);
 return readTestEnrolment(db,user,input.caseId);
}
