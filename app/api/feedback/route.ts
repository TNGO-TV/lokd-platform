import { env } from 'cloudflare:workers';
import { SignupError } from '../../lib/signup-server';
import { readRequestText, RequestBodyError } from '../../lib/request-body';
import { quoteActor, requireClientJson } from '../../lib/quote-access';
import { readClientFeedback, writeClientFeedback } from '../../lib/booking-client';
import { deliverClientNotifications } from '../../lib/quote-notifications';

export const dynamic = 'force-dynamic';
const reply = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
function failure(error: unknown) {
  if (error instanceof SignupError || error instanceof RequestBodyError) return reply({ error: error.message }, error.status);
  if (error instanceof Error && /UNIQUE constraint/.test(error.message)) return reply({ error: 'You have already rated this shift. Raise an issue if you need help.' }, 409);
  return reply({ error: 'Your feedback could not be saved. Please try again.' }, 503);
}
export async function GET(request: Request) {
  try {
    const actor = quoteActor(request, env);
    if (!env.DB) throw new SignupError('Feedback storage is unavailable.', 503);
    return reply(await readClientFeedback(env.DB, actor));
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    requireClientJson(request);
    const actor = quoteActor(request, env);
    if (!env.DB) throw new SignupError('Feedback storage is unavailable.', 503);
    let input: unknown;
    try { input = JSON.parse(await readRequestText(request, 8192)); } catch (error) { if (error instanceof RequestBodyError) throw error; throw new SignupError('Enter valid feedback.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignupError('Enter valid feedback.');
    const result = await writeClientFeedback(env.DB, actor, input as Record<string, unknown>);
    const emailDelivery = result.notificationIds.length ? await deliverClientNotifications(env.DB, env, { ids: result.notificationIds, ownerUserId: actor.userId }) : null;
    return reply({ ok: true, result, emailDelivery, ...await readClientFeedback(env.DB, actor) });
  } catch (error) { return failure(error); }
}
