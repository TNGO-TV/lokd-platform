import { SignupError } from './signup-server';
import { operationsMfaStatus } from './operations-mfa';
import { workspaceRoleForHost } from './public-site';
import type { SigningActor } from './production-signing';

type AccessRuntime = { LOKD_OPERATIONS_ACCESS_JSON?: string; LOKD_OWNER_ACCESS_JSON?: string };

function listed(raw: string | undefined, email: string) {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(values) && values.some(value => typeof value === 'string' && value.trim().toLowerCase() === email);
  } catch { return false; }
}

// The Worker strips incoming identity headers and sets these after verifying the sign-in.
export function quoteActor(request: Request, runtime: AccessRuntime): SigningActor {
  const userId = request.headers.get('x-lokd-verified-user-id');
  const email = request.headers.get('x-lokd-verified-email')?.trim().toLowerCase();
  if (!userId || !email) throw new SignupError('Sign in to your account.', 401);
  const url = new URL(request.url);
  const operations = url.searchParams.get('scope') === 'operations';
  const host = workspaceRoleForHost(url.hostname);
  if (host && host !== (operations ? 'operations' : 'client')) throw new SignupError('Open the correct workspace.', 403);
  const owner = operations && listed(runtime.LOKD_OWNER_ACCESS_JSON, email);
  if (operations && !owner && !listed(runtime.LOKD_OPERATIONS_ACCESS_JSON, email)) throw new SignupError('Operations access required.', 403);
  if (operations && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && !operationsMfaStatus(request.headers).fresh) {
    throw new SignupError('Verify your second factor in Operations security before changing records.', 403);
  }
  return { userId, email, operations, owner };
}

export function requireClientJson(request: Request) {
  if (request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !== 'application/json') throw new SignupError('Use application/json for this request.', 415);
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (origin && origin !== new URL(request.url).origin || fetchSite && !['same-origin', 'none'].includes(fetchSite)) throw new SignupError('Cross-site requests are not accepted.', 403);
}
