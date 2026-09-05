import { env } from "cloudflare:workers";
import {
  PilotAccessError,
  principalForClerkUserFromConfig,
  principalHasRole,
  publicDemoPrincipal,
  requireSameOriginJson,
  roleForPilotAction,
  type PilotPrincipal,
  type PilotRole,
} from "./pilot-access-core";
import {
  isLegacyPublicDemoHost,
  requestHostname,
  workspaceRoleForHost,
} from "./public-site";
import { verifiedClerkSession } from "./clerk-session";

export {
  PilotAccessError,
  principalHasRole,
  publicDemoPrincipal,
  requireSameOriginJson,
  roleForPilotAction,
  type PilotPrincipal,
  type PilotRole,
};

function runtimeValue(key: string): string {
  const runtime = env as unknown as Record<string, unknown>;
  return typeof runtime[key] === "string" ? String(runtime[key]) : "";
}

export function principalForClerkUser(userId: string): PilotPrincipal {
  return principalForClerkUserFromConfig(userId, runtimeValue("LOKD_PILOT_ACCESS_JSON"));
}

export async function requirePilotApiRole(request: Request, allowed: PilotRole | PilotRole[], options: { allowPublicDemo?: boolean } = {}) {
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  const hostname = requestHostname(new URL(request.url).hostname);
  const hostnameRole = workspaceRoleForHost(hostname);
  if (hostnameRole && !roles.includes(hostnameRole)) {
    throw new PilotAccessError(
      "Use the correct LOKD workspace for this request.",
      403,
    );
  }
  const publicDemoFallback = options.allowPublicDemo !== false && pilotStage() === "demo"
    && (isLegacyPublicDemoHost(hostname) || hostname.endsWith(".chatgpt.site") || hostname === "app.local");
  const session = await verifiedClerkSession(request);
  if (!session) {
    if (publicDemoFallback) return publicDemoPrincipal();
    throw new PilotAccessError("Sign in to continue.", 401);
  }
  const principal = principalForClerkUser(session.userId);
  if (!roles.some((role) => principalHasRole(principal, role))) {
    if (publicDemoFallback) return publicDemoPrincipal();
    throw new PilotAccessError("This account does not have access to that LOKD workspace.", 403);
  }
  return principal;
}

export function pilotStage() {
  const value = runtimeValue("LOKD_APP_STAGE").trim().toLowerCase();
  return value === "pilot" || value === "demo" || value === "production" ? value : "prelaunch";
}

export function liveShiftScanEnabled() {
  return runtimeValue("LOKD_LIVE_SHIFT_SCAN").trim().toLowerCase() === "true";
}
