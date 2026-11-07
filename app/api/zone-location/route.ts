import { env } from 'cloudflare:workers';
import { officerApiActor, OfficerAccessError } from '../../lib/officer-api-access';
import { operationsRequest, requireOperationsJson } from '../../lib/operations-access';
import { quoteActor } from '../../lib/quote-access';
import { SignupError } from '../../lib/signup-server';
import { RequestBodyError, readRequestText } from '../../lib/request-body';
import { operateZoneLocation, ownLocationConsent, readClientRoute, readDispatchLocations } from '../../lib/zone-location';
import { workspaceCommandReceipt } from '../../lib/workspace-command-receipt';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } });
function failure(error: unknown) { if (error instanceof SignupError || error instanceof OfficerAccessError || error instanceof RequestBodyError) return reply({ error: error.message }, error.status); if (error instanceof Error && /zone_location_|CHECK constraint/.test(error.message)) return reply({ error: 'Sharing or verification changed. Refresh before continuing.' }, 409); return reply({ error: 'Location sharing is unavailable. Try again.' }, 503); }
export async function GET(request: Request) { try {
  if (!env.DB) throw new SignupError('Location storage is unavailable.', 503);
  const q = new URL(request.url).searchParams, scope = q.get('scope');
  if (scope === 'operations') { await operationsRequest(env.DB, request); return reply({ points: await readDispatchLocations(env.DB), checkedAt: new Date().toISOString() }); }
  if (scope === 'client') return reply(await readClientRoute(env.DB, quoteActor(request, env), q.get('shiftId') ?? ''));
  if (scope && scope !== 'officer') throw new SignupError('Open your Zone.', 403);
  return reply({ consent: await ownLocationConsent(env.DB, officerApiActor(request)) });
} catch (error) { return failure(error); } }
export async function POST(request: Request) { try {
  requireOperationsJson(request);
  const actor = officerApiActor(request); if (!env.DB) throw new SignupError('Location storage is unavailable.', 503);
  let input: unknown; try { input = JSON.parse(await readRequestText(request, 3000)); } catch (error) { if (error instanceof RequestBodyError) throw error; throw new SignupError('Enter a valid sharing request.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignupError('Enter a valid sharing request.');
  const command = input as Record<string, unknown>, result = await operateZoneLocation(env.DB, actor, command);
  return reply({ ok: true, result, consent: await ownLocationConsent(env.DB, actor), commandReceipt: await workspaceCommandReceipt('zone-location', command) });
} catch (error) { return failure(error); } }
