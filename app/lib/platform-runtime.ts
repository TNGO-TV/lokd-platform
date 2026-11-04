import { operationsMfaRequired } from "./operations-mfa-policy";
import { operationsMfaStatus } from "./operations-mfa";
import { env } from "cloudflare:workers";
import {
  AccessError,
  principalForEmailFromConfig,
  principalHasRole,
  requireSameOriginJson,
  type AccessPrincipal,
  type AccessRole,
} from "./access-core";
import {
  requestHostname,
  workspaceRoleForHost,
} from "./public-site";

export {
  AccessError,
  principalHasRole,
  requireSameOriginJson,
  type AccessPrincipal,
  type AccessRole,
};

function runtimeValue(key: string): string {
  const runtime = env as unknown as Record<string, unknown>;
  return typeof runtime[key] === "string" ? String(runtime[key]) : "";
}

export function principalForEmail(email: string, displayName = email): AccessPrincipal {
  return principalForEmailFromConfig(email, displayName,
    runtimeValue("LOKD_ROLE_ACCESS_JSON"), runtimeValue("LOKD_OPERATIONS_ACCESS_JSON"),
    runtimeValue("LOKD_OWNER_ACCESS_JSON"));
}

export function requireApiRole(request: Request, allowed: AccessRole | AccessRole[]) {
  const email = request.headers.get("x-lokd-verified-email");
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  const hostname = requestHostname(new URL(request.url).hostname);
  const hostnameRole = workspaceRoleForHost(hostname);
  if (hostnameRole && !roles.includes(hostnameRole)) {
    throw new AccessError(
      "Use the correct LOKD workspace for this request.",
      403,
    );
  }
  if (!email) {
    throw new AccessError("Sign in to continue.", 401);
  }
  const principal = principalForEmail(email, email);
  if (!roles.some((role) => principalHasRole(principal, role))) {
    throw new AccessError("This account does not have access to that LOKD workspace.", 403);
  }
  if (operationsMfaRequired() && roles.includes("operations") && principalHasRole(principal, "operations")
    && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !operationsMfaStatus(request.headers).fresh) {
    throw new AccessError("Verify your Operations second factor at /ops/security before changing live records.", 403);
  }
  return principal;
}
