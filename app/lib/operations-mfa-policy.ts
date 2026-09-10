import { env } from "cloudflare:workers";

// Owner-authorised temporary suspension. Missing or malformed settings enforce
// MFA. This switch is server-owned; request headers and bodies cannot set it.
export function operationsMfaRequired() {
  const runtime = env as unknown as Record<string, unknown>;
  return runtime.LOKD_OPERATIONS_MFA_REQUIRED !== "false";
}
