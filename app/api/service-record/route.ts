import { env } from 'cloudflare:workers';
import { SignupError } from '../../lib/signup-server';
import { quoteActor } from '../../lib/quote-access';
import { readClientShifts } from '../../lib/booking-client';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
  try {
    const actor = quoteActor(request, env);
    if (actor.operations) throw new SignupError('Open your client account to download its service records.', 403);
    if (!env.DB) throw new SignupError('Service record storage is unavailable.', 503);
    const shift = new URL(request.url).searchParams.get('shift');
    if (shift && (shift.length > 160 || !/^[a-zA-Z0-9:_-]+$/.test(shift))) throw new SignupError('Choose a valid shift reference.');
    const records = await readClientShifts(env.DB, actor, shift);
    if (shift && !records.length) throw new SignupError('Shift not found for your account.', 404);
    const generatedAt = new Date().toISOString();
    return new Response(JSON.stringify({ title: 'LOKD service record', generatedAt, records }, null, 2), { headers: { ...headers, 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="lokd-service-record-${generatedAt.slice(0, 10)}.json"` } });
  } catch (error) {
    return Response.json({ error: error instanceof SignupError ? error.message : 'The service record could not be loaded.' }, { status: error instanceof SignupError ? error.status : 503, headers });
  }
}
