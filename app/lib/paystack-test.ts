// This receiver records delivery evidence only. It cannot credit a booking,
// reconcile live money, activate service or authorise an officer payment.
import {receiveBookingCollectionWebhook} from './booking-collections';
type Runtime = { PAYSTACK_TEST_SECRET_KEY?: string; DB?: D1Database };
const reply=(error:string,status:number)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
export async function receivePaystackTest(request:Request,runtime:Runtime):Promise<Response> {
 if(request.method!=='POST')return new Response('Use POST for Paystack webhook events.',{status:405,headers:{allow:'POST','cache-control':'no-store'}});
 const secret=runtime.PAYSTACK_TEST_SECRET_KEY;
 if(!secret?.startsWith('sk_test_')||!runtime.DB)return reply('Paystack test receiver is awaiting secure configuration.',503);
 const signature=request.headers.get('x-paystack-signature')??'';
 if(!/^[a-f0-9]{128}$/i.test(signature))return reply('Invalid webhook signature.',401);
 // Bound the actual stream, including requests without Content-Length.
 const reader=request.body?.getReader();if(!reader)return reply('Missing event.',400);
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();return reply('Event too large.',413);}chunks.push(value);}
 const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['verify']);
 const sig=Uint8Array.from(signature.match(/../g)!,part=>parseInt(part,16));
 if(!await crypto.subtle.verify('HMAC',key,sig,raw))return reply('Invalid webhook signature.',401);
 let payload;try{payload=JSON.parse(new TextDecoder().decode(raw));}catch{return reply('Invalid event JSON.',400);}
 if(!payload||typeof payload.event!=='string'||payload.event.length>100||!payload.data||typeof payload.data!=='object')return reply('Invalid event.',400);
 if(payload.event.startsWith('refund.')||payload.event.startsWith('charge.dispute.')){
  try{return Response.json(await receiveBookingCollectionWebhook(new Request(request.url,{method:'POST',headers:request.headers,body:raw}),runtime.DB,runtime,'test'),{headers:{'cache-control':'no-store'}});}catch{return reply('Recovery event could not be accepted. Retry delivery.',503);}
 }
 // Only test-domain events are accepted. Missing/ambiguous domains stay rejected.
 if(payload.data.domain!=='test')return reply('Only explicit test-domain events are accepted here.',422);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
 const metadata:Record<string,unknown>={};let rawMeta=payload.data.metadata;if(typeof rawMeta==='string'){try{rawMeta=JSON.parse(rawMeta);}catch{rawMeta={};}}for(const field of ['application_id','applicant_id','application_version','package_id','package_version','mode']){const value=rawMeta?.[field];if(typeof value==='string'&&value.length<=200||typeof value==='number'&&Number.isSafeInteger(value))metadata[field]=value;}
 const scalar=(value:unknown)=>typeof value==='string'?value.slice(0,200):typeof value==='number'&&Number.isSafeInteger(value)?String(value):null;
 try{
  await runtime.DB.prepare(`INSERT OR IGNORE INTO paystack_test_deliveries
   (payload_hash,event_type,provider_id,reference,provider_status,amount_minor,currency,received_at,metadata_json)
   VALUES (?,?,?,?,?,?,?,?,?)`).bind(hash,payload.event,scalar(payload.data.id),scalar(payload.data.reference),scalar(payload.data.status),Number.isSafeInteger(payload.data.amount)&&payload.data.amount>=0?payload.data.amount:null,scalar(payload.data.currency),new Date().toISOString(),JSON.stringify(metadata)).run();
  // Reuse the configured test webhook without changing the saved enrolment checkout.
  // Reference routing also retains contradictory booking metadata for review.
  if(typeof payload.data.reference==='string'&&payload.data.reference.startsWith('lokd-booking-')){
   await receiveBookingCollectionWebhook(new Request(request.url,{method:'POST',headers:request.headers,body:raw}),runtime.DB,runtime,'test');
  }
 }catch{return reply('Event storage unavailable. Retry delivery.',503);}
 return Response.json({received:true,mode:'test',financialEffect:false},{headers:{'cache-control':'no-store'}});
}
