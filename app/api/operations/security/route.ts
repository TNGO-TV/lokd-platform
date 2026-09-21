import { operationsMfaRequired } from "../../../lib/operations-mfa-policy";
import { reverificationError } from '@clerk/backend/internal';
import { principalForEmail, principalHasRole, PilotAccessError } from '../../../lib/pilot-runtime';
import { operationsMfaStatus } from '../../../lib/operations-mfa';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const reply = (body: unknown, status = 200) => Response.json(body, {status, headers: {'cache-control':'private, no-store'}});
  try {
    const email = request.headers.get('x-lokd-verified-email');
    if (!email || !request.headers.has('x-lokd-verified-user-id')) throw new PilotAccessError('Sign in to continue.',401);
    if (!principalHasRole(principalForEmail(email),'operations')) throw new PilotAccessError('Operations access is required.',403);
    const state = { ...operationsMfaStatus(request.headers), required: operationsMfaRequired() };
    if (state.required && new URL(request.url).searchParams.get('verify') === '1' && !state.fresh) {
      if (!state.enrolled) return reply({error:'Enrol an authenticator in Account security first.',...state},403);
      return reply(reverificationError({level:'second_factor',afterMinutes:4}),403);
    }
    return reply(state);
  } catch (error) {
    return reply({error:error instanceof PilotAccessError ? error.message : 'Security status is unavailable.'},error instanceof PilotAccessError ? error.status : 503);
  }
}
