import { env } from 'cloudflare:workers';
import { readRequestText, RequestBodyError } from '../../lib/request-body';
import { SignupError } from '../../lib/signup-server';
import { workspaceRoleForHost } from '../../lib/public-site';
import { readClientFinance, operateClientFinance, renderClientFinance, type BookingFinanceRuntime } from '../../lib/booking-finance';
import { deliverClientNotifications, type ClientNotificationRuntime } from '../../lib/quote-notifications';

export const dynamic = 'force-dynamic';
const headers = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' };
function actor(request: Request) {
  const userId = request.headers.get('x-lokd-verified-user-id'), email = request.headers.get('x-lokd-verified-email');
  if (!userId || !email) throw new SignupError('Sign in to your account.', 401);
  const role = workspaceRoleForHost(new URL(request.url).hostname);
  if (role && role !== 'client') throw new SignupError('Open your client account to view invoices.', 403);
  return { userId, email, operations: false, owner: false };
}
function fail(error: unknown) {
  const known = error instanceof SignupError || error instanceof RequestBodyError;
  return Response.json({ error: known ? error.message : 'Your billing details could not be loaded. Please try again.' }, { status: known ? error.status : 503, headers });
}
export async function GET(request: Request) {
  try {
    const a = actor(request);
    if (!env.DB) throw new SignupError('Billing is unavailable. Please try again shortly.', 503);
    const data = await readClientFinance(env.DB, a), url = new URL(request.url), kind = url.searchParams.get('download');
    if (kind) return new Response(renderClientFinance(data, kind, url.searchParams.get('id') ?? undefined), {
      headers: { ...headers, 'content-type': 'text/html; charset=utf-8', 'content-disposition': `attachment; filename="lokd-${['invoice', 'statement', 'receipt', 'credit'].includes(kind) ? kind : 'document'}.html"`, 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" },
    });
    return Response.json(data, { headers });
  } catch (error) { return fail(error); }
}
export async function POST(request: Request) {
  try {
    const a = actor(request), url = new URL(request.url);
    if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new SignupError('Open this form from your client account.', 403);
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw new SignupError('Send a valid billing request.', 415);
    if (!env.DB) throw new SignupError('Billing is unavailable. Please try again shortly.', 503);
    let input: unknown;
    try { input = JSON.parse(await readRequestText(request, 4000)); } catch (error) { if (error instanceof RequestBodyError) throw error; throw new SignupError('Send a valid billing request.'); }
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignupError('Choose a payment action.');
    const runtime = env as unknown as BookingFinanceRuntime & ClientNotificationRuntime;
    const result = await operateClientFinance(env.DB, a, input as Record<string, unknown>, request.headers, runtime);
    const delivery = result.notificationIds.length ? await deliverClientNotifications(env.DB, runtime, { ids: result.notificationIds, ownerUserId: a.userId }) : null;
    return Response.json({ ...result, delivery }, { headers });
  } catch (error) { return fail(error); }
}
