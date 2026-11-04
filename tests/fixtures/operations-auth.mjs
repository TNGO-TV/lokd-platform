import {operateProduction} from '../../app/lib/production-operations.ts';
export function operatorHeaders(actor={userId:'fixture-operator',email:'fixture-operator@example.test'},source){
 const headers=new Headers(source);headers.set('x-lokd-verified-user-id',actor.userId);headers.set('x-lokd-verified-email',actor.email);headers.set('x-lokd-verified-mfa-enrolled','true');headers.set('x-lokd-verified-second-factor-at',new Date().toISOString());return headers;
}
// Local account administration is performed by a separate named owner. Tests
// exercise the real grant command; fixtures do not waive its MFA or role checks.
export async function operateWithProof(db,actor,input,headers,...rest){
 let requestActor=actor;
 if(actor.operations&&actor.owner&&['grant_operator','revoke_operator'].includes(input.action)){
  const admin={userId:'fixture-access-administrator',email:'fixture-access-administrator@example.test',operations:true,owner:true};
  const now=new Date().toISOString();
  await db.batch([
   db.prepare("INSERT OR IGNORE INTO operator_accounts(id,email,display_name,status,approval_limit_cents,environment,integrity_state,created_at,updated_at) VALUES(?,?,?,'active',100000000,'production','production_verified',?,?)").bind(admin.userId,admin.email,'Local access administrator',now,now),
   db.prepare("INSERT OR IGNORE INTO operator_role_assignments(id,operator_id,role,status,environment,integrity_state,granted_by,granted_at) VALUES(?,?,'operations_owner','active','production','production_verified','fixture',?)").bind('fixture-access-administrator-owner',admin.userId,now),
  ]);requestActor=admin;
 }
 return operateProduction(db,requestActor,input,operatorHeaders(requestActor,headers),...rest);
}
