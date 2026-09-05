import { env } from "cloudflare:workers";
import {
  ensureOnboardingDemoData,
  OnboardingWorkflowError,
  readOnboardingState,
  runControlledPilotRehearsal,
} from "../../lib/onboarding-server";
import type {
  OnboardingAction,
  OnboardingScope,
} from "../../lib/onboarding-types";
import {
  PilotAccessError,
  pilotStage,
  requirePilotApiRole,
  requireSameOriginJson,
} from "../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

function getDb() {
  if (!env.DB)
    throw new OnboardingWorkflowError(
      "The onboarding control plane is unavailable.",
      503,
    );
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
  const error =
    cause instanceof OnboardingWorkflowError ||
    cause instanceof PilotAccessError
      ? cause
      : new OnboardingWorkflowError(
          "The onboarding workflow could not complete that request.",
          500,
        );
  return response({ error: error.message }, error.status);
}

function scopeFromRequest(request: Request): OnboardingScope {
  const value = new URL(request.url).searchParams.get("scope");
  if (value === "client" || value === "officer" || value === "operations")
    return value;
  throw new OnboardingWorkflowError("Choose a valid onboarding workspace.");
}

function requireDemo() {
  if (pilotStage() !== "demo") {
    throw new OnboardingWorkflowError(
      "Onboarding rehearsal controls are locked outside the isolated demo environment.",
      423,
    );
  }
}

export async function GET(request: Request) {
  try {
    const scope = scopeFromRequest(request);
    const principal = await requirePilotApiRole(request, scope);
    requireDemo();
    const db = getDb();
    await ensureOnboardingDemoData(db);
    return response({ state: await readOnboardingState(db, scope, principal) });
  } catch (cause) {
    return errorResponse(cause);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOriginJson(request);
    const scope = scopeFromRequest(request);
    if (scope !== "operations")
      throw new PilotAccessError(
        "Only Operations can run onboarding control rehearsals.",
        403,
      );
    const principal = await requirePilotApiRole(request, "operations");
    requireDemo();
    const raw = await request.text();
    if (raw.length > 8_000)
      throw new OnboardingWorkflowError("The request is too large.", 413);
    let action: OnboardingAction;
    try {
      action = JSON.parse(raw) as OnboardingAction;
    } catch {
      throw new OnboardingWorkflowError("The request body is not valid JSON.");
    }
    if (
      !action ||
      typeof action !== "object" ||
      !["run_controlled_pilot_rehearsal", "refresh_onboarding"].includes(
        action.action,
      )
    ) {
      throw new OnboardingWorkflowError("Choose a valid onboarding action.");
    }
    const db = getDb();
    await ensureOnboardingDemoData(db);
    if (action.action === "run_controlled_pilot_rehearsal") {
      await runControlledPilotRehearsal(db, principal.email);
    }
    return response({
      state: await readOnboardingState(db, "operations", principal),
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
