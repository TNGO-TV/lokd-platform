import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {agreementHash} from './agreement-acceptance';
import {currentClientReview} from './production-client-review';
import {lokdInvoicePublicNumber,lokdQuoteMonthKey} from './lokd-numbering';

const field=(v:unknown,label:string,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new SignupError('Provide '+label+'.');return v.trim();};
export const quoteAcknowledgement='I accept this quote and the linked Terms and Conditions, and confirm that I am authorised to accept for the named client.';
export type QuoteSource={order_id:string;client_id:string;owner_user_id:string;entity_id:string;case_version:number;order_version:number;source_json:string};
type Terms={id:string;title:string;version:string;entity_id:string;file_hash:string;size_bytes:number;storage_key:string;approved_at:string|null;withdrawn:number};
export type Offer={id:string;order_id:string;owner_user_id:string;terms_id:string;source_json:string;source_hash:string;offer_hash:string;issued_at:string;expires_at:string;sequence:number;public_number?:string|null;receipt_json?:string|null;receipt_hash?:string|null;cancelled?:number};
export async function quoteSource(db:D1Database,id:string){
 const s=await db.prepare('SELECT * FROM client_quote_sources WHERE order_id=?').bind(id).first<QuoteSource>();
 if(!s||!await currentClientReview(db,s.client_id))throw new SignupError('A current reviewed client and production service order are required.',409);
 return s;
}
export async function termsRecord(db:D1Database,id:string){
 const t=await db.prepare(`SELECT t.*,a.approved_at,EXISTS(SELECT 1 FROM client_terms_withdrawals w WHERE w.terms_id=t.id) AS withdrawn FROM client_terms_files t LEFT JOIN client_terms_approvals a ON a.terms_id=t.id WHERE t.id=?`).bind(id).first<Terms>();
 if(!t)throw new SignupError('Terms file not found.',404);return t;
}
export async function termsBytes(bucket:R2Bucket,t:Terms){
 const o=await bucket.get(t.storage_key);if(!o||o.size!==t.size_bytes)throw new SignupError('The terms file is unavailable.',503);
 const bytes=await o.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes);
 const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==t.file_hash)throw new SignupError('Terms file integrity check failed.',409);return bytes;
}
export async function uploadTerms(db:D1Database,bucket:R2Bucket,actor:SigningActor,input:Record<string,unknown>){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const title=field(input.title,'a document title'),version=field(input.version,'a distinct version',80),entity=field(input.entityId,'the contracting entity');
 if(typeof input.contentBase64!=='string'||input.contentBase64.length>6_700_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contentBase64))throw new SignupError('Upload a PDF up to 5 MB.');
 let bytes:Uint8Array<ArrayBuffer>;try{bytes=Uint8Array.from(atob(input.contentBase64),c=>c.charCodeAt(0));}catch{throw new SignupError('Invalid PDF encoding.');}
 if(bytes.length<8||bytes.length>5_000_000||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw new SignupError('Upload a PDF up to 5 MB.');
 const digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 const id='TERMS-'+crypto.randomUUID(),key='production/client-terms/'+id,now=new Date().toISOString();
 await bucket.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
 // Never remove an object after an uncertain database response: it may already be committed.
 await db.prepare('INSERT INTO client_terms_files VALUES(?,?,?,?,?,?,?,?,?)').bind(id,title,version,entity,key,hash,bytes.length,actor.userId,now).run();
 return {termsId:id};
}
export async function manageTerms(db:D1Database,bucket:R2Bucket,actor:SigningActor,input:Record<string,unknown>){
 if(!actor.operations||!actor.owner)throw new SignupError('The authorised Operations owner must approve or withdraw terms.',403);
 const t=await termsRecord(db,field(input.termsId,'terms version')),now=new Date().toISOString();
 if(input.action==='withdraw_terms'){
  const reason=field(input.reason,'a withdrawal reason',1200);
  await db.prepare('INSERT OR IGNORE INTO client_terms_withdrawals VALUES(?,?,?,?)').bind(t.id,actor.userId,reason,now).run();return {withdrawn:true};
 }
 if(input.action!=='approve_terms'||input.legalApprovalConfirmed!==true||input.fileHash!==t.file_hash||t.withdrawn)throw new SignupError('Approve the exact completed terms file after legal review.',409);
 await termsBytes(bucket,t);
 await db.prepare('INSERT OR IGNORE INTO client_terms_approvals VALUES(?,?,?,?)').bind(t.id,t.file_hash,actor.userId,now).run();return {approved:true};
}
async function offer(db:D1Database,id:string,actor?:SigningActor){
 const q=await db.prepare('SELECT * FROM client_quote_offers WHERE id=?').bind(id).first<Offer>();
 if(!q||actor&&!actor.operations&&actor.userId!==q.owner_user_id)throw new SignupError('Quote not found for this account.',404);return q;
}
export async function currentQuote(db:D1Database,id:string,clock=Date.now(),allowAccepted=false){
 const q=await offer(db,id),s=await quoteSource(db,q.order_id),t=await termsRecord(db,q.terms_id);
 const latest=await db.prepare('SELECT MAX(sequence) AS n FROM client_quote_offers WHERE order_id=?').bind(q.order_id).first<{n:number}>();
 if(q.source_json!==s.source_json||q.owner_user_id!==s.owner_user_id||await agreementHash(q.source_json)!==q.source_hash||q.sequence!==latest?.n||!t.approved_at||t.withdrawn||t.entity_id!==s.entity_id||await db.prepare('SELECT quote_id FROM client_quote_cancellations WHERE quote_id=?').bind(id).first())throw new SignupError('The quote, client details or terms changed. Request a current quote.',409);
 const receipt=await db.prepare('SELECT receipt_json,receipt_hash FROM client_quote_receipts WHERE quote_id=?').bind(id).first<{receipt_json:string;receipt_hash:string}>();
 if(!receipt&&Date.parse(q.expires_at)<=clock)throw new SignupError('This quote has expired.',409);
 if(receipt&&!allowAccepted)throw new SignupError('This quote is already accepted.',409);
 const expected=await agreementHash(JSON.stringify({sourceHash:q.source_hash,termsId:t.id,termsHash:t.file_hash,expiresAt:q.expires_at,acknowledgement:quoteAcknowledgement}));
 if(q.offer_hash!==expected)throw new SignupError('Quote integrity check failed.',409);
 return {q,s,t,receipt};
}
export async function issueQuote(db:D1Database,bucket:R2Bucket,actor:SigningActor,input:Record<string,unknown>,now=new Date()){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const s=await quoteSource(db,field(input.orderId,'a service order'));
 if(s.owner_user_id===actor.userId)throw new SignupError('Another operator must issue your quote.',403);
 const t=await termsRecord(db,field(input.termsId,'approved terms'));
 if(!t.approved_at||t.withdrawn||t.entity_id!==s.entity_id)throw new SignupError('Choose approved terms for the order’s contracting entity.',409);
 await termsBytes(bucket,t);
 const latest=await db.prepare('SELECT * FROM client_quote_offers WHERE order_id=? ORDER BY sequence DESC LIMIT 1').bind(s.order_id).first<Offer>();
 if(Number(input.expectedSequence)!==(latest?.sequence??0))throw new SignupError('The quote changed. Refresh before issuing.',409);
 const expires=field(input.expiresAt,'quote expiry'),expiry=Date.parse(expires);
 if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+30*86400000)throw new SignupError('Choose an expiry within the next 30 days.');
 if(latest&&await db.prepare('SELECT r.quote_id FROM client_quote_receipts r WHERE r.quote_id=? AND NOT EXISTS(SELECT 1 FROM client_quote_cancellations c WHERE c.quote_id=r.quote_id)').bind(latest.id).first())throw new SignupError('This order already has an accepted quote. Cancel it with a reason before replacing it.',409);
 const sourceHash=await agreementHash(s.source_json),expiresAt=new Date(expiry).toISOString(),id='QUOTE-'+crypto.randomUUID();
 const hash=await agreementHash(JSON.stringify({sourceHash,termsId:t.id,termsHash:t.file_hash,expiresAt,acknowledgement:quoteAcknowledgement}));
 const issuedAt=now instanceof Date?now:new Date(now);
 if(!Number.isFinite(issuedAt.getTime()))throw new SignupError('Quote issue time is unavailable.',503);
 const monthKey=lokdQuoteMonthKey(issuedAt);
 try{
  await db.prepare('INSERT INTO client_quote_offer_issues(id,order_id,owner_user_id,terms_id,source_json,source_hash,offer_hash,issued_by,issued_at,expires_at,sequence,case_version,month_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,s.order_id,s.owner_user_id,t.id,s.source_json,sourceHash,hash,actor.userId,issuedAt.toISOString(),expiresAt,(latest?.sequence??0)+1,s.case_version,monthKey).run();
 }catch(error){if(error instanceof Error&&error.message.includes('quote_month_sequence_exhausted'))throw new SignupError('This month\'s LOKD quote numbers are exhausted.',409);throw error;}
 const stored=await db.prepare('SELECT public_number FROM client_quote_offers WHERE id=?').bind(id).first<{public_number:string|null}>();
 if(!stored?.public_number||!stored.public_number.startsWith('LOKD'+monthKey))throw new SignupError('Quote number was not assigned.',409);
 return {quoteId:id,publicNumber:stored.public_number,invoicePublicNumber:lokdInvoicePublicNumber(stored.public_number),emailDelivery:'queued'};
}
export async function acceptQuote(db:D1Database,bucket:R2Bucket,actor:SigningActor,input:Record<string,unknown>){
 const id=field(input.quoteId,'a quote'),q=await offer(db,id,actor);
 if(actor.operations||actor.userId!==q.owner_user_id)throw new SignupError('Only the named client account can accept this quote.',403);
 if(input.affirmative!==true||input.offerHash!==q.offer_hash)throw new SignupError('Tick acceptance of the exact quote and linked terms.');
 const current=await currentQuote(db,id,Date.now(),true);
 if(current.receipt){if(await agreementHash(current.receipt.receipt_json)!==current.receipt.receipt_hash)throw new SignupError('Receipt integrity check failed.',409);return {alreadyAccepted:true};}
 await termsBytes(bucket,current.t);
 const receiptJson=JSON.stringify({quoteId:id,orderId:q.order_id,actorUserId:actor.userId,acceptedAt:new Date().toISOString(),acknowledgement:quoteAcknowledgement,offerHash:q.offer_hash,quote:JSON.parse(q.source_json),terms:{id:current.t.id,title:current.t.title,version:current.t.version,sha256:current.t.file_hash}});
 await db.prepare('INSERT OR IGNORE INTO client_quote_receipts VALUES(?,?,?,?,?)').bind(id,actor.userId,receiptJson,await agreementHash(receiptJson),JSON.parse(receiptJson).acceptedAt).run();
 return {accepted:true,workEligible:false};
}
export async function cancelQuote(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const q=await offer(db,field(input.quoteId,'a quote')),reason=field(input.reason,'a cancellation reason',1200);
 await db.prepare('INSERT OR IGNORE INTO client_quote_cancellations VALUES(?,?,?,?)').bind(q.id,actor.userId,reason,new Date().toISOString()).run();
 return {cancelled:true};
}
export async function readQuotes(db:D1Database,actor:SigningActor){

 const [quotes,terms,orders]=await Promise.all([
  db.prepare(`SELECT q.*,t.title AS terms_title,t.version AS terms_version,r.receipt_json,r.receipt_hash,j.state AS email_delivery_state,EXISTS(SELECT 1 FROM client_quote_cancellations c WHERE c.quote_id=q.id) AS cancelled,EXISTS(SELECT 1 FROM client_terms_withdrawals w WHERE w.terms_id=q.terms_id) AS terms_withdrawn FROM client_quote_offers q JOIN client_terms_files t ON t.id=q.terms_id LEFT JOIN client_quote_receipts r ON r.quote_id=q.id LEFT JOIN operational_delivery_jobs j ON j.source_id=q.id AND j.kind='contract_email' ${actor.operations?'':'WHERE q.owner_user_id=?'} ORDER BY q.issued_at DESC LIMIT 100`).bind(...actor.operations?[]:[actor.userId]).all(),
  actor.operations?db.prepare('SELECT t.id,t.title,t.version,t.entity_id,t.file_hash,a.approved_at,EXISTS(SELECT 1 FROM client_terms_withdrawals w WHERE w.terms_id=t.id) AS withdrawn FROM client_terms_files t LEFT JOIN client_terms_approvals a ON a.terms_id=t.id ORDER BY t.uploaded_at DESC LIMIT 100').all():{results:[]},
  actor.operations?db.prepare('SELECT s.*,COALESCE((SELECT MAX(sequence) FROM client_quote_offers q WHERE q.order_id=s.order_id),0) AS sequence FROM client_quote_sources s ORDER BY order_id LIMIT 100').all():{results:[]},
 ]);
 return {quotes:quotes.results,terms:terms.results,orders:orders.results,owner:actor.owner,acknowledgement:quoteAcknowledgement};
}
export async function quoteFile(db:D1Database,bucket:R2Bucket,actor:SigningActor,id:string){
 const t=await termsRecord(db,id);
 if(!actor.operations&&!await db.prepare('SELECT id FROM client_quote_offers WHERE terms_id=? AND owner_user_id=? LIMIT 1').bind(id,actor.userId).first())throw new SignupError('Terms file not found for this account.',404);
 return {bytes:await termsBytes(bucket,t),t};
}
export async function acceptedOrderQuote(db:D1Database,orderId:string){
 const latest=await db.prepare('SELECT id FROM client_quote_offers WHERE order_id=? ORDER BY sequence DESC LIMIT 1').bind(orderId).first<{id:string}>();
 if(!latest)return {exists:false,receipt:null};
 try{
  const {q,t,receipt}=await currentQuote(db,latest.id,Date.now(),true);
  if(!receipt||await agreementHash(receipt.receipt_json)!==receipt.receipt_hash)return {exists:true,receipt:null};
  const r=JSON.parse(receipt.receipt_json);
  if(r.actorUserId!==q.owner_user_id||r.offerHash!==q.offer_hash||r.terms.sha256!==t.file_hash||JSON.stringify(r.quote)!==q.source_json||r.acknowledgement!==quoteAcknowledgement)return {exists:true,receipt:null};
  return {exists:true,receipt:{id:'QUOTE-ACCEPT-'+q.id,hash:receipt.receipt_hash,documentId:t.id,documentVersion:t.version,contextHash:q.source_hash}};
 }catch{return {exists:true,receipt:null};}
}
