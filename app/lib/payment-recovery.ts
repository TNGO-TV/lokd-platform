import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {operationsMfaRequired} from './operations-mfa-policy';
import type {SigningActor} from './production-signing';
export type PaymentKind = 'employee' | 'partner';
const text=(v:unknown,label:string)=>{if(typeof v!=='string'||v.trim().length<3||v.length>1200)throw new SignupError(`Provide ${label}.`);return v.trim();};
const auth=()=>operationsMfaRequired()?'mfa_verified':'owner_mfa_exception';
// Table names are selected by this closed union, never supplied SQL identifiers.
export async function operatePaymentRecovery(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 if(input.kind!=='employee'&&input.kind!=='partner')throw new SignupError('Choose employee or partner recovery.');
 const kind=input.kind,reference=text(input.reference,'the original saved reference');
 const i=await db.prepare(`SELECT * FROM ${kind}_payment_instructions WHERE reference=?`).bind(reference).first<{mode:string;status:string;version:number;source_hash:string;source_json:string;prepared_by:string;prepared_user:string;amount_cents:number}>();
 if(!i)throw new SignupError('Payment instruction not found.',404);
 if(i.mode!=='test')throw new SignupError('Live payment recovery remains locked.',423);
 if(i.status!=='dispatch_claimed'||input.version!==i.version||input.sourceHash!==i.source_hash||await agreementHash(i.source_json)!==i.source_hash)throw new SignupError('Refresh the exact claimed instruction.',409);
 const snapshot=JSON.parse(i.source_json);
 if([snapshot.ownerUser,snapshot.representativeUser,snapshot.officerUser,snapshot.clientUser].includes(actor.userId))throw new SignupError('A payment participant cannot decide recovery.',403);
 const propose=input.action==='propose_test_disposition';
 if(!propose&&input.action!=='approve_test_disposition')throw new SignupError('Choose a supported recovery action.');
 const note=text(input.note,'the terminal evidence review findings');
 if(input.evidenceReviewed!==true)throw new SignupError('Review the exact authoritative terminal evidence.');
 const prefix=kind==='employee'?'payment':'partner_payment';
 const op=await productionOperatorControl(db,actor,headers,propose?`${prefix}.prepare`:`${prefix}.approve`,i.amount_cents,propose?undefined:i.prepared_by);
 const now=new Date().toISOString(),id=crypto.randomUUID();
 if(propose){
  const terminal=await db.prepare(`SELECT * FROM ${kind}_recovery_terminal WHERE reference=?`).bind(reference).first<{evidence_id:string;disposition:string}>();
  if(!terminal||input.evidenceId!==terminal.evidence_id||input.disposition!==terminal.disposition)throw new SignupError('Hold this transfer: fresh matching signed and API final evidence is required.',409);
  await db.prepare(`INSERT INTO ${kind}_recovery_proposals VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(id,reference,i.version,terminal.evidence_id,terminal.disposition,i.source_hash,op.id,actor.userId,note,auth(),now).run();
  return {proposalId:id,reference,paymentReleased:false};
 }
 const proposalId=text(input.proposalId,'the saved disposition proposal');
 const p=await db.prepare(`SELECT * FROM ${kind}_recovery_proposals WHERE id=? AND reference=?`).bind(proposalId,reference).first<{operator_id:string;user_id:string;evidence_id:string;disposition:string}>();
 if(!p)throw new SignupError('Disposition proposal not found.',404);
 if(op.id===p.operator_id||actor.userId===p.user_id||actor.userId===i.prepared_user)throw new SignupError('Independent finance approval is required.',403);
 if(input.evidenceId!==p.evidence_id||input.disposition!==p.disposition)throw new SignupError('Refresh the exact proposed terminal evidence.',409);
 await db.prepare(`INSERT INTO ${kind}_recovery_approvals VALUES(?,?,?,?,?,?,?)`).bind(id,proposalId,op.id,actor.userId,note,auth(),now).run();
 return {approvalId:id,reference,paymentReleased:false};
}
// Inserted in the SAME atomic batch as the existing prepared instruction. The DB
// rechecks authority/evidence and releases the old active slot during that insert.
export function replacementReservation(db:D1Database,kind:PaymentKind,input:Record<string,unknown>,reference:string,now:string){
 if(input.replacesReference===undefined&&input.recoveryApprovalId===undefined)return [];
 return [db.prepare(`INSERT INTO ${kind}_recovery_replacements VALUES(?,?,?,?)`).bind(reference,text(input.replacesReference,'the original claimed reference'),text(input.recoveryApprovalId,'the independent recovery approval'),now)];
}
export async function readPaymentRecovery(db:D1Database,kind:PaymentKind,reference:string){
 return {
  terminal:await db.prepare(`SELECT * FROM ${kind}_recovery_terminal WHERE reference=?`).bind(reference).first(),
  proposals:(await db.prepare(`SELECT p.*,a.id AS approval_id,a.operator_id AS approved_by,a.user_id AS approved_user,a.note AS approval_note FROM ${kind}_recovery_proposals p LEFT JOIN ${kind}_recovery_approvals a ON a.proposal_id=p.id WHERE p.reference=? ORDER BY p.created_at`).bind(reference).all()).results,
  replacements:(await db.prepare(`SELECT * FROM ${kind}_recovery_replacements WHERE reference=? OR predecessor=?`).bind(reference,reference).all()).results,
  held:!!await db.prepare(`SELECT reference FROM ${kind}_recovery_chain_holds WHERE reference=? LIMIT 1`).bind(reference).first(),
 };
}
