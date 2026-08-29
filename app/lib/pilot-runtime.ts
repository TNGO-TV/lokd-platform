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
  const email = request.headers.get("oai-authenticated-user-email");
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!email) {
    if (pilotStage() === "demo") return publicDemoPrincipal();
    throw new PilotAccessError("Sign in to continue.", 401);
  }
  const principal = principalForEmail(email, email);
  if (!roles.some((role) => principalHasRole(principal, role))) {
    if (pilotStage() === "demo") return publicDemoPrincipal();
    throw new PilotAccessError("This account does not have access to that LOKD workspace.", 403);
  }
  return principal;
}

export function pilotStage() {
  const value = runtimeValue("LOKD_APP_STAGE").trim().toLowerCase();
  return value === "pilot" || value === "demo" ? value : "prelaunch";
}

export function liveShiftScanEnabled() {
  return runtimeValue("LOKD_LIVE_SHIFT_SCAN").trim().toLowerCase() === "true";
}
