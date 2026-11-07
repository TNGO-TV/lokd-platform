import { workspaceCommandReceipt } from '../../lib/workspace-command-receipt';
import { env } from 'cloudflare:workers';
import { OfficerAccessError, officerApiActor, requireOfficerJson } from '../../lib/officer-api-access';
import { SignupError } from '../../lib/signup-server';
import { readRequestText, RequestBodyError } from '../../lib/request-body';
import { operateZoneTraining, readZoneTraining } from '../../lib/zone-training';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
function actor(request: Request) { const scope = new URL(request.url).searchParams.get('scope'); if (scope && !['officer', 'operations'].includes(scope)) throw new SignupError('Open your Training Zone.', 403); return officerApiActor(request, scope === 'operations'); }
function failure(error: unknown) {
  if (error instanceof SignupError || error instanceof OfficerAccessError || error instanceof RequestBodyError) return reply({ error: error.message }, error.status);
  if (error instanceof Error && /zone_training_|UNIQUE constraint/.test(error.message)) return reply({ error: 'This session, enrolment or assessment changed. Refresh before continuing.' }, 409);
  return reply({ error: 'Training records are temporarily unavailable. Please try again.' }, 503);
}
export async function GET(request: Request) { try { const a = actor(request); if (!env.DB) throw new SignupError('Training storage is unavailable.', 503); return reply({ state: await readZoneTraining(env.DB, a) }); } catch (error) { return failure(error); } }
export async function POST(request: Request) { try { requireOfficerJson(request); const a = actor(request); if (!env.DB) throw new SignupError('Training storage is unavailable.', 503); let input: unknown; try { input = JSON.parse(await readRequestText(request, 12000)); } catch (error) { if (error instanceof RequestBodyError) throw error; throw new SignupError('Enter a valid training request.'); } if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignupError('Enter a valid training request.'); const result = await operateZoneTraining(env.DB, a, input as Record<string, unknown>); return reply({ ok: true, result, commandReceipt: await workspaceCommandReceipt('zone-training', input as Record<string, unknown>), state: await readZoneTraining(env.DB, a) }); } catch (error) { return failure(error); } }
