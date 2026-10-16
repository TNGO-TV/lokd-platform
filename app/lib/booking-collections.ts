import {fetchWithoutRedirect} from './provider-fetch';
import {readFinanceWebhookBytes,readFinanceProviderJson} from './finance-body';
import {refundEvidence,refundWebhookEvidence} from './booking-refund-evidence';
import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {currentClientReview} from './production-client-review';
import type {SigningActor} from './production-signing';
import {collectionMetadata,collectionTransaction,collectionEvidenceDecision,type CollectionBinding,type CollectionTransaction} from './collection-evidence';

export type CollectionRuntime={PAYSTACK_TEST_SECRET_KEY?:string;PAYSTACK_LIVE_SECRET_KEY?:string;LOKD_COLLECTION_LIVE_ENABLED?:string};
export type Saved={reference:string;order_id:string;client_id:string;applicant_id:string;case_id:string;case_version:number;source_hash:string;amount_minor:number;currency:'ZAR';mode:'test'|'live';state:string;provider_id:string|null;checkout_url:string|null;prepared_by:string;approved_by:string|null;revision:number};
const reference=(v:unknown)=>{if(typeof v!=='string'||!v||v.length>200)throw new SignupError('Choose the saved collection reference.');return v;};
export const binding=(r:Saved):CollectionBinding=>({reference:r.reference,orderId:r.order_id,clientId:r.client_id,applicantId:r.applicant_id,caseId:r.case_id,caseVersion:r.case_version,sourceHash:r.source_hash,amountMinor:r.amount_minor,currency:r.currency,mode:r.mode});
export function collectionKey(runtime:CollectionRuntime,mode:'test'|'live',receiving=false){
 const value=mode==='test'?runtime.PAYSTACK_TEST_SECRET_KEY:runtime.PAYSTACK_LIVE_SECRET_KEY;
 if(!receiving&&mode==='live'&&runtime.LOKD_COLLECTION_LIVE_ENABLED!=='true')throw new SignupError('Live booking collection awaits provider and operating acceptance.',423);
 if(!value?.startsWith(mode==='test'?'sk_test_':'sk_live_'))throw new SignupError('This collection mode is not configured.',503);return value;
}
async function orderSource(db:D1Database,id:string){
 return db.prepare(`SELECT p.id,p.client_id,p.case_version,l.owner_user_id,l.case_id,p.request_hash,
 b.client_price_cents,b.funding_status,b.status,c.contact_email
 FROM production_order_setups p JOIN bookings b ON b.id=p.id AND b.client_id=p.client_id
 JOIN clients c ON c.id=p.client_id AND c.approval_status='approved'
 JOIN production_entity_links l ON l.kind='client' AND l.entity_id=p.client_id AND l.case_version=p.case_version
 JOIN signup_cases s ON s.kind=l.kind AND s.source_id=l.case_id AND s.version=l.case_version AND s.owner_user_id=l.owner_user_id AND s.status='reviewed'
 WHERE p.id=? AND b.environment='production' AND b.integrity_state='production_verified'
 AND c.environment='production' AND c.integrity_state='production_verified'`).bind(id).first<{id:string;client_id:string;case_version:number;owner_user_id:string;case_id:string;request_hash:string;client_price_cents:number;funding_status:string;status:string;contact_email:string}>();
}
export async function currentCollection(db:D1Database,r:Saved){const s=await orderSource(db,r.order_id);return Boolean(s&&s.client_id===r.client_id&&s.case_version===r.case_version&&s.owner_user_id===r.applicant_id&&s.case_id===r.case_id&&s.request_hash===r.source_hash&&s.client_price_cents===r.amount_minor&&!['cancelled','completed'].includes(s.status)&&await currentClientReview(db,r.client_id));}
export async function readBookingCollections(db:D1Database,actor:SigningActor,liveOnly=false){
 const rows=await db.prepare(`SELECT r.* FROM booking_collection_requests r WHERE ${liveOnly?"r.mode='live'":"1=1"} ${actor.operations?'':"AND r.applicant_id=? AND EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=r.client_id AND l.owner_user_id=?)"} ORDER BY r.created_at DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId,actor.userId])).all<Saved>();
 const collections=[];for(const r of rows.results){const evidence=actor.operations?(await db.prepare('SELECT source,event,payload_hash,transaction_json,recorded_at FROM booking_collection_evidence WHERE reference=? ORDER BY rowid DESC LIMIT 100').bind(r.reference).all()).results:[];
 collections.push({...r,checkout_url:actor.operations?null:r.checkout_url,evidence,current:await currentCollection(db,r)});}
 return {collections,collectionRequiresSettlement:true};
}
async function callProvider(secret:string,path:string,body:unknown,transport:typeof fetch){
 const res=await fetchWithoutRedirect(transport,'https://api.paystack.co'+path,{method:body?'POST':'GET',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+secret,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const p=await readFinanceProviderJson(res);if(!res.ok||p.status!==true||!p.data)throw new SignupError('Provider response is uncertain. Verify the saved reference before taking further action.',503);return p.data;
}
export async function operateBookingCollection(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers,runtime:CollectionRuntime={},transport:typeof fetch=fetch){
 const action=String(input.action),now=new Date().toISOString();
 if(action==='prepare_collection'){
  if(!actor.operations)throw new SignupError('Operations must prepare booking collection.',403);
  const s=await orderSource(db,reference(input.orderId));
  if(!s||!await currentClientReview(db,s.client_id)||s.case_version!==input.caseVersion||s.funding_status!=='unfunded'||s.status!=='draft'||!Number.isSafeInteger(s.client_price_cents)||s.client_price_cents<=0)throw new SignupError('Choose a current approved client and an unfunded draft service order.',409);
  if(s.owner_user_id===actor.userId)throw new SignupError('Independent Operations preparation is required.',403);
  if(input.mode!=='test'&&input.mode!=='live')throw new SignupError('Choose an explicit provider mode.');
  const maker=await productionOperatorControl(db,actor,headers,'funding.verify',s.client_price_cents);
  const old=await db.prepare('SELECT reference FROM booking_collection_requests WHERE order_id=? AND mode=?').bind(s.id,input.mode).first();if(old)return {alreadyPrepared:true,funded:false};
  await db.prepare(`INSERT INTO booking_collection_requests(reference,order_id,client_id,applicant_id,case_id,case_version,source_hash,amount_minor,currency,mode,state,prepared_by,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'ZAR',?,'prepared',?,1,?,?)`).bind('lokd-booking-'+crypto.randomUUID(),s.id,s.client_id,s.owner_user_id,s.case_id,s.case_version,s.request_hash,s.client_price_cents,input.mode,maker.id,now,now).run();
  return {prepared:true,funded:false};
 }
 const r=await db.prepare('SELECT * FROM booking_collection_requests WHERE reference=?').bind(reference(input.reference)).first<Saved>();
 if(!r||!actor.operations&&r.applicant_id!==actor.userId)throw new SignupError('Collection not found for this account.',404);
 if(input.revision!==r.revision)throw new SignupError('Collection changed. Refresh the saved reference.',409);
 if(action==='approve_collection'){
  const reviewer=await productionOperatorControl(db,actor,headers,'funding.verify',r.amount_minor,r.prepared_by);
  if(actor.userId===r.applicant_id||r.state!=='prepared'||!await currentCollection(db,r)||input.evidenceReviewed!==true)throw new SignupError('Review the current order and its exact collection binding independently.',409);
  const changed=await db.prepare("UPDATE booking_collection_requests SET state='approved',approved_by=?,revision=revision+1,updated_at=? WHERE reference=? AND revision=? AND state='prepared'").bind(reviewer.id,now,r.reference,r.revision).run();if(!changed.meta.changes)throw new SignupError('Another approval completed. Refresh.',409);
  return {approved:true,funded:false};
 }
 if(action==='initialize_collection'){
  if(actor.operations||actor.userId!==r.applicant_id)throw new SignupError('Only the bound client may open this checkout.',403);
  if(!await currentCollection(db,r))throw new SignupError('The client or service order changed. Operations review is required.',409);
  if(r.state!=='approved')return {savedReference:r.reference,repeatDispatch:false,funded:false};
  const secret=collectionKey(runtime,r.mode);
  // Claim durably before the network request. A crash leaves initializing and can only verify.
  const claim=await db.prepare("UPDATE booking_collection_requests SET state='initializing',revision=revision+1,updated_at=? WHERE reference=? AND revision=? AND state='approved'").bind(now,r.reference,r.revision).run();if(!claim.meta.changes)throw new SignupError('Checkout already started. Refresh.',409);
  try{
   const data=await callProvider(secret,'/transaction/initialize',{email:actor.email,reference:r.reference,amount:String(r.amount_minor),currency:r.currency,metadata:JSON.stringify(collectionMetadata(binding(r)))},transport) as Record<string,unknown>;
   if(data.reference!==r.reference||typeof data.authorization_url!=='string')throw Error('Wrong checkout binding');
   const url=new URL(data.authorization_url);if(url.origin!=='https://checkout.paystack.com'||url.username||url.password||url.hash)throw Error('Unexpected checkout URL');
   await db.prepare("UPDATE booking_collection_requests SET state='awaiting_checkout',checkout_url=?,revision=revision+1,updated_at=? WHERE reference=? AND state='initializing'").bind(url.href,new Date().toISOString(),r.reference).run();
  }catch{
   await db.prepare("UPDATE booking_collection_requests SET state='initialization_unknown',revision=revision+1,updated_at=? WHERE reference=? AND state='initializing'").bind(new Date().toISOString(),r.reference).run();
  }
  return {savedReference:r.reference,funded:false};
 }
 if(action!=='verify_collection')throw new SignupError('Choose a supported collection action.');
 await productionOperatorControl(db,actor,headers,'funding.verify',r.amount_minor);
 if(actor.userId===r.applicant_id||!r.approved_by||['prepared','approved'].includes(r.state))throw new SignupError('Verify a dispatched collection independently.',409);
 const data=await callProvider(collectionKey(runtime,r.mode),'/transaction/verify/'+encodeURIComponent(r.reference),null,transport),api=collectionTransaction(data);
 const events=(await db.prepare("SELECT event,transaction_json FROM booking_collection_evidence WHERE reference=? AND source='webhook'").bind(r.reference).all<{event:string;transaction_json:string}>()).results;
 const target=collectionEvidenceDecision(binding(r),api,events.map(e=>({event:e.event,transaction:JSON.parse(e.transaction_json) as CollectionTransaction|null})),r.provider_id,await currentCollection(db,r));
 // Preserve the first validated transaction ID; contradictory responses cannot rebind it.
 const providerId=r.provider_id??(api&&target!=='review_required'?api.id:null),json=JSON.stringify({transaction:api,expectedRevision:r.revision}),hash=await agreementHash(JSON.stringify({transaction:api,revision:r.revision}));
 await db.batch([
  db.prepare("INSERT INTO booking_collection_evidence VALUES(?,?,'api','verify',?,?,?,?)").bind(crypto.randomUUID(),r.reference,hash,json,actor.userId,new Date().toISOString()),
  db.prepare('UPDATE booking_collection_requests SET state=?,provider_id=?,revision=revision+1,updated_at=? WHERE reference=? AND revision=?').bind(target,providerId,new Date().toISOString(),r.reference,r.revision),
 ]);
 const stored=await db.prepare('SELECT state FROM booking_collection_requests WHERE reference=?').bind(r.reference).first<{state:string}>();
 return {state:stored!.state,funded:false,settled:false};
}

export async function receiveBookingCollectionWebhook(request:Request,db:D1Database,runtime:CollectionRuntime,mode:'test'|'live'){
 const secret=collectionKey(runtime,mode,true),signature=request.headers.get('x-paystack-signature')??'';
 if(!/^[a-f0-9]{128}$/i.test(signature))throw new SignupError('Invalid webhook signature.',401);
 const raw=await readFinanceWebhookBytes(request);
 const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',k,Uint8Array.from(signature.match(/../g)!,v=>parseInt(v,16)),raw))throw new SignupError('Invalid webhook signature.',401);
 let p;try{p=JSON.parse(new TextDecoder().decode(raw));}catch{throw new SignupError('Invalid event JSON.');}
 if(!p||typeof p.event!=='string'||p.event.length>100||!p.data||typeof p.data!=='object')throw new SignupError('Invalid provider event.',422);
 if(p.event.startsWith('refund.')||p.event.startsWith('charge.dispute.')){
  // Refund/dispute envelopes use a nested transaction (or transaction ID), and
  // can omit domain. The verified secret selects mode; explicit conflicts fail.
  const nested=p.data.transaction,tx=nested&&typeof nested==='object'?nested:null;
  if(p.data.domain!==undefined&&p.data.domain!==mode||tx?.domain!==undefined&&tx.domain!==mode)throw new SignupError('Recovery event mode conflicts with this receiver.',422);
  const rawId=tx?.id??nested,tid=typeof rawId==='number'&&Number.isSafeInteger(rawId)&&rawId>0?String(rawId):typeof rawId==='string'&&/^[1-9][0-9]{0,39}$/.test(rawId)?rawId:null;
  const ref=typeof tx?.reference==='string'?tx.reference:typeof p.data.transaction_reference==='string'?p.data.transaction_reference:null;
  const rows=(await db.prepare('SELECT reference FROM booking_collection_requests WHERE mode=? AND ((provider_id IS NOT NULL AND provider_id=?) OR reference=?)').bind(mode,tid,ref).all<{reference:string}>()).results;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
  await db.prepare('INSERT OR IGNORE INTO booking_provider_recovery_inbox VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),mode,tid,ref,p.event,hash,JSON.stringify({refund:refundEvidence(p.data),refundEvent:refundWebhookEvidence(p.data),transactionId:tid,transactionReference:ref,amountMinor:Number.isSafeInteger(p.data.amount)?p.data.amount:null,currency:typeof p.data.currency==='string'?p.data.currency.slice(0,3):null,action:'hold_pending_investigation',moneyMoved:false}),new Date().toISOString()).run();
  return {received:true,matchedReference:rows.length>0,funded:false};
 }
 if(p.data.domain!==mode)throw new SignupError('Event mode or type does not match this receiver.',422);
 // Unknown references do not create payment requests or fund a booking.
 const r=await db.prepare('SELECT * FROM booking_collection_requests WHERE reference=? AND mode=?').bind(typeof p.data.reference==='string'?p.data.reference:'',mode).first<Saved>();if(!r)return {received:true,matchedReference:false,funded:false};
 const transaction=collectionTransaction(p.data),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),b=>b.toString(16).padStart(2,'0')).join('');
 // New signed evidence invalidates a previous match until API verification runs again.
 await db.prepare("INSERT OR IGNORE INTO booking_collection_evidence VALUES(?,?,'webhook',?,?,?,NULL,?)").bind(crypto.randomUUID(),r.reference,p.event,hash,JSON.stringify(transaction),new Date().toISOString()).run();
 return {received:true,matchedReference:true,funded:false};
}
