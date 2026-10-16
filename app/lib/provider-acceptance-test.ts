import {SignupError} from './signup-server';
import {fetchWithoutRedirect} from './provider-fetch';
import {readRequestText} from './request-body';

// Provider acceptance evidence is deliberately separate from orders, invoices and funding.
export const PAYMENT_TEST_VERSION='provider-check-v1';
export const PAYMENT_TEST_SCENARIOS=['success','decline','cancel'] as const;
type Runtime={DB?:D1Database;PAYSTACK_TEST_SECRET_KEY?:string};
type Actor={userId:string;email:string;owner:boolean};
export type ProviderTest={reference:string;owner_user_id:string;email:string;version:string;scenario:string;amount_minor:number;currency:string;state:string;checkout_url:string|null;provider_id:string|null;provider_status:string|null;webhook_hash:string|null;revision:number;note:string;created_at:string;updated_at:string};
function configured(runtime:Runtime,actor:Actor){
 if(!actor.owner||!actor.userId||!actor.email)throw new SignupError('Operations owner access required.',403);
 if(!runtime.DB||!runtime.PAYSTACK_TEST_SECRET_KEY?.startsWith('sk_test_'))throw new SignupError('Paystack TEST configuration is unavailable.',503);
 return {db:runtime.DB,key:runtime.PAYSTACK_TEST_SECRET_KEY};
}
export function providerTestMetadata(row:ProviderTest){return {provider_test_reference:row.reference,provider_test_version:row.version,provider_test_owner:row.owner_user_id,provider_test_scenario:row.scenario,mode:'test'};}
function matchesMetadata(value:unknown,row:ProviderTest){
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{return false;}}
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const metadata=value as Record<string,unknown>;
 return Object.entries(providerTestMetadata(row)).every(([k,v])=>metadata[k]===v);
}
async function provider(key:string,path:string,body:unknown,transport:typeof fetch){
 const response=await fetchWithoutRedirect(transport,'https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});
 const payload=JSON.parse(await readRequestText(response,131072)) as {status?:boolean;data?:Record<string,unknown>};
 if(!response.ok||payload.status!==true||!payload.data||typeof payload.data!=='object')throw new SignupError('Paystack did not confirm this reference. Keep it and check again.',503);
 return payload.data;
}
export async function readProviderTests(runtime:Runtime,actor:Actor){
 const {db}=configured(runtime,actor);
 const rows=await db.prepare('SELECT * FROM provider_acceptance_tests WHERE owner_user_id=? AND version=? ORDER BY created_at').bind(actor.userId,PAYMENT_TEST_VERSION).all<ProviderTest>();
 return {rows:rows.results,version:PAYMENT_TEST_VERSION,amountMinor:100,currency:'ZAR',mode:'test',financialEffect:false};
}
export async function initializeProviderTest(runtime:Runtime,actor:Actor,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const {db,key}=configured(runtime,actor);
 if(input.testOnlyAcknowledged!==true||input.version!==PAYMENT_TEST_VERSION||!PAYMENT_TEST_SCENARIOS.includes(input.scenario as typeof PAYMENT_TEST_SCENARIOS[number]))throw new SignupError('Choose a test scenario and acknowledge TEST mode.');
 const scenario=String(input.scenario),reference='lokd-provider-test-'+crypto.randomUUID(),now=new Date().toISOString();
 // Unique owner/version/scenario and insert-before-I/O prevent duplicate provider requests.
 const inserted=await db.prepare(`INSERT OR IGNORE INTO provider_acceptance_tests(reference,owner_user_id,email,version,scenario,amount_minor,currency,state,revision,note,created_at,updated_at) VALUES(?,?,?,?,?,100,'ZAR','initializing',1,'',?,?)`).bind(reference,actor.userId,actor.email.toLowerCase(),PAYMENT_TEST_VERSION,scenario,now,now).run();
 if(inserted.meta.changes){
  const row=await db.prepare('SELECT * FROM provider_acceptance_tests WHERE reference=?').bind(reference).first<ProviderTest>();
  try{
   const data=await provider(key,'/transaction/initialize',{email:row!.email,reference,amount:'100',currency:'ZAR',channels:['card'],callback_url:'https://demo.lokd.co.za/ops/payment-test',metadata:JSON.stringify(providerTestMetadata(row!))},transport);
   const url=typeof data.authorization_url==='string'?new URL(data.authorization_url):null;
   if(data.reference!==reference||!url||url.origin!=='https://checkout.paystack.com'||url.username||url.password)throw Error('Checkout binding mismatch');
   await db.prepare("UPDATE provider_acceptance_tests SET state='awaiting_checkout',checkout_url=?,revision=revision+1,updated_at=? WHERE reference=? AND state='initializing'").bind(url.href,new Date().toISOString(),reference).run();
  }catch{
   await db.prepare("UPDATE provider_acceptance_tests SET state='initialization_unknown',note='The request outcome is uncertain. Check this saved reference; no replacement will be created.',revision=revision+1,updated_at=? WHERE reference=? AND state='initializing'").bind(new Date().toISOString(),reference).run();
  }
 }
 return readProviderTests(runtime,actor);
}
export async function reconcileProviderTest(runtime:Runtime,actor:Actor,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const {db,key}=configured(runtime,actor);
 if(typeof input.reference!=='string'||!Number.isSafeInteger(input.expectedRevision))throw new SignupError('Choose the saved test reference.');
 const row=await db.prepare('SELECT * FROM provider_acceptance_tests WHERE reference=? AND owner_user_id=? AND version=?').bind(input.reference,actor.userId,PAYMENT_TEST_VERSION).first<ProviderTest>();
 if(!row)throw new SignupError('Test reference not found for this owner.',404);
 if(row.revision!==input.expectedRevision)throw new SignupError('Test evidence changed. Refresh before checking.',409);
 const data=await provider(key,'/transaction/verify/'+encodeURIComponent(row.reference),null,transport);
 const id=typeof data.id==='number'&&Number.isSafeInteger(data.id)&&data.id>0?String(data.id):typeof data.id==='string'&&/^\d{1,30}$/.test(data.id)?data.id:null;
 const customer=data.customer&&typeof data.customer==='object'?data.customer as Record<string,unknown>:{};
 const match=data.domain==='test'&&data.reference===row.reference&&data.amount===row.amount_minor&&data.currency===row.currency&&typeof customer.email==='string'&&customer.email.toLowerCase()===row.email&&matchesMetadata(data.metadata,row)&&id&&(!row.provider_id||row.provider_id===id);
 let state='review_required',note='Provider details conflict with the saved TEST request.',webhookHash:string|null=null;
 const providerStatus=typeof data.status==='string'?data.status.slice(0,60):'unknown';
 if(match){
  if(providerStatus==='success'){
   const events=await db.prepare("SELECT payload_hash,provider_id,provider_status,amount_minor,currency,metadata_json FROM paystack_test_deliveries WHERE reference=? AND event_type='charge.success'").bind(row.reference).all<{payload_hash:string;provider_id:string;provider_status:string;amount_minor:number;currency:string;metadata_json:string}>();
   const agrees=(event:typeof events.results[number])=>event.provider_id===id&&event.provider_status==='success'&&event.amount_minor===row.amount_minor&&event.currency===row.currency&&matchesMetadata(event.metadata_json,row);
   if(events.results.some(event=>!agrees(event))){note='Signed webhook conflicts with provider verification. Review required.';}
   else if(events.results.length){state='verified_test';webhookHash=events.results[0].payload_hash;note='Paystack TEST verification and its signed success webhook agree. No live funds or service approval.';}
   else{state='awaiting_webhook';note='Paystack reports TEST success. A matching signed webhook has not arrived.';}
  }else if(['failed','abandoned','reversed'].includes(providerStatus)){
   const success=await db.prepare("SELECT payload_hash FROM paystack_test_deliveries WHERE reference=? AND event_type='charge.success' LIMIT 1").bind(row.reference).first();
   if(success&&providerStatus!=='reversed'){note='Provider reports failure after a signed success event. Review required.';}
   else{state=providerStatus;note='Paystack reports '+providerStatus+'. No successful payment is credited.';}
  }else if(['pending','ongoing','processing','queued'].includes(providerStatus)){state='pending';note='Paystack has not completed this TEST payment. Browser return or cancellation is not proof of payment.';}
 }
 const changed=await db.prepare('UPDATE provider_acceptance_tests SET state=?,note=?,provider_id=?,provider_status=?,webhook_hash=?,revision=revision+1,updated_at=? WHERE reference=? AND revision=?').bind(state,note,row.provider_id??(match?id:null),providerStatus,webhookHash,new Date().toISOString(),row.reference,row.revision).run();
 if(!changed.meta.changes)throw new SignupError('Another check completed. Refresh the evidence.',409);
 return readProviderTests(runtime,actor);
}
