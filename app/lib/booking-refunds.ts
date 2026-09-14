import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {OPERATOR_ACTION_POLICIES} from './operator-controls';
import {operationsMfaRequired} from './operations-mfa-policy';
import {collectionKey,type CollectionRuntime} from './booking-collections';
import {refundEvidence} from './booking-refund-evidence';
import type {SigningActor} from './production-signing';
export type RefundRuntime=CollectionRuntime&{LOKD_LIVE_REFUNDS_ENABLED?:string;LOKD_LIVE_PAYMENTS_ENABLED?:string};
type Source={reference:string;order_id:string;mode:'test'|'live';provider_id:string;amount_minor:number;applicant_id:string;source_json:string};
type Case={id:string;reference:string;payload_json:string;payload_hash:string;operator_id:string;user_id:string};
const text=(v:unknown,label:string,max=1200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
const providerRefundId=(v:unknown)=>{if(typeof v!=='string'||!/^[1-9][0-9]{0,39}$/.test(v))throw new SignupError('Use the exact positive numeric provider refund ID.');return v;};
const digest=(v:unknown)=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw new SignupError('Provide the exact SHA-256 evidence digest.');return v;};
const auth=()=>operationsMfaRequired()?'mfa_verified':'owner_mfa_exception';
async function source(db:D1Database,reference:unknown){const s=await db.prepare('SELECT * FROM booking_refund_sources WHERE reference=?').bind(text(reference,'the original collection reference',200)).first<Source>();if(!s||!s.provider_id)throw new SignupError('A bound collected transaction is required. Uncertain collection remains held.',409);return s;}
async function authority(db:D1Database,a:SigningActor,h:Headers,s:Source,maker?:string){if(a.userId===s.applicant_id)throw new SignupError('Collection participants cannot resolve their own refund.',403);return productionOperatorControl(db,a,h,'funding.verify',s.amount_minor,maker);}
async function api(secret:string,path:string,transport:typeof fetch,body?:unknown){try{const response=await transport('https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});const p=await response.json() as {status?:boolean;data?:unknown};if(!response.ok||p.status!==true)throw Error('unavailable');return p.data;}catch{throw new SignupError(body?'Refund submission is uncertain. Keep its original claim; do not submit again.':'Provider evidence is unavailable. Keep the original refund held.',503);}}
async function watermark(db:D1Database,reference:string){return (await db.prepare('SELECT count(*) AS n FROM booking_collection_recoveries WHERE reference=?').bind(reference).first<{n:number}>())!.n;}
async function observe(db:D1Database,c:Case,kind:'initiate'|'verify',raw:unknown,mark:number){await db.prepare('INSERT INTO booking_refund_observations VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,kind,JSON.stringify(refundEvidence(raw)),mark,new Date().toISOString()).run();}
export const refundPageDatasets=['sources','cases','receipts','observations','states'] as const;
type RefundDataset=typeof refundPageDatasets[number];
export type RefundPageOptions={pageSize?:number;dataset?:RefundDataset;cursor?:string;reference?:string;caseId?:string; cursors?:Partial<Record<RefundDataset,string>>};
const pageCursor=(value:unknown)=>btoa(encodeURIComponent(JSON.stringify(value))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export async function readBookingRefunds(db:D1Database,a:SigningActor,h:Headers,runtime:RefundRuntime={},options:RefundPageOptions={}){
 const account=await productionOperatorControl(db,a,h,'funding.verify',0),size=options.pageSize??50;
 if(!Number.isSafeInteger(size)||size<1||size>100||options.dataset!==undefined&&!refundPageDatasets.includes(options.dataset)||options.cursor!==undefined&&!options.dataset)throw new SignupError('Choose a valid refund page.',400);
 if(options.reference!==undefined&&(typeof options.reference!=='string'||!options.reference||options.reference.length>200))throw new SignupError('Choose a valid collection reference.',400);
 if(options.caseId!==undefined&&(typeof options.caseId!=='string'||!options.caseId||options.caseId.length>200))throw new SignupError('Choose a valid refund case.',400);
 if(options.dataset&&Object.keys(options.cursors??{}).some(key=>key!==options.dataset)||options.cursor!==undefined&&options.dataset&&options.cursors?.[options.dataset]!==undefined)throw new SignupError('Choose one cursor for this refund list.',400);
 const policy=OPERATOR_ACTION_POLICIES.find(p=>p.actionCode==='funding.verify')!;
 const actorHash=await agreementHash(JSON.stringify([a.userId,a.email.toLowerCase(),options.reference??null,options.caseId??null]));
 const after=(dataset:RefundDataset)=>{
  const token=options.dataset===dataset?options.cursor??options.cursors?.[dataset]:options.cursors?.[dataset];
  if(token===undefined)return null;
  try{
   if(!token||token.length>1600||!/^[A-Za-z0-9_-]+$/.test(token))throw Error();
   const value=JSON.parse(decodeURIComponent(atob(token.replaceAll('-','+').replaceAll('_','/'))));
   if(!Array.isArray(value)||value.length!==4||value[0]!==1||value[1]!==dataset||value[2]!==actorHash||pageCursor(value)!==token)throw Error();
   const key=value[3];
   if(dataset==='sources'||dataset==='states'){if(typeof key!=='string'||!key||key.length>200)throw Error();}
   else if(!Number.isSafeInteger(key)||key<1)throw Error();
   return key;
  }catch{throw new SignupError('Refund page cursor is invalid. Refresh this list.',400);}
 };
 // Every dataset filters source authority before LIMIT. Hidden rows never affect
 // hasMore or appear indirectly via global totals. Recheck roles/limits in SQL.
 const allowed=`s.provider_id IS NOT NULL AND s.applicant_id<>? AND typeof(s.amount_minor)='integer' AND s.amount_minor BETWEEN 0 AND ? AND EXISTS(SELECT 1 FROM operator_accounts actor JOIN operator_role_assignments role ON role.operator_id=actor.id WHERE actor.id=? AND actor.status='active' AND actor.environment='production' AND actor.integrity_state='production_verified' AND actor.approval_limit_cents>=s.amount_minor AND role.role=? AND role.status='active' AND role.environment='production' AND role.integrity_state='production_verified')`;
 const definitions={
  sources:{select:'s.*',from:'booking_refund_sources s',key:'s.reference',asc:true},
  cases:{select:'c.*,d.decision,k.id AS claim_id,(SELECT id FROM booking_refund_authorized WHERE id=c.id) AS current_approval',from:'booking_refund_cases c JOIN booking_refund_sources s ON s.reference=c.reference LEFT JOIN booking_refund_decisions d ON d.case_id=c.id LEFT JOIN booking_refund_claims k ON k.case_id=c.id',key:'c.rowid',asc:false},
  receipts:{select:'r.*,d.decision',from:'booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_sources s ON s.reference=c.reference LEFT JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id',key:'r.rowid',asc:false},
  observations:{select:'o.*',from:'booking_refund_observations o JOIN booking_refund_cases c ON c.id=o.case_id JOIN booking_refund_sources s ON s.reference=c.reference',key:'o.rowid',asc:false},
  states:{select:'state.*',from:'booking_refund_state state JOIN booking_refund_sources s ON s.reference=state.reference',key:'state.reference',asc:true},
 };
 const rows:Record<RefundDataset,Record<string,unknown>[]>={sources:[],cases:[],receipts:[],observations:[],states:[]};
 const pagination:Partial<Record<RefundDataset,{hasMore:boolean;nextCursor:string|null}>>={};
 for(const dataset of options.dataset?[options.dataset]:refundPageDatasets){
  const spec=definitions[dataset],key=after(dataset),values:(string|number)[]=[a.userId,policy.maxAmountCents??Number.MAX_SAFE_INTEGER,account.id,policy.requiredRole];
  let sql=`SELECT ${spec.select},${spec.key} AS __page_key FROM ${spec.from} WHERE ${allowed}`;
  if(options.reference!==undefined){sql+=' AND s.reference=?';values.push(options.reference);}
  if(options.caseId!==undefined){sql+=dataset==='sources'||dataset==='states'?' AND EXISTS(SELECT 1 FROM booking_refund_cases lookup WHERE lookup.id=? AND lookup.reference=s.reference)':' AND c.id=?';values.push(options.caseId);}
  if(key!==null){sql+=` AND ${spec.key}${spec.asc?'>':'<'}?`;values.push(key);}
  sql+=` ORDER BY ${spec.key} ${spec.asc?'ASC':'DESC'} LIMIT ?`;values.push(size+1);
  const result=(await db.prepare(sql).bind(...values).all<Record<string,unknown>>()).results,hasMore=result.length>size,page=result.slice(0,size);
  pagination[dataset]={hasMore,nextCursor:hasMore?pageCursor([1,dataset,actorHash,page.at(-1)!.__page_key]):null};
  rows[dataset]=page.map(row=>{const clean={...row};delete clean.__page_key;return clean;});
 }
 // If permission changed while composing pages, return no partial disclosure.
 const finalAccount=await productionOperatorControl(db,a,h,'funding.verify',0);
 if(finalAccount.id!==account.id||finalAccount.approval_limit_cents!==account.approval_limit_cents)throw new SignupError('Refund access changed. Refresh this list.',409);
 return {sources:rows.sources,refundCases:rows.cases,refundReceipts:rows.receipts,refundObservations:rows.observations,refundStates:rows.states,pagination,pageSize:size,liveRefundsEnabled:runtime.LOKD_LIVE_PAYMENTS_ENABLED==='true'&&(await db.prepare('SELECT enabled FROM payment_live_control WHERE id=1').first<{enabled:number}>())?.enabled===1&&runtime.LOKD_LIVE_REFUNDS_ENABLED==='true'&&(await db.prepare('SELECT enabled FROM booking_refund_control WHERE id=1').first<{enabled:number}>())?.enabled===1};
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
  const externalRefundId=input.externalRefundId===undefined?null:providerRefundId(input.externalRefundId);
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
  const providerId=providerRefundId(input.refundId);
  const mark=await watermark(db,s.reference);let raw:unknown;try{raw=await api(collectionKey(runtime,s.mode,true),'/refund/'+providerId,transport);}catch(error){await observe(db,c,'verify',null,mark);throw error;}
  await observe(db,c,'verify',refundEvidence(raw)?.id===providerId?raw:null,mark);return {verified:true,refundReconciled:false,fundingAvailable:false};
 }
 if(action==='prepare_refund_receipt'){
  if(input.evidenceReviewed!==true)throw new SignupError('Review the final refund and actual bank debit.');
  const e=await db.prepare('SELECT id,signed_event_id,signed_event_hash FROM booking_refund_final_evidence WHERE case_id=?').bind(c.id).first<{id:string;signed_event_id:string;signed_event_hash:string}>();if(!e)throw new SignupError('Fresh exact signed and API final evidence is required. Keep held.',409);
  if(input.bankAmountMinor!==JSON.parse(c.payload_json).amountMinor)throw new SignupError('Bank amount must equal the exact authorized refund.',409);
  const note=text(input.note,'the bank reconciliation findings'),bankReference=text(input.bankReference,'the unique bank debit evidence reference',200),bankHash=digest(input.bankHash),id=crypto.randomUUID();
  const payload=JSON.stringify({source:s.source_json,observationId:e.id,signedEventId:e.signed_event_id,signedEventHash:e.signed_event_hash,bankReference,bankHash,bankAmountMinor:JSON.parse(c.payload_json).amountMinor,note});
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
