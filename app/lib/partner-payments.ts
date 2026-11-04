import {readPaymentEvidenceAssessment} from './payment-execution';
import {replacementReservation,readPaymentRecovery} from './payment-recovery';
import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import type {TransferObservation} from './employee-transfer-evidence';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string,max=200)=>{if(typeof v!=='string'||v.trim().length<3||v.length>max)throw new SignupError(`Provide ${label}.`);return v.trim();};
type Instruction={reference:string;payable_id:string;destination_id:string;mode:'live';amount_cents:number;source_json:string;source_hash:string;request_hash:string;status:string;version:number;prepared_by:string;prepared_user:string;approved_by:string|null};
type Source={payable_id:string;destination_id:string;mode:'live';amount_cents:number;source_json:string};
type Snapshot={payableId:string;invoiceNumber:string;invoiceLine:string;employerId:string;dueDate:string;representativeUser:string;officerUser:string;clientUser:string;recipient:{id:string;code:string;integration:string;bankName:string;last4:string};destinationHash:string};
const participant=(s:Snapshot,user:string)=>[s.representativeUser,s.officerUser,s.clientUser].includes(user);
async function observations(db:D1Database,reference:string){return (await db.prepare('SELECT source,event,transfer_json,webhook_count FROM partner_transfer_observations WHERE reference=? ORDER BY rowid LIMIT 501').bind(reference).all<{source:string;event:string;transfer_json:string;webhook_count:number|null}>()).results.map(r=>({source:r.source,event:r.event,transfer:JSON.parse(r.transfer_json),webhookCount:r.webhook_count})) as TransferObservation[];}
async function sourceCurrent(db:D1Database,i:Instruction){return !!await db.prepare('SELECT payable_id FROM partner_payment_sources WHERE payable_id=? AND destination_id=? AND source_json=?').bind(i.payable_id,i.destination_id,i.source_json).first();}
export async function readPartnerPayments(db:D1Database,actor:SigningActor){
 const allowed=actor.operations&&!!await db.prepare("SELECT a.id FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE lower(a.email)=? AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role IN ('operations_controller','finance_approver') LIMIT 1").bind(actor.email.toLowerCase()).first();
 if(!allowed)return {partnerPaymentAccess:false,partnerPaymentCandidates:[],partnerPayments:[]};
 const rows=(await db.prepare(`SELECT * FROM partner_payment_instructions WHERE mode='live' ORDER BY created_at DESC LIMIT 100`).all<Instruction>()).results,payments=[];
 for(const i of rows){const evidence=await observations(db,i.reference);payments.push({...i,current:await sourceCurrent(db,i),providerState:(await readPaymentEvidenceAssessment(db,'partner',i.reference)).state,observations:evidence,recovery:await readPaymentRecovery(db,'partner',i.reference),financial:await db.prepare('SELECT * FROM partner_payment_financial_state WHERE reference=?').bind(i.reference).first()});}
 return {partnerPaymentAccess:true,partnerPayments:payments,partnerPaymentCandidates:(await db.prepare(`SELECT s.* FROM partner_payment_sources s WHERE s.mode='live' AND NOT EXISTS(SELECT 1 FROM partner_payment_instructions i WHERE i.active_key=s.payable_id||':'||s.mode) ORDER BY s.payable_id LIMIT 500`).all()).results};
}
export async function operatePartnerPayment(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const action=String(input.action),now=new Date().toISOString();
 if(action==='prepare_partner_payment'){
  const op=await productionOperatorControl(db,actor,headers,'partner_payment.prepare',0);
  const itemId=text(input.payableId,'the approved partner payable'),destinationId=text(input.destinationId,'the reviewed destination'),requestKey=text(input.requestKey,'a unique payment instruction reference'),note=text(input.note,'the instruction review findings',1200);
  if(input.instructionReviewed!==true)throw new SignupError('Review the exact unpaid invoice amount, legal company and destination before preparing an instruction.');
  const hash=await agreementHash(JSON.stringify({itemId,destinationId,note,...(input.replacesReference!==undefined||input.recoveryApprovalId!==undefined||input.replacesCancelledReference!==undefined?{replacesReference:input.replacesReference,recoveryApprovalId:input.recoveryApprovalId,replacesCancelledReference:input.replacesCancelledReference}:{})}));
  const prior=await db.prepare('SELECT * FROM partner_payment_instructions WHERE request_key=?').bind(requestKey).first<Instruction>();if(prior){await productionOperatorControl(db,actor,headers,'partner_payment.prepare',prior.amount_cents);if(prior.request_hash!==hash)throw new SignupError('This request reference belongs to different instructions.',409);return {reference:prior.reference,alreadyPrepared:true,paymentReleased:false};}
  const source=await db.prepare("SELECT * FROM partner_payment_sources WHERE payable_id=? AND destination_id=? AND mode='live'").bind(itemId,destinationId).first<Source>();if(!source)throw new SignupError('Choose an approved unheld partner payable with its exact current independently verified company destination.',409);
  if(participant(JSON.parse(source.source_json),actor.userId))throw new SignupError('A company representative or service participant cannot prepare this payment instruction.',403);
  await productionOperatorControl(db,actor,headers,'partner_payment.prepare',source.amount_cents);
  const ref='lokd-partner-pay-'+crypto.randomUUID(),sourceHash=await agreementHash(source.source_json);
  await db.batch([...replacementReservation(db,'partner',input,ref,now),db.prepare("INSERT INTO partner_payment_instructions VALUES(?,?,?,?,?,?,?,?,?,'prepared',1,?,?,NULL,?,?,?)").bind(ref,itemId,destinationId,source.mode,source.amount_cents,source.source_json,sourceHash,requestKey,hash,op.id,actor.userId,itemId+':'+source.mode,now,now),db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'partner_payment_prepared','partner_payment',?,?,?)").bind(crypto.randomUUID(),actor.userId,ref,JSON.stringify({sourceHash,note,paymentReleased:false}),now)]);
  return {reference:ref,paymentReleased:false};
 }
 if(!['approve_partner_payment','cancel_partner_payment'].includes(action))throw new SignupError('Choose a supported partner payment action.');
 const i=await db.prepare("SELECT * FROM partner_payment_instructions WHERE reference=? AND mode='live'").bind(text(input.reference,'the saved payment reference')).first<Instruction>();if(!i)throw new SignupError('Payment instruction not found.',404);
 const snapshot=JSON.parse(i.source_json) as Snapshot;
 const code=action==='cancel_partner_payment'?'partner_payment.cancel':'partner_payment.approve';
 const op=await productionOperatorControl(db,actor,headers,code,i.amount_cents,action==='cancel_partner_payment'?undefined:i.prepared_by);
 if(participant(snapshot,actor.userId)||action!=='cancel_partner_payment'&&i.prepared_user===actor.userId)throw new SignupError('Independent partner payment review is required.',403);
 if(input.sourceHash!==i.source_hash||await agreementHash(i.source_json)!==i.source_hash)throw new SignupError('Refresh the exact saved instruction evidence.',409);
 if(i.version!==input.version)throw new SignupError('This instruction changed. Refresh before deciding.',409);
 const cancel=action==='cancel_partner_payment';
 if(cancel&&!['prepared','approved'].includes(i.status)||!cancel&&i.status!=='prepared')throw new SignupError('This instruction stage cannot be repeated. Verify any previously claimed submission.',409);
 const note=text(input.note,'the independent payment findings',1200);
 if(!cancel&&(input.instructionReviewed!==true||!await sourceCurrent(db,i)))throw new SignupError('Review the exact current partner payable and destination evidence.',409);
 const command=cancel?'cancel':'approve',target=cancel?'cancelled':'approved';
 await db.batch([db.prepare('INSERT INTO partner_payment_commands VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),i.reference,i.version,command,op.id,actor.userId,i.source_hash,null,note,operationsMfaRequired()?'mfa_verified':'owner_mfa_exception',new Date().toISOString()),db.prepare(`UPDATE partner_payment_instructions SET status=?,version=version+1,approved_by=?,active_key=?,updated_at=? WHERE reference=? AND version=?`).bind(target,cancel?i.approved_by:op.id,cancel?null:i.payable_id+':'+i.mode,new Date().toISOString(),i.reference,i.version)]);
 return {status:target,paymentReleased:false};
}
