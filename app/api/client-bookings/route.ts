import { env } from 'cloudflare:workers';
import { SignupError } from '../../lib/signup-server';
import { readRequestText, RequestBodyError } from '../../lib/request-body';
import { quoteActor, requireClientJson } from '../../lib/quote-access';
import { deliverClientNotifications } from '../../lib/quote-notifications';
import { operateClientWorkspace, readClientWorkspace } from '../../lib/booking-client';
import { readOperationsClientRequests, reviewClientRequest } from '../../lib/booking-client-requests';
import { workspaceCommandReceipt } from '../../lib/workspace-command-receipt';

export const dynamic = 'force-dynamic';
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
function failure(error: unknown) {
  if (error instanceof SignupError || error instanceof RequestBodyError) return reply({ error: error.message }, error.status);
  if (error instanceof Error && /client_request_changed|client_booking_cancellation_requires_review|client_service_decision_changed|client_service_request_review_changed|client_booking_already_closed|Service evidence changed before decision|UNIQUE constraint/.test(error.message)) return reply({ error: 'This record changed or was already submitted. Refresh before continuing.' }, 409);
  return reply({ error: 'Your account could not be updated. Please refresh and try again.' }, 503);
}
export async function GET(request: Request) {
  try {
    const actor = quoteActor(request, env);
    if (!env.DB) throw new SignupError('Client account storage is unavailable.', 503);
    return reply(actor.operations ? await readOperationsClientRequests(env.DB, actor) : await readClientWorkspace(env.DB, actor));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    requireClientJson(request);
    const actor = quoteActor(request, env);
    if (!env.DB) throw new SignupError('Client account storage is unavailable.', 503);
    let input: unknown;
    try { input = JSON.parse(await readRequestText(request, 14000)); } catch (error) { if (error instanceof RequestBodyError) throw error; throw new SignupError('Enter a valid request.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignupError('Enter a valid request.');
    const command = input as Record<string, unknown>;
    if (command.action === 'review_request') {
      const result = await reviewClientRequest(env.DB, actor, command);
      const emailDelivery = await deliverClientNotifications(env.DB, env, { ids: result.notificationIds });
      return reply({ ok: true, result, emailDelivery, ...await readOperationsClientRequests(env.DB, actor), commandReceipt: await workspaceCommandReceipt('client-enquiries', command) });
    }
    if (actor.operations) throw new SignupError('Choose a supported service-request review action.');
    if (command.action === 'retry_notifications') {
      const emailDelivery = await deliverClientNotifications(env.DB, env, { ownerUserId: actor.userId });
      return reply({ ok: true, result: { emailDelivery }, emailDelivery, ...await readClientWorkspace(env.DB, actor) });
    }
    const result = await operateClientWorkspace(env.DB, actor, command);
    const emailDelivery = result.notificationIds.length ? await deliverClientNotifications(env.DB, env, { ids: result.notificationIds, ownerUserId: actor.userId }) : null;
    return reply({ ok: true, result, emailDelivery, ...await readClientWorkspace(env.DB, actor) });
  } catch (error) { return failure(error); }
}
