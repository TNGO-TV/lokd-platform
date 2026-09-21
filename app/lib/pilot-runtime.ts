import { operationsMfaRequired } from "./operations-mfa-policy";
import { operationsMfaStatus } from "./operations-mfa";
import { env } from "cloudflare:workers";
import {
  PilotAccessError,
  principalForEmailFromConfig,
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

export function principalForEmail(email: string, displayName = email): PilotPrincipal {
  return principalForEmailFromConfig(email, displayName, runtimeValue("LOKD_PILOT_ACCESS_JSON"));
}

export function requirePilotApiRole(request: Request, allowed: PilotRole | PilotRole[]) {
  const email = request.headers.get("x-lokd-verified-email");
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  const hostname = requestHostname(new URL(request.url).hostname);
  const hostnameRole = workspaceRoleForHost(hostname);
  if (hostnameRole && !roles.includes(hostnameRole)) {
    throw new PilotAccessError(
      "Use the correct LOKD workspace for this request.",
      403,
    );
  }
  const publicDemoFallback = pilotStage() === "demo"
    && (isLegacyPublicDemoHost(hostname) || hostname.endsWith(".chatgpt.site") || hostname === "app.local");
  if (!email) {
    if (publicDemoFallback) return publicDemoPrincipal();
    throw new PilotAccessError("Sign in to continue.", 401);
  }
  const principal = principalForEmail(email, email);
  if (!roles.some((role) => principalHasRole(principal, role))) {
    if (publicDemoFallback) return publicDemoPrincipal();
    throw new PilotAccessError("This account does not have access to that LOKD workspace.", 403);
  }
  if (operationsMfaRequired() && pilotStage() !== "demo" && roles.includes("operations") && principalHasRole(principal, "operations")
    && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !operationsMfaStatus(request.headers).fresh) {
    throw new PilotAccessError("Verify your Operations second factor at /ops/security before changing live records.", 403);
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
