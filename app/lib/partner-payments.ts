import {fetchWithoutRedirect} from './provider-fetch';
import {readFinanceWebhookBytes,readFinanceProviderJson} from './finance-body';
import {readPaymentEvidenceAssessment} from './payment-execution';
import {replacementReservation,readPaymentRecovery} from './payment-recovery';
import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import {destinationKey,fetchRecipient,type DestinationRuntime} from './destination-evidence';
import {employeeTransfer,employeeTransferOutcome,type EmployeeTransferBinding,type TransferObservation} from './employee-transfer-evidence';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string,max=200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
type Instruction={reference:string;payable_id:string;destination_id:string;mode:'test'|'live';amount_cents:number;source_json:string;source_hash:string;request_hash:string;status:string;version:number;prepared_by:string;prepared_user:string;approved_by:string|null};
type Source={payable_id:string;destination_id:string;mode:'test'|'live';amount_cents:number;source_json:string};
type Snapshot={payableId:string;invoiceNumber:string;invoiceLine:string;employerId:string;dueDate:string;representativeUser:string;officerUser:string;clientUser:string;recipient:{id:string;code:string;integration:string;bankName:string;last4:string};destinationHash:string};
const participant=(s:Snapshot,user:string)=>[s.representativeUser,s.officerUser,s.clientUser].includes(user);
const binding=(i:Instruction):EmployeeTransferBinding=>{const s=JSON.parse(i.source_json) as Snapshot;return {reference:i.reference,mode:i.mode,amount:i.amount_cents,currency:'ZAR',recipientId:s.recipient.id,integration:s.recipient.integration};};
async function observations(db:D1Database,reference:string){return (await db.prepare('SELECT source,event,transfer_json,webhook_count FROM partner_transfer_observations WHERE reference=? ORDER BY rowid LIMIT 501').bind(reference).all<{source:string;event:string;transfer_json:string;webhook_count:number|null}>()).results.map(r=>({source:r.source,event:r.event,transfer:JSON.parse(r.transfer_json),webhookCount:r.webhook_count})) as TransferObservation[];}
async function sourceCurrent(db:D1Database,i:Instruction){return !!await db.prepare('SELECT payable_id FROM partner_payment_sources WHERE payable_id=? AND destination_id=? AND source_json=?').bind(i.payable_id,i.destination_id,i.source_json).first();}
async function record(db:D1Database,i:Instruction,source:string,event:string,raw:unknown,count:number|null=null){
 const transfer=employeeTransfer(raw,'partner'),json=JSON.stringify(transfer),hash=await agreementHash(JSON.stringify([event,json,count,...(source==='verify'?[crypto.randomUUID()]:[])]));
 await db.prepare('INSERT OR IGNORE INTO partner_transfer_observations VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),i.reference,source,event,hash,json,count,new Date().toISOString()).run();
}
async function provider(secret:string,path:string,transport:typeof fetch,body?:unknown){
 try{const response=await fetchWithoutRedirect(transport,'https://api.paystack.co'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+secret,'content-type':'application/json'},signal:AbortSignal.timeout(20000),...(body?{body:JSON.stringify(body)}:{})});const payload=await readFinanceProviderJson(response);if(!response.ok||payload.status!==true)throw Error('uncertain');return payload.data;}
 catch{throw new SignupError('Provider delivery is uncertain. Verify this saved reference; do not submit a replacement.',503);}
}
export async function readPartnerPayments(db:D1Database,actor:SigningActor){
 const allowed=actor.operations&&!!await db.prepare("SELECT a.id FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE lower(a.email)=? AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role IN ('operations_controller','finance_approver') LIMIT 1").bind(actor.email.toLowerCase()).first();
 if(!allowed)return {partnerPaymentAccess:false,partnerPaymentCandidates:[],partnerPayments:[]};
 const rows=(await db.prepare('SELECT * FROM partner_payment_instructions ORDER BY created_at DESC LIMIT 100').all<Instruction>()).results,payments=[];
 for(const i of rows){const evidence=await observations(db,i.reference);payments.push({...i,current:await sourceCurrent(db,i),providerState:i.mode==='live'?(await readPaymentEvidenceAssessment(db,'partner',i.reference)).state:evidence.length>500?'review_required':employeeTransferOutcome(binding(i),evidence),observations:evidence,recovery:await readPaymentRecovery(db,'partner',i.reference),financial:await db.prepare('SELECT * FROM partner_payment_financial_state WHERE reference=?').bind(i.reference).first()});}
 return {partnerPaymentAccess:true,partnerPayments:payments,partnerPaymentCandidates:(await db.prepare("SELECT s.* FROM partner_payment_sources s WHERE NOT EXISTS(SELECT 1 FROM partner_payment_instructions i WHERE i.active_key=s.payable_id||':'||s.mode) ORDER BY s.payable_id LIMIT 500").all()).results};
}
export async function operatePartnerPayment(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers,runtime:DestinationRuntime={},transport:typeof fetch=fetch){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const action=String(input.action),now=new Date().toISOString();
 if(action==='prepare_partner_payment'){
  const op=await productionOperatorControl(db,actor,headers,'partner_payment.prepare',0);
  const itemId=text(input.payableId,'the approved partner payable'),destinationId=text(input.destinationId,'the reviewed destination'),requestKey=text(input.requestKey,'a unique payment instruction reference'),note=text(input.note,'the instruction review findings',1200);
  if(input.instructionReviewed!==true)throw new SignupError('Review the exact unpaid invoice amount, legal company and destination before preparing an instruction.');
  const hash=await agreementHash(JSON.stringify({itemId,destinationId,note,...(input.replacesReference!==undefined||input.recoveryApprovalId!==undefined||input.replacesCancelledReference!==undefined?{replacesReference:input.replacesReference,recoveryApprovalId:input.recoveryApprovalId,replacesCancelledReference:input.replacesCancelledReference}:{})}));
  const prior=await db.prepare('SELECT * FROM partner_payment_instructions WHERE request_key=?').bind(requestKey).first<Instruction>();if(prior){await productionOperatorControl(db,actor,headers,'partner_payment.prepare',prior.amount_cents);if(prior.request_hash!==hash)throw new SignupError('This request reference belongs to different instructions.',409);return {reference:prior.reference,alreadyPrepared:true,paymentReleased:false};}
  const source=await db.prepare('SELECT * FROM partner_payment_sources WHERE payable_id=? AND destination_id=?').bind(itemId,destinationId).first<Source>();if(!source)throw new SignupError('Choose an approved unheld partner payable with its exact current independently verified company destination.',409);
  if(participant(JSON.parse(source.source_json),actor.userId))throw new SignupError('A company representative or service participant cannot prepare this payment instruction.',403);
  await productionOperatorControl(db,actor,headers,'partner_payment.prepare',source.amount_cents);
  const ref='lokd-partner-pay-'+crypto.randomUUID(),sourceHash=await agreementHash(source.source_json);
  await db.batch([...replacementReservation(db,'partner',input,ref,now),db.prepare("INSERT INTO partner_payment_instructions VALUES(?,?,?,?,?,?,?,?,?,'prepared',1,?,?,NULL,?,?,?)").bind(ref,itemId,destinationId,source.mode,source.amount_cents,source.source_json,sourceHash,requestKey,hash,op.id,actor.userId,itemId+':'+source.mode,now,now),db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'partner_payment_prepared','partner_payment',?,?,?)").bind(crypto.randomUUID(),actor.userId,ref,JSON.stringify({sourceHash,note,paymentReleased:false}),now)]);
  return {reference:ref,paymentReleased:false};
 }
 if(!['approve_partner_payment','cancel_partner_payment','dispatch_partner_test','verify_partner_test'].includes(action))throw new SignupError('Choose a supported partner payment action.');
 const i=await db.prepare('SELECT * FROM partner_payment_instructions WHERE reference=?').bind(text(input.reference,'the saved payment reference')).first<Instruction>();if(!i)throw new SignupError('Payment instruction not found.',404);
 const snapshot=JSON.parse(i.source_json) as Snapshot;
 const code=action==='cancel_partner_payment'?'partner_payment.cancel':action==='dispatch_partner_test'?'partner_payment.dispatch_test':'partner_payment.approve';
 const op=await productionOperatorControl(db,actor,headers,code,i.amount_cents,action==='cancel_partner_payment'?undefined:i.prepared_by);
 if(participant(snapshot,actor.userId)||action!=='cancel_partner_payment'&&i.prepared_user===actor.userId)throw new SignupError('Independent partner payment review is required.',403);
 if(input.sourceHash!==i.source_hash||await agreementHash(i.source_json)!==i.source_hash)throw new SignupError('Refresh the exact saved instruction evidence.',409);
 // No runtime flag can bypass the existing controlled-pilot live settlement lock.
 if(['dispatch_partner_test','verify_partner_test'].includes(action)&&i.mode!=='test')throw new SignupError('Live company dispatch remains locked until controlled-pilot operating acceptance.',423);
 if(action==='verify_partner_test'){
  if(i.status!=='dispatch_claimed')throw new SignupError('Only a previously claimed test submission may be verified.',409);
  const events=await observations(db,i.reference),secret=destinationKey(runtime,'test'),raw=await provider(secret,'/transfer/verify/'+i.reference,transport);
  if(events.length>500)throw new SignupError('Transfer evidence requires manual review.',409);
  await record(db,i,'verify','transfer.verify',raw,events.filter(e=>e.source==='webhook').length);
  return {providerState:employeeTransferOutcome(binding(i),await observations(db,i.reference)),paymentReleased:false};
 }
 if(i.version!==input.version)throw new SignupError('This instruction changed. Refresh before deciding.',409);
 const cancel=action==='cancel_partner_payment',dispatch=action==='dispatch_partner_test';
 if(cancel&&!['prepared','approved'].includes(i.status)||!cancel&&!dispatch&&i.status!=='prepared'||dispatch&&i.status!=='approved')throw new SignupError('This instruction stage cannot be repeated. Verify any previously claimed submission.',409);
 const note=text(input.note,'the independent payment findings',1200);
 if(!cancel&&(input.instructionReviewed!==true||!await sourceCurrent(db,i)))throw new SignupError('Review the exact current partner payable and destination evidence.',409);
 let secret='',recipientHash:string|null=null;
 if(dispatch){
  secret=destinationKey(runtime,'test');const recipient=await fetchRecipient(secret,snapshot.recipient.code,'test',transport),destination=await db.prepare('SELECT payload_json FROM partner_destination_reviews WHERE id=?').bind(i.destination_id).first<{payload_json:string}>();
  recipientHash=recipient?await agreementHash(JSON.stringify(recipient)):null;
  if(!destination||recipientHash!==JSON.parse(destination.payload_json).providerHash){await record(db,i,'operations','recipient_changed',null);throw new SignupError('The recipient changed. Cancel this unsent instruction and independently review fresh destination evidence.',409);}
 }
 const command=cancel?'cancel':dispatch?'dispatch_test':'approve',target=cancel?'cancelled':dispatch?'dispatch_claimed':'approved';
 await db.batch([db.prepare('INSERT INTO partner_payment_commands VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),i.reference,i.version,command,op.id,actor.userId,i.source_hash,recipientHash,note,operationsMfaRequired()?'mfa_verified':'owner_mfa_exception',new Date().toISOString()),db.prepare(`UPDATE partner_payment_instructions SET status=?,version=version+1,approved_by=?,active_key=?,updated_at=? WHERE reference=? AND version=?`).bind(target,command==='approve'?op.id:i.approved_by,cancel?null:i.payable_id+':'+i.mode,new Date().toISOString(),i.reference,i.version)]);
 if(dispatch){
  // Claim is durable before the single POST. Timeouts and crashes never permit re-dispatch.
  const raw=await provider(secret,'/transfer',transport,{source:'balance',amount:i.amount_cents,currency:'ZAR',recipient:snapshot.recipient.code,reference:i.reference,reason:'LOKD test partner invoice transfer'});
  await record(db,i,'initiate','transfer.initiate',raw);
  return {status:target,providerState:employeeTransferOutcome(binding(i),await observations(db,i.reference)),paymentReleased:false};
 }
 return {status:target,paymentReleased:false};
}
export async function receivePartnerTransferWebhook(request:Request,db:D1Database,runtime:DestinationRuntime){
 const secret=destinationKey(runtime,'test'),signature=request.headers.get('x-paystack-signature')??'';if(!/^[a-f0-9]{128}$/i.test(signature))throw new SignupError('Invalid webhook signature.',401);
 const raw=await readFinanceWebhookBytes(request);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['verify']);if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(signature.match(/../g)!,v=>parseInt(v,16)),raw))throw new SignupError('Invalid webhook signature.',401);
 let p;try{p=JSON.parse(new TextDecoder().decode(raw));}catch{throw new SignupError('Invalid event.');}
 if(!p||typeof p.event!=='string'||!p.event.startsWith('transfer.')||p.event.length>100||!p.data||p.data.domain!=='test')throw new SignupError('Only explicit test transfer events are accepted.',422);
 const i=await db.prepare("SELECT * FROM partner_payment_instructions WHERE reference=? AND mode='test'").bind(typeof p.data.reference==='string'?p.data.reference:'').first<Instruction>();if(!i)return {received:true,matched:false,paymentReleased:false};
 await record(db,i,'webhook',p.event,p.data);return {received:true,matched:true,paymentReleased:false};
}
