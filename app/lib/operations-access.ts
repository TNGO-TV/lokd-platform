import { SignupError } from './signup-server';
import { operationsMfaStatus } from './operations-mfa';
import type { OperatorRole } from './operator-controls';
import { workspaceRoleForHost } from './public-site';

export type OperationsActor = {
  userId: string; email: string; operations: true; owner: boolean;
  operatorId: string; roles: OperatorRole[]; approvalLimitCents: number;
};

export async function operationsAccess(db: D1Database, headers: Headers, allowMfaRefresh = false): Promise<OperationsActor> {
  const userId = headers.get('x-lokd-verified-user-id');
  const email = headers.get('x-lokd-verified-email')?.toLowerCase();
  if (!userId || !email) throw new SignupError('Sign in to your LOKD account.', 401);
  const account = await db.prepare(`SELECT id, approval_limit_cents FROM operator_accounts
    WHERE lower(email)=? AND environment='production' AND integrity_state='production_verified' AND status='active'`)
    .bind(email).first<{id:string; approval_limit_cents:number}>();
  if (!account) throw new SignupError('An active named operator account is required. Contact your LOKD administrator.', 403);
  const assignments = await db.prepare(`SELECT role FROM operator_role_assignments WHERE operator_id=?
    AND environment='production' AND integrity_state='production_verified' AND status='active' AND revoked_at IS NULL`)
    .bind(account.id).all<{role:OperatorRole}>();
  const roles = assignments.results.map(row => row.role);
  if (!roles.length) throw new SignupError('Your operator account has no active role.', 403);
  if (!allowMfaRefresh && !operationsMfaStatus(headers).fresh) {
    throw new SignupError('Verify your second factor in Account security before opening Operations records.', 403);
  }
  return {userId, email, operations:true, owner:roles.includes('operations_owner'), operatorId:account.id,
    roles, approvalLimitCents:account.approval_limit_cents};
}

export async function operationsRequest(db: D1Database, request: Request, allowMfaRefresh = false) {
  const hostRole = workspaceRoleForHost(new URL(request.url).hostname);
  if (hostRole && hostRole !== 'operations') throw new SignupError('Open the Operations workspace.', 403);
  return operationsAccess(db, request.headers, allowMfaRefresh);
}

export function requireOperationsRole(actor: OperationsActor, roles: OperatorRole[], amountCents = 0) {
  if (!roles.some(role => actor.roles.includes(role))) throw new SignupError('Your assigned role cannot perform this action.', 403);
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new SignupError('The amount must be a non-negative whole number of cents.');
  if (amountCents > actor.approvalLimitCents) throw new SignupError('The amount exceeds your approval limit.', 403);
}

export function requireOperationsJson(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new SignupError('Submit this action from the LOKD workspace.', 403);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new SignupError('Send a JSON request.', 415);
  }
}
