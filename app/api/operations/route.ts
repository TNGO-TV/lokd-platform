import { env } from "cloudflare:workers";
import { OperationsError, applyOperationsAction, ensureOperationsDemoData, readOperationsState } from "../../lib/operations-server";
import type { OperationsAction } from "../../lib/operations-types";
import { PilotAccessError, pilotStage, requirePilotApiRole, requireSameOriginJson } from "../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

function database() {
  if (!env.DB) throw new OperationsError("The Operations database is unavailable.", 503);
  return env.DB;
}

function requireSyntheticDemo() {
  if (pilotStage() !== "demo") throw new PilotAccessError("The synthetic Operations command model is disabled outside the demo environment.", 423);
}

function response(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store, private",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      vary: "oai-authenticated-user-email",
    },
  });
}

function failure(cause: unknown) {
  const error = cause instanceof OperationsError || cause instanceof PilotAccessError
    ? cause
    : new OperationsError("The Operations command service could not complete that request.", 500);
  return response({ error: error.message }, error.status);
}

export async function GET(request: Request) {
  try {
    requirePilotApiRole(request, "operations");
    requireSyntheticDemo();
    const db = database();
    await ensureOperationsDemoData(db);
    return response({ state: await readOperationsState(db) });
  } catch (cause) {
    return failure(cause);
  }
}

export async function POST(request: Request) {
  try {
    requireSameOriginJson(request);
    const actor = requirePilotApiRole(request, "operations");
    requireSyntheticDemo();
    const raw = await request.text();
    if (raw.length > 8_192) throw new OperationsError("The request is too large.", 413);
    let payload: OperationsAction;
    try {
      payload = JSON.parse(raw) as OperationsAction;
    } catch {
      throw new OperationsError("The request body is not valid JSON.");
    }
    if (!payload || typeof payload !== "object" || typeof payload.action !== "string") throw new OperationsError("Choose a valid Operations action.");
    const db = database();
    await ensureOperationsDemoData(db);
    await applyOperationsAction(db, payload, actor);
    return response({ state: await readOperationsState(db) });
  } catch (cause) {
    return failure(cause);
  }
}
