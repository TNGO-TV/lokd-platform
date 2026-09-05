import { env } from "cloudflare:workers";
import { applyPlatformAction, ensureIntegrationDemoData, PlatformWorkflowError, readPlatformState } from "../../lib/integration-server";
import type { PlatformAction } from "../../lib/platform-types";
import { PilotAccessError, pilotStage, requirePilotApiRole, requireSameOriginJson } from "../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

function getDb() {
  if (!env.DB) throw new PlatformWorkflowError("The platform backend is unavailable.", 503);
  return env.DB;
}

function response(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "Cookie, Authorization",
    },
  });
}

function errorResponse(cause: unknown) {
  const error = cause instanceof PlatformWorkflowError || cause instanceof PilotAccessError
    ? cause
    : new PlatformWorkflowError("The platform workflow could not complete that request.", 500);
  return response({ error: error.message }, error.status);
}

function requireDemo() {
  if (pilotStage() !== "demo") {
    throw new PlatformWorkflowError("Synthetic integration controls are disabled outside the demo environment.", 423);
  }
}

export async function GET(request: Request) {
  try {
    const actor = await requirePilotApiRole(request, "operations");
    requireDemo();
    const db = getDb();
    await ensureIntegrationDemoData(db);
    return response({ state: await readPlatformState(db, actor.email) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOriginJson(request);
    const actor = await requirePilotApiRole(request, "operations");
    requireDemo();
    const raw = await request.text();
    if (raw.length > 16_000) throw new PlatformWorkflowError("The request is too large.", 413);
    let action: PlatformAction;
    try {
      action = JSON.parse(raw) as PlatformAction;
    } catch {
      throw new PlatformWorkflowError("The request body is not valid JSON.");
    }
    if (!action || typeof action !== "object" || typeof action.action !== "string") {
      throw new PlatformWorkflowError("Choose a valid platform action.");
    }
    if (!new Set([
      "refresh_integration_health",
      "triage_service_request",
      "resolve_service_request",
      "approve_timesheet",
      "review_invoice",
      "calculate_payroll_run",
      "approve_payroll_run",
      "second_approve_payroll_run",
      "run_payroll_shadow_validation",
      "resolve_payroll_exception",
      "run_platform_maintenance",
    ]).has(action.action)) {
      throw new PlatformWorkflowError("Choose a valid platform action.");
    }
    await applyPlatformAction(getDb(), action, actor.email, { evidenceStoreBound: Boolean(env.BUCKET) });
    return response({ state: await readPlatformState(getDb(), actor.email) });
  } catch (cause) {
    return errorResponse(cause);
  }
}
