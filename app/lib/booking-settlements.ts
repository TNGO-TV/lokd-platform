import {fetchWithoutRedirect} from './provider-fetch';
import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {binding,currentCollection,collectionKey,type Saved,type CollectionRuntime} from './booking-collections';
import {collectionEvidenceDecision,collectionTransaction,type CollectionTransaction} from './collection-evidence';
import {settlementEvidence,type SettlementEvidence} from './settlement-evidence';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
type Review={id:string;reference:string;collection_revision:number;mode:string;settlement_id:string;provider_id:string;payload_json:string;payload_hash:string;prepared_by:string;prepared_at:string;expires_at:string};
async function api(secret:string,path:string,transport:typeof fetch){const res=await fetchWithoutRedirect(transport,'https://api.paystack.co'+path,{headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(20000)});const p=await res.json() as {status?:boolean;data?:unknown;meta?:{page?:number;pageCount?:number;total?:number;perPage?:number}};if(!res.ok||p.status!==true)throw new SignupError('Settlement verification is unavailable. No funding was released.',503);return p;}
async function list(secret:string,path:string,transport:typeof fetch){
 const rows:Record<string,unknown>[]=[];let expectedTotal:number|undefined;
 for(let page=1;page<=20;page++){
  const p=await api(secret,path+(path.includes('?')?'&':'?')+'perPage=100&page='+page,transport);
  if(!Array.isArray(p.data)||!p.meta||p.meta.page!==page||!Number.isSafeInteger(p.meta.pageCount)||p.meta.pageCount!<1||p.meta.pageCount!>20||!Number.isSafeInteger(p.meta.total)||p.meta.total!<0||p.meta.total!>2000||p.data.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw new SignupError('Incomplete settlement pagination. Narrow the date range and reconcile the provider evidence.',409);
  if(expectedTotal!==undefined&&expectedTotal!==p.meta.total)throw new SignupError('Settlement records changed during retrieval. Verify again.',409);expectedTotal=p.meta.total;
  rows.push(...p.data);if(page===p.meta.pageCount){if(rows.length!==expectedTotal)throw new SignupError('Settlement transaction list is incomplete.',409);return rows;}
 }
 throw new SignupError('Settlement exceeds the review limit.',409);
}
export async function readBookingSettlements(db:D1Database,actor:SigningActor){
 const rows=await db.prepare(`SELECT s.id,s.reference,s.mode,s.settlement_id,s.payload_hash,s.prepared_at,s.expires_at,d.decision,d.note ${actor.operations?',s.payload_json,s.prepared_by':''} FROM booking_settlement_reviews s LEFT JOIN booking_settlement_decisions d ON d.review_id=s.id JOIN booking_collection_requests r ON r.reference=s.reference ${actor.operations?'':'WHERE r.applicant_id=?'} ORDER BY s.prepared_at DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId])).all();
 const recoveries=await db.prepare(`SELECT h.reference,h.source,h.event,h.created_at ${actor.operations?',h.detail':''} FROM booking_collection_recoveries h JOIN booking_collection_requests r ON r.reference=h.reference ${actor.operations?'':'WHERE r.applicant_id=?'} ORDER BY h.created_at DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId])).all();return {settlementReviews:rows.results,collectionRecoveries:recoveries.results};
}
export async function operateBookingSettlement(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers,runtime:CollectionRuntime={},transport:typeof fetch=fetch){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const reference=text(input.reference,'the collection reference',200),r=await db.prepare('SELECT * FROM booking_collection_requests WHERE reference=?').bind(reference).first<Saved>();if(!r)throw new SignupError('Collection not found.',404);
 const op=await productionOperatorControl(db,actor,headers,'funding.verify',r.amount_minor);
 if(actor.userId===r.applicant_id)throw new SignupError('Independent collection review is required.',403);
 const now=new Date().toISOString();
 if(input.action==='apply_booking_funding'){
  collectionKey(runtime,'live');
  if(r.mode!=='live'||!await currentCollection(db,r))throw new SignupError('A current live collection is required.',409);
  const funded=await db.prepare("SELECT id FROM booking_funding_reconciliations WHERE provider='paystack' AND provider_reference=? AND booking_id=? AND status='cleared_reconciled' AND active_key=? AND evidence_expires_at>?").bind(reference,r.order_id,r.order_id,now).first();
  if(!funded)throw new SignupError('Current independently reconciled funding is required.',409);
  // Existing site/pricing/authority guards decide whether this order may progress.
  try{const changed=await db.prepare("UPDATE bookings SET funding_status='paid_in_full',status='matching' WHERE id=? AND funding_status='unfunded' AND status='draft'").bind(r.order_id).run();if(!changed.meta.changes)throw new SignupError('The booking already changed. Refresh.',409);}catch(e){if(e instanceof SignupError)throw e;throw new SignupError('Cleared funds are retained. Complete the current site, pricing and service-authority reviews before applying funding to this order.',409);}
  return {bookingFunded:true,moneyMoved:false};
 }
 if(input.action==='hold_collection'){
  const note=text(input.note,'the refund, dispute or settlement investigation findings');
  await db.prepare("INSERT OR IGNORE INTO booking_collection_recoveries VALUES(?,?,'operations','manual_hold',?,?,?,?)").bind(crypto.randomUUID(),reference,await agreementHash(JSON.stringify({note,actor:actor.userId})),JSON.stringify({note,action:'hold_pending_investigation',moneyMoved:false}),actor.userId,now).run();return {held:true,moneyMoved:false};
 }
 if(input.action==='prepare_settlement'){
  if(r.revision!==input.revision||!r.provider_id||!['matched_test','matched_live_unsettled'].includes(r.state)||!await currentCollection(db,r))throw new SignupError('Verify the current collection before settlement review.',409);
  if(await db.prepare('SELECT id FROM booking_collection_recoveries WHERE reference=? LIMIT 1').bind(reference).first())throw new SignupError('Collection has unresolved recovery evidence. Funding remains held.',409);
  if(input.bankReceiptReviewed!==true)throw new SignupError('Review the actual bank receipt for this full provider settlement.');
  const bankReference=text(input.bankReference,'the bank receipt evidence reference',200),bankNote=text(input.note,'the settlement reconciliation findings');
  const settlementId=text(input.settlementId,'the provider settlement ID',40);if(!/^[1-9][0-9]*$/.test(settlementId))throw new SignupError('Use the numeric provider settlement ID.');
  const from=text(input.from,'the settlement date range start',30),to=text(input.to,'the settlement date range end',30);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||new Date(from).toISOString().slice(0,10)!==from||new Date(to).toISOString().slice(0,10)!==to||Date.parse(to)<Date.parse(from)||Date.parse(to)-Date.parse(from)>31*86400000)throw new SignupError('Choose a valid settlement search range of up to 31 days.');
  const prior=await db.prepare('SELECT id FROM booking_settlement_reviews WHERE reference=? AND collection_revision=?').bind(reference,r.revision).first();if(prior)return {alreadyPrepared:true};
  const secret=collectionKey(runtime,r.mode),transactions=await list(secret,'/settlement/'+settlementId+'/transactions',transport),settlements=await list(secret,'/settlement?subaccount=none&from='+from+'&to='+to+'T23%3A59%3A59.999Z',transport);
  const candidates=settlements.filter(s=>String(s.id)===settlementId);if(candidates.length!==1)throw new SignupError('The provider did not return exactly one matching settlement.',409);
  const evidence=settlementEvidence(binding(r),r.provider_id,candidates[0],transactions,input.bankAmountMinor);if(!evidence)throw new SignupError('Settlement, transaction totals, fees or the bank receipt do not agree.',409);
  const verified=collectionTransaction((await api(secret,'/transaction/verify/'+encodeURIComponent(reference),transport)).data);
  const events=(await db.prepare("SELECT event,transaction_json FROM booking_collection_evidence WHERE reference=? AND source='webhook'").bind(reference).all<{event:string;transaction_json:string}>()).results.map(e=>({event:e.event,transaction:JSON.parse(e.transaction_json) as CollectionTransaction|null}));
  if(collectionEvidenceDecision(binding(r),verified,events,r.provider_id,await currentCollection(db,r))!==(r.mode==='live'?'matched_live_unsettled':'matched_test')||JSON.stringify(verified)!==JSON.stringify(evidence.transaction))throw new SignupError('Current transaction and settlement evidence disagree.',409);
  const payload=JSON.stringify({binding:binding(r),evidence,bankReference,bankNote,bankReceiptReviewed:true}),hash=await agreementHash(payload),id='SET-'+crypto.randomUUID();
  await db.prepare('INSERT INTO booking_settlement_reviews VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,reference,r.revision,r.mode,settlementId,r.provider_id,payload,hash,op.id,now,new Date(Date.now()+30*60000).toISOString()).run();return {settlementReviewId:id,funded:false};
 }
 if(input.action!=='approve_settlement'&&input.action!=='reject_settlement')throw new SignupError('Choose a supported settlement action.');
 const s=await db.prepare('SELECT * FROM booking_settlement_reviews WHERE id=? AND reference=?').bind(text(input.reviewId,'the settlement review',200),reference).first<Review>();if(!s)throw new SignupError('Settlement review not found.',404);
 await productionOperatorControl(db,actor,headers,'funding.verify',r.amount_minor,s.prepared_by);
 if(input.payloadHash!==s.payload_hash||await agreementHash(s.payload_json)!==s.payload_hash)throw new SignupError('Settlement evidence changed. Refresh.',409);
 if(await db.prepare('SELECT id FROM booking_settlement_decisions WHERE review_id=?').bind(s.id).first())return {alreadyDecided:true};
 const approving=input.action==='approve_settlement',note=text(input.note,'the independent settlement decision');
 if(approving){if(input.evidenceReviewed!==true||s.expires_at<=now||r.revision!==s.collection_revision||!await currentCollection(db,r))throw new SignupError('Review fresh settlement and bank evidence against the current collection.',409);if(r.mode==='live')collectionKey(runtime,r.mode);}
 const decision=approving?r.mode==='live'?'cleared_live':'confirmed_test':'rejected',payload=JSON.parse(s.payload_json) as {evidence:SettlementEvidence};
 const statements=[db.prepare('INSERT INTO booking_settlement_decisions VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),s.id,decision,actor.userId,op.id,note,now)];
 if(decision==='cleared_live'){
  const e=payload.evidence;
  const horizon=await db.prepare('SELECT max(ends_at) AS end FROM roster_slots WHERE booking_id=?').bind(r.order_id).first<{end:string|null}>();
  const validThrough=new Date(Math.max(Date.now()+86400000,Date.parse(horizon?.end??now)+86400000)).toISOString();
  statements.push(db.prepare(`INSERT INTO booking_funding_reconciliations(id,booking_id,environment,integrity_state,provider,provider_reference,currency,expected_amount_cents,cleared_amount_cents,status,cleared_at,reconciled_at,evidence_reference,evidence_verified_at,evidence_expires_at,version,active_key,created_at) VALUES(?,?,'production','production_verified','paystack',?,'ZAR',?,?,'cleared_reconciled',?,?,?,?,?,1,?,?)`).bind('FUND-'+s.id,r.order_id,r.reference,r.amount_minor,r.amount_minor,e.settledAt,now,'settlement-review:'+s.id,now,validThrough,r.order_id,now));
 }
 await db.batch(statements);return {decision,cleared:decision==='cleared_live',bookingFunded:false,moneyMoved:false};
}
