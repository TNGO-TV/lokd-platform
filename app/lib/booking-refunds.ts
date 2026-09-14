import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import {collectionKey,type CollectionRuntime} from './booking-collections';
import {refundEvidence} from './booking-refund-evidence';
import type {SigningActor} from './production-signing';
export type RefundRuntime=CollectionRuntime&{LOKD_LIVE_REFUNDS_ENABLED?:string;LOKD_LIVE_PAYMENTS_ENABLED?:string};
type Source={reference:string;order_id:string;mode:'test'|'live';provider_id:string;amount_minor:number;applicant_id:string;source_json:string};
type Case={id:string;reference:string;payload_json:string;payload_hash:string;operator_id:string;user_id:string};
const text=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
const digest=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw new SignupError('Provide the exact SHA-256 evidence digest.');return v;};
const auth=()=>operationsMfaRequired()?'mfa_verified':'owner_mfa_exception';
async function source(db:D1Database,reference:unknown){const s=await db.prepare('SELECT * FROM booking_refund_sources WHERE reference=?').bind(text(reference,'the original collection reference',200)).first<Source>();if(!s||!s.provider_id)throw new SignupError('A bound collected transaction is required. Uncertain collection remains held.',409);return s;}
async function authority(db:D1Database,a:SigningActor,h:Headers,s:Source,maker?:string){if(a.userId===s.applicant_id)throw new SignupError('Collection participants cannot resolve their own refund.',403);return productionOperatorControl(db,a,h,'funding.verify',s.amount_minor,maker);}
async function api(secret:string,path:string,transport:typeof fetch,body?:unknown){try{const response=await transport('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});const p=await response.json() as {status?:boolean;data?:unknown};if(!response.ok||p.status!==true)throw Error('unavailable');return p.data;}catch{throw new SignupError(body?'Refund submission is uncertain. Keep its original claim; do not submit again.':'Provider evidence is unavailable. Keep the original refund held.',503);}}
async function watermark(db:D1Database,reference:string){return (await db.prepare('SELECT count(*) AS n FROM booking_collection_recoveries WHERE reference=?').bind(reference).first<{n:number}>())!.n;}
async function observe(db:D1Database,c:Case,kind:'initiate'|'verify',raw:unknown,mark:number){await db.prepare('INSERT INTO booking_refund_observations VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,kind,JSON.stringify(refundEvidence(raw)),mark,new Date().toISOString()).run();}
export async function readBookingRefunds(db:D1Database,a:SigningActor,h:Headers,runtime:RefundRuntime={}){
 await productionOperatorControl(db,a,h,'funding.verify',0);
 const cases=await db.prepare(`SELECT c.*,d.decision,k.id AS claim_id,(SELECT id FROM booking_refund_authorized WHERE id=c.id) AS current_approval FROM booking_refund_cases c LEFT JOIN booking_refund_decisions d ON d.case_id=c.id LEFT JOIN booking_refund_claims k ON k.case_id=c.id ORDER BY c.rowid DESC LIMIT 100`).all();
 const receipts=await db.prepare('SELECT r.*,d.decision FROM booking_refund_receipts r LEFT JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id ORDER BY r.rowid DESC LIMIT 100').all();
 const observations=await db.prepare('SELECT * FROM booking_refund_observations ORDER BY rowid DESC LIMIT 200').all();
 const candidates=(await db.prepare('SELECT * FROM booking_refund_sources WHERE provider_id IS NOT NULL ORDER BY reference LIMIT 500').all<Source>()).results,visible:Source[]=[];
 for(const candidate of candidates){try{await authority(db,a,h,candidate);visible.push(candidate);}catch(error){if(!(error instanceof SignupError)||error.status!==403)throw error;}}
 const references=new Set(visible.map(s=>s.reference)),visibleCases=cases.results.filter(c=>references.has(String(c.reference))),ids=new Set(visibleCases.map(c=>c.id));
 return {sources:visible,refundCases:visibleCases,refundReceipts:receipts.results.filter(r=>ids.has(r.case_id)),refundObservations:observations.results.filter(o=>ids.has(o.case_id)),refundStates:(await db.prepare('SELECT * FROM booking_refund_state').all()).results.filter(s=>references.has(String(s.reference))),liveRefundsEnabled:runtime.LOKD_LIVE_PAYMENTS_ENABLED==='true'&&(await db.prepare('SELECT enabled FROM payment_live_control WHERE id=1').first<{enabled:number}>())?.enabled===1&&runtime.LOKD_LIVE_REFUNDS_ENABLED==='true'&&(await db.prepare('SELECT enabled FROM booking_refund_control WHERE id=1').first<{enabled:number}>())?.enabled===1};
}
export async function operateBookingRefund(db:D1Database,a:SigningActor,input:Record<string,unknown>,h:Headers,runtime:RefundRuntime={},transport:typeof fetch=fetch){
 if(!a.operations)throw new SignupError('Operations access required.',403);
 const action=String(input.action),s=await source(db,input.reference),op=await authority(db,a,h,s),now=new Date().toISOString();
 if(action==='prepare_refund_case'){
  const note=text(input.note,'the investigation findings'),key=text(input.requestKey,'a stable request key',200);
  if(input.evidenceReviewed!==true||input.liabilitiesReviewed!==true)throw new SignupError('Review the original collection, refund policy and downstream service and payment liabilities.');
  if(input.intent!=='refund'&&input.intent!=='investigate')throw new SignupError('Choose a refund or held investigation.');
  const credit=input.intent==='refund'?await db.prepare("SELECT c.*,n.number FROM credit_notes c JOIN credit_note_issues n ON n.credit_id=c.id JOIN credit_note_sources i ON i.invoice_id=c.invoice_id WHERE c.id=? AND i.booking_id=? AND c.direction=1 AND NOT EXISTS(SELECT 1 FROM credit_notes v JOIN credit_note_issues vi ON vi.credit_id=v.id WHERE v.reverses_id=c.id)").bind(text(input.creditNoteId,'the independently issued credit',200),s.order_id).first<{id:string;net_cents:number;tax_cents:number}>():null;
  if(input.intent==='refund'&&!credit)throw new SignupError('An unvoided issued credit for this original order is required.',409);
  const amount=credit?credit.net_cents+credit.tax_cents:s.amount_minor;
  const externalRefundId=input.externalRefundId===undefined?null:text(input.externalRefundId,'the existing provider refund ID',40);if(externalRefundId&&!/^[1-9][0-9]*$/.test(externalRefundId))throw new SignupError('Use the numeric existing refund ID.');
  const request={externalRefundId,creditNoteId:credit?.id??null,amountMinor:amount,reference:s.reference,intent:input.intent,note,policyReference:text(input.policyReference,'the approved policy reference',200),policyHash:digest(input.policyHash),liabilityPlan:text(input.liabilityPlan,'the explicit service and liability disposition'),evidenceHash:digest(input.evidenceHash)};
  const requestHash=await agreementHash(JSON.stringify(request));
  const prior=await db.prepare('SELECT id,payload_json FROM booking_refund_cases WHERE request_key=?').bind(key).first<{id:string;payload_json:string}>();if(prior){if(JSON.parse(prior.payload_json).requestHash!==requestHash)throw new SignupError('Request key belongs to different findings.',409);return {caseId:prior.id,alreadyPrepared:true,fundingAvailable:false};}
  // Preserve an immutable hold before preparing any monetary instruction. A later failure leaves it held.
  await db.prepare("INSERT OR IGNORE INTO booking_collection_recoveries VALUES(?,?,'operations','refund_investigation',?,?,?,?)").bind(crypto.randomUUID(),s.reference,requestHash,JSON.stringify({note,action:'hold_pending_investigation',moneyMoved:false}),a.userId,now).run();
  const current=await source(db,s.reference),id='lokd-refund-'+crypto.randomUUID(),payload=JSON.stringify({...request,requestHash,source:current.source_json,providerId:s.provider_id,mode:s.mode,amountMinor:amount});
  await db.prepare('INSERT INTO booking_refund_cases VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,key,s.reference,payload,await agreementHash(payload),op.id,a.userId,note,auth(),now,new Date(Date.now()+30*60000).toISOString()).run();return {caseId:id,fundingAvailable:false};
 }
 const c=await db.prepare('SELECT * FROM booking_refund_cases WHERE id=? AND reference=?').bind(text(input.caseId,'the original refund case',200),s.reference).first<Case>();if(!c)throw new SignupError('Refund case not found.',404);
 if(action==='approve_refund_case'||action==='reject_refund_case'){
  await authority(db,a,h,s,c.operator_id);if(a.userId===c.user_id)throw new SignupError('Independent user approval is required.',403);
  if(input.payloadHash!==c.payload_hash||await agreementHash(c.payload_json)!==c.payload_hash||input.evidenceReviewed!==true)throw new SignupError('Independently review the exact immutable case.',409);
  const decision=action==='approve_refund_case'?'approved':'rejected';await db.prepare('INSERT INTO booking_refund_decisions VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,c.payload_hash,decision,op.id,a.userId,text(input.note,'the independent decision'),auth(),now).run();return {decision,fundingAvailable:false};
 }
 if(action==='adopt_refund'){
  const payload=JSON.parse(c.payload_json);if(!payload.externalRefundId)throw new SignupError('Approve an existing provider refund binding first.',409);
  await authority(db,a,h,s,c.operator_id);if(a.userId===c.user_id||input.payloadHash!==c.payload_hash||input.evidenceReviewed!==true)throw new SignupError('Independent exact refund adoption required.',403);
  const raw=await api(collectionKey(runtime,s.mode,true),'/refund/'+payload.externalRefundId,transport),e=refundEvidence(raw);
  if(!e||e.id!==payload.externalRefundId||e.transactionId!==s.provider_id||e.mode!==s.mode||e.amountMinor!==payload.amountMinor)throw new SignupError('Existing refund identity or amount does not match.',409);
  await db.prepare('INSERT INTO booking_refund_claims VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,s.reference,op.id,a.userId,auth(),new Date().toISOString(),0).run();
  await observe(db,c,'verify',raw,await watermark(db,s.reference));return {adopted:true,moneyMoved:false,fundingAvailable:false};
 }
 if(action==='dispatch_refund'){
  if(JSON.parse(c.payload_json).externalRefundId)throw new SignupError('Recover the existing provider refund; never create another.',409);
  if(s.mode==='live'&&(runtime.LOKD_LIVE_PAYMENTS_ENABLED!=='true'||(await db.prepare('SELECT enabled FROM payment_live_control WHERE id=1').first<{enabled:number}>())?.enabled!==1||runtime.LOKD_LIVE_REFUNDS_ENABLED!=='true'||(await db.prepare('SELECT enabled FROM booking_refund_control WHERE id=1').first<{enabled:number}>())?.enabled!==1))throw new SignupError('Live refund dispatch remains locked.',423);
  if(await db.prepare('SELECT id FROM booking_refund_claims WHERE case_id=?').bind(c.id).first())throw new SignupError('An original refund claim exists. Verify it; never resubmit.',409);
  await authority(db,a,h,s,c.operator_id);if(a.userId===c.user_id)throw new SignupError('Independent refund dispatch is required.',403);
  if(input.payloadHash!==c.payload_hash||input.evidenceReviewed!==true)throw new SignupError('Review the approved refund digest.',409);
  // No new refund may compete with a provider-originated refund or dispute. Those stay investigated.

  const secret=collectionKey(runtime,s.mode,true),mark=await watermark(db,s.reference);
  // Fresh transaction identity is checked before the durable claim. Source equality in the claim trigger catches events during this GET.
  const raw=await api(secret,'/transaction/verify/'+encodeURIComponent(s.reference),transport) as Record<string,unknown>;
  if(!raw||String(raw.id)!==s.provider_id||raw.reference!==s.reference||raw.domain!==s.mode||raw.currency!=='ZAR'||raw.amount!==s.amount_minor||!['success','reversed','reversal_pending','reversal pending'].includes(String(raw.status)))throw new SignupError('Original successful transaction evidence does not match.',409);
  if(raw.status!=='success'&&!(await db.prepare('SELECT reference FROM booking_refund_accounting WHERE reference=? AND reconciled_minor>0 AND currently_held=0').bind(s.reference).first()))throw new SignupError('Existing reversal has not been reconciled. Adopt and investigate it; do not submit another refund.',409);
  await db.prepare('INSERT INTO booking_refund_claims VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,s.reference,op.id,a.userId,auth(),new Date().toISOString(),mark).run();
  const result=await api(secret,'/refund',transport,{transaction:s.reference,amount:JSON.parse(c.payload_json).amountMinor,currency:'ZAR',merchant_note:c.id});
  await observe(db,c,'initiate',result,mark);return {submissionClaimed:true,refundReconciled:false,fundingAvailable:false};
 }
 if(action==='verify_refund'){
  if(!await db.prepare('SELECT id FROM booking_refund_claims WHERE case_id=?').bind(c.id).first())throw new SignupError('An original refund claim is required.',409);
  const providerId=text(input.refundId,'the provider refund ID from authoritative records',40);if(!/^[1-9][0-9]*$/.test(providerId))throw new SignupError('Use the numeric provider refund ID.');
  const mark=await watermark(db,s.reference);let raw:unknown;try{raw=await api(collectionKey(runtime,s.mode,true),'/refund/'+providerId,transport);}catch(error){await observe(db,c,'verify',null,mark);throw error;}
  await observe(db,c,'verify',refundEvidence(raw)?.id===providerId?raw:null,mark);return {verified:true,refundReconciled:false,fundingAvailable:false};
 }
 if(action==='prepare_refund_receipt'){
  if(input.evidenceReviewed!==true)throw new SignupError('Review the final refund and actual bank debit.');
  const e=await db.prepare('SELECT id FROM booking_refund_final_evidence WHERE case_id=?').bind(c.id).first<{id:string}>();if(!e)throw new SignupError('Fresh exact signed and API final evidence is required. Keep held.',409);
  if(input.bankAmountMinor!==JSON.parse(c.payload_json).amountMinor)throw new SignupError('Bank amount must equal the exact authorized refund.',409);
  const note=text(input.note,'the bank reconciliation findings'),bankReference=text(input.bankReference,'the unique bank debit evidence reference',200),bankHash=digest(input.bankHash),id=crypto.randomUUID();
  const payload=JSON.stringify({source:s.source_json,observationId:e.id,bankReference,bankHash,bankAmountMinor:JSON.parse(c.payload_json).amountMinor,note});
  await db.prepare('INSERT INTO booking_refund_receipts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,c.id,e.id,bankReference,bankHash,JSON.parse(c.payload_json).amountMinor,payload,await agreementHash(payload),op.id,a.userId,note,auth(),now).run();return {receiptId:id,fundingAvailable:false};
 }
 if(action==='approve_refund_receipt'||action==='reject_refund_receipt'){
  const r=await db.prepare('SELECT * FROM booking_refund_receipts WHERE id=? AND case_id=?').bind(text(input.receiptId,'the receipt ID',200),c.id).first<{id:string;operator_id:string;user_id:string;payload_hash:string;payload_json:string}>();if(!r)throw new SignupError('Receipt not found.',404);
  await authority(db,a,h,s,r.operator_id);if(a.userId===r.user_id||a.userId===c.user_id)throw new SignupError('Independent refund reconciliation is required.',403);
  if(input.payloadHash!==r.payload_hash||await agreementHash(r.payload_json)!==r.payload_hash||input.evidenceReviewed!==true)throw new SignupError('Review the exact bank and final refund receipt.',409);
  const decision=action==='approve_refund_receipt'?'approved':'rejected';await db.prepare('INSERT INTO booking_refund_receipt_decisions VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),r.id,decision,op.id,a.userId,text(input.note,'the independent receipt findings'),auth(),now).run();return {decision,fundingAvailable:false,liabilitiesCancelled:false};
 }
 throw new SignupError('Choose a supported refund action.');
}
