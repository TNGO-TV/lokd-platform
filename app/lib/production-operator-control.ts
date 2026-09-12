import {SignupError} from './signup-server';
import {operatorControlDecision,type OperatorRole,type OperatorActionCode} from './operator-controls';
import {operationsMfaStatus} from './operations-mfa';
import {operationsMfaRequired} from './operations-mfa-policy';
import type {SigningActor} from './production-signing';
export async function productionOperatorControl(db:D1Database,actor:SigningActor,headers:Headers,actionCode:OperatorActionCode,amountCents:number,makerId?:string){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const account=await db.prepare("SELECT * FROM operator_accounts WHERE lower(email)=? AND environment='production' AND integrity_state='production_verified' AND status='active'").bind(actor.email.toLowerCase()).first<{id:string;approval_limit_cents:number}>();if(!account)throw new SignupError('An active production operator account is required.',403);
 const assignments=await db.prepare("SELECT role FROM operator_role_assignments WHERE operator_id=? AND environment='production' AND integrity_state='production_verified' AND status='active'").bind(account.id).all<{role:OperatorRole}>();
 const mfa=operationsMfaStatus(headers);const decision=operatorControlDecision({actionCode,actorId:account.id,roles:assignments.results.map(r=>r.role),accountStatus:'active',mfaRequired:operationsMfaRequired(),mfaStatus:mfa.fresh?'verified':'not_verified',mfaVerifiedAt:headers.get('x-lokd-verified-second-factor-at'),amountCents,makerId});
 if(!decision.allowed||amountCents>account.approval_limit_cents)throw new SignupError(decision.blockers[0]??'Amount exceeds this operator’s approved limit.',403);return account;
}
