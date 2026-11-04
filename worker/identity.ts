import { cleanIdentityHeaders } from "../app/lib/identity-access";

/**
 * LOKD sign-in boundary.
 *
 * Every request passes through here before the app sees it. Client-supplied
 * identity headers are always stripped. An identity provider plugs in at this
 * one point: verify the request's session and, only when it is valid, set
 *   x-lokd-verified-email, x-lokd-verified-user-id,
 *   x-lokd-verified-full-name (+ x-lokd-verified-full-name-encoding),
 *   x-lokd-verified-mfa-enrolled, x-lokd-verified-second-factor-at.
 * The rest of LOKD reads identity only through app/lokd-auth.ts and those
 * headers, so connecting a provider changes nothing else.
 *
 * No identity provider is connected, so every request is anonymous.
 */
export type IdentityResult = { request: Request; headers: Headers; response?: Response };

export async function authenticateRequest(request: Request): Promise<IdentityResult> {
  return { request: new Request(request, { headers: cleanIdentityHeaders(request) }), headers: new Headers() };
}
