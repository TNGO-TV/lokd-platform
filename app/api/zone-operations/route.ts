import { env } from 'cloudflare:workers';
import { operationsRequest, requireOperationsJson } from '../../lib/operations-access';
import { SignupError } from '../../lib/signup-server';
import { RequestBodyError, readRequestText } from '../../lib/request-body';
import { readZoneOperations } from '../../lib/zone-operations';
import { operateProduction } from '../../lib/production-operations';
import { workspaceCommandReceipt } from '../../lib/workspace-command-receipt';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' } });
function failure(error: unknown) { if (error instanceof SignupError || error instanceof RequestBodyError) return reply({ error: error.message }, error.status); return reply({ error: 'Operations records could not be refreshed. Try again.' }, 503); }
export async function GET(request: Request) { try { if (!env.DB) throw new SignupError('Operations storage is unavailable.', 503); const actor = await operationsRequest(env.DB, request); return reply({ state: await readZoneOperations(env.DB, actor) }); } catch (error) { return failure(error); } }
export async function POST(request: Request) { try {
  requireOperationsJson(request); if (!env.DB) throw new SignupError('Operations storage is unavailable.', 503);
  const actor = await operationsRequest(env.DB, request);
  let input: unknown; try { input = JSON.parse(await readRequestText(request, 8000)); } catch (error) { if (error instanceof RequestBodyError) throw error; throw new SignupError('Enter a valid Operations command.'); }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SignupError('Enter a valid Operations command.');
  const command = input as Record<string, unknown>;
  if (!['evaluate', 'prepare_activation', 'approve_activation', 'change_assignment'].includes(String(command.action))) throw new SignupError('Choose a Dispatch assignment action.');
  const result = await operateProduction(env.DB, actor, command, request.headers);
  return reply({ ok: true, result, commandReceipt: await workspaceCommandReceipt('zone-operations', command), state: await readZoneOperations(env.DB, actor) });
} catch (error) { return failure(error); } }
