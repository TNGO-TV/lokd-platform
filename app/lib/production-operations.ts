import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {operatorControlDecision,OPERATOR_ACTION_POLICIES,type OperatorRole,type OperatorActionCode} from './operator-controls';
import {operationsMfaStatus} from './operations-mfa';
import {operationsMfaRequired} from './operations-mfa-policy';
import {evaluateAssignmentActivation,recordAssignmentActivationEvaluation,activateAssignment,revalidateAssignment,type AssignmentActivationRequest} from './assignment-activation-server';
import type {SigningActor} from './production-signing';
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>200)throw new SignupError('Choose a valid operational reference.');return v.trim();};
async function control(db:D1Database,actor:SigningActor,headers:Headers,actionCode:OperatorActionCode,amountCents:number,makerId?:string){
 const account=await db.prepare("SELECT * FROM operator_accounts WHERE lower(email)=? AND environment='production' AND integrity_state='production_verified' AND status='active'").bind(actor.email.toLowerCase()).first<{id:string;approval_limit_cents:number}>();if(!account)throw new SignupError('An active production operator account is required.',403);
 const assignments=await db.prepare("SELECT role FROM operator_role_assignments WHERE operator_id=? AND environment='production' AND integrity_state='production_verified' AND status='active'").bind(account.id).all<{role:OperatorRole}>();
 const mfa=operationsMfaStatus(headers);const decision=operatorControlDecision({actionCode,actorId:account.id,roles:assignments.results.map(r=>r.role),accountStatus:'active',mfaRequired:operationsMfaRequired(),mfaStatus:mfa.fresh?'verified':'not_verified',mfaVerifiedAt:headers.get('x-lokd-verified-second-factor-at'),amountCents,makerId});
 if(!decision.allowed||amountCents>account.approval_limit_cents)throw new SignupError(decision.blockers[0]??'Amount exceeds this operator’s approved limit.',403);return account;
}
export async function readProductionOperations(db:D1Database,actor:SigningActor){
 const rosters=await db.prepare(`SELECT r.id,r.version,r.status,r.starts_at,r.ends_at,ra.officer_id,b.id AS booking_id,b.client_id,b.client_price_cents FROM roster_slots r JOIN bookings b ON b.id=r.booking_id LEFT JOIN roster_assignments ra ON ra.roster_slot_id=r.id AND ra.status='confirmed' AND ra.active_key IS NOT NULL WHERE r.environment='production' AND b.environment='production' ${actor.operations?'':"AND (EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=b.client_id AND l.owner_user_id=?) OR EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='officer' AND l.entity_id=ra.officer_id AND l.owner_user_id=?))"} ORDER BY r.starts_at DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId,actor.userId])).all();
 const approvals=actor.operations?await db.prepare('SELECT * FROM production_activation_approvals ORDER BY created_at DESC LIMIT 100').all():{results:[]};
 const shifts=await db.prepare(`SELECT s.id,s.officer_id,s.status,s.check_in_at,s.check_out_at,s.client_signoff_status,b.client_id FROM shifts s JOIN bookings b ON b.id=s.booking_id WHERE s.environment='production' AND b.environment='production' ${actor.operations?'':"AND (EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=b.client_id AND l.owner_user_id=?) OR EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='officer' AND l.entity_id=s.officer_id AND l.owner_user_id=?))"} ORDER BY s.scheduled_date DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId,actor.userId])).all();
 const operators=actor.owner?await db.prepare("SELECT id,email,status,approval_limit_cents FROM operator_accounts WHERE environment='production'").all():{results:[]};
 return {rosters:rosters.results,approvals:approvals.results,shifts:shifts.results,operators:operators.results,owner:actor.owner};
}
export async function operateProduction(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers,liveCheckInEnabled=false){
 const now=new Date().toISOString();
 if(input.action==='grant_operator'){
  if(!actor.owner||!actor.operations)throw new SignupError('Only the assigned Operations owner can manage operator roles.',403);
  const email=text(input.email).toLowerCase(),role=text(input.role);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!OPERATOR_ACTION_POLICIES.some(p=>p.requiredRole===role)||!Number.isSafeInteger(input.limitCents)||Number(input.limitCents)<0)throw new SignupError('Choose an operator email, policy role and non-negative limit in cents.');
  let a=await db.prepare("SELECT id FROM operator_accounts WHERE lower(email)=? AND environment='production'").bind(email).first<{id:string}>();
  if(!a){const id='OP-'+crypto.randomUUID();await db.prepare("INSERT INTO operator_accounts(id,email,display_name,status,approval_limit_cents,environment,integrity_state,created_at,updated_at) VALUES(?,?,?,'active',?,'production','production_verified',?,?)").bind(id,email,email,input.limitCents,now,now).run();a={id};}
  await db.batch([db.prepare("UPDATE operator_accounts SET approval_limit_cents=?,version=version+1,updated_at=? WHERE id=?").bind(input.limitCents,now,a.id),db.prepare("INSERT INTO operator_role_assignments(id,operator_id,role,status,environment,integrity_state,granted_by,granted_at) VALUES(?,?,?,'active','production','production_verified',?,?) ON CONFLICT(operator_id,role,environment) DO UPDATE SET status='active',granted_by=excluded.granted_by,granted_at=excluded.granted_at,revoked_at=NULL").bind(crypto.randomUUID(),a.id,role,actor.userId,now),db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_operator_role_granted','operator',?,?,?)").bind(crypto.randomUUID(),actor.userId,a.id,JSON.stringify({role,limitCents:input.limitCents}),now)]);return {operatorId:a.id};
 }
 if(input.action==='revoke_operator'){
  if(!actor.owner||!actor.operations)throw new SignupError('Operations owner access required.',403);
  await db.batch([db.prepare("UPDATE operator_accounts SET status='suspended',version=version+1,updated_at=? WHERE id=? AND environment='production'").bind(now,text(input.operatorId)),db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_operator_suspended','operator',?,?,?)").bind(crypto.randomUUID(),actor.userId,text(input.operatorId),'Owner suspended production operator access.',now)]);return {suspended:true};
 }
 if(input.action==='check_in'){
  if(!liveCheckInEnabled)throw new SignupError('Production check-in awaits live operating acceptance.',423);
  const shiftId=text(input.shiftId);const owns=await db.prepare("SELECT s.id FROM shifts s JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=s.officer_id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status!='withdrawn' WHERE s.id=? AND s.environment='production' AND l.owner_user_id=?").bind(shiftId,actor.userId).first();if(!owns||actor.operations)throw new SignupError('Only the assigned officer may check in.',403);
  return revalidateAssignment(db,shiftId,'check_in',actor.userId);
 }
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 if(input.action==='evaluate'||input.action==='prepare_activation'){
  const request:AssignmentActivationRequest={rosterSlotId:text(input.rosterSlotId),officerId:text(input.officerId),expectedSlotVersion:Number(input.slotVersion),activationKey:text(input.activationKey),environment:'production'};
  const evaluation=await evaluateAssignmentActivation(db,request);if(input.action==='evaluate')return {ready:evaluation.result.ready,blockers:evaluation.result.blockers,evaluationHash:evaluation.evaluationHash};
  if(!evaluation.result.ready)throw new SignupError('Readiness blockers must be resolved before activation can be prepared.',409);
  const maker=await control(db,actor,headers,'offer.release',evaluation.facts.funding.bookingAmountCents);
  await recordAssignmentActivationEvaluation(db,request,maker.id);const json=JSON.stringify(request),hash=await agreementHash(json);
  const old=await db.prepare('SELECT request_hash,maker_id FROM production_activation_approvals WHERE id=?').bind(request.activationKey).first<{request_hash:string;maker_id:string}>();if(old&&(old.request_hash!==hash||old.maker_id!==maker.id))throw new SignupError('Activation key already belongs to a different request.',409);
  await db.prepare("INSERT OR IGNORE INTO production_activation_approvals VALUES(?,?,?,?,'prepared',NULL,?,?)").bind(request.activationKey,json,hash,maker.id,now,now).run();return {prepared:true,requiresIndependentApproval:true};
 }
 if(input.action==='approve_activation'){
  const a=await db.prepare('SELECT * FROM production_activation_approvals WHERE id=?').bind(text(input.activationKey)).first<{id:string;request_json:string;request_hash:string;maker_id:string;state:string;approver_id:string|null}>();if(!a)throw new SignupError('Prepared activation not found.',404);
  if(await agreementHash(a.request_json)!==a.request_hash)throw new SignupError('Activation request integrity check failed.',409);
  const request=JSON.parse(a.request_json) as AssignmentActivationRequest;
  const amount=await db.prepare("SELECT b.client_price_cents AS cents FROM bookings b JOIN roster_slots r ON r.booking_id=b.id WHERE r.id=? AND r.environment='production' AND b.environment='production'").bind(request.rosterSlotId).first<{cents:number}>();if(!amount)throw new SignupError('Production booking no longer exists.',409);
  const approver=await control(db,actor,headers,'deployment.activate',amount.cents,a.maker_id);
  if(a.state==='activated')return {alreadyActivated:true};
  if(a.state!=='prepared'&&!(a.state==='approving'&&a.approver_id===approver.id))throw new SignupError('Another reviewer owns this activation. Refresh.',409);
  if(a.state==='prepared'){const claim=await db.prepare("UPDATE production_activation_approvals SET state='approving',approver_id=?,updated_at=? WHERE id=? AND state='prepared'").bind(approver.id,now,a.id).run();if(!claim.meta.changes)throw new SignupError('Another approval started. Refresh.',409);}
  let result;
  try{result=await activateAssignment(db,request,approver.id);}catch(error){
   // Only a persisted terminal provider-independent command permits a terminal recovery state.
   const command=await db.prepare('SELECT state FROM assignment_activation_commands WHERE activation_key=?').bind(a.id).first<{state:string}>();
   if(command?.state==='blocked')await db.prepare("UPDATE production_activation_approvals SET state='blocked',updated_at=? WHERE id=? AND approver_id=?").bind(new Date().toISOString(),a.id,approver.id).run();
   throw error;
  }
  await db.prepare("UPDATE production_activation_approvals SET state='activated',updated_at=? WHERE id=? AND approver_id=?").bind(new Date().toISOString(),a.id,approver.id).run();return result;
 }
 throw new SignupError('Choose a supported production command.');
}
