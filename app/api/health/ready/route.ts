import { env } from "cloudflare:workers";

import { checkSchemaReadiness, requiredSchemaCounts, schemaMigration } from "../../../lib/schema-readiness";

export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
};

type ReadinessChecks = { requiredTables: number; requiredTriggers: number; requiredViews: number; requiredIndexes: number; schemaComplete: boolean; evidenceStoreBound: boolean };

function reply(status: "ready" | "unavailable", code: number, checks?: ReadinessChecks) {
  return Response.json(
    {
      status,
      service: "lokd-security",
      checkedAt: new Date().toISOString(),
      productionActivationAuthorized: env.LOKD_OWNER_LIVE === "true",
      payrollMode: env.LOKD_OWNER_LIVE === "true" ? "owner_live" : "shadow_settlement_locked",
      readinessScope: "current_schema_objects_and_evidence_binding",
      schemaMigration,
      expectedSchema: requiredSchemaCounts,
      infrastructureReady: status === "ready",
      providerConnectivity: "not_assessed",
      operationalAcceptance: "not_assessed",
      checks: checks ?? null,
    },
    { status: code, headers },
  );
}

export async function GET() {
  if (!env.DB) return reply("unavailable", 503);
  try {
    const checks = {
      ...await checkSchemaReadiness(env.DB),
      evidenceStoreBound: Boolean(env.BUCKET),
    };
    if (!checks.schemaComplete || !checks.evidenceStoreBound) {
      return reply("unavailable", 503, checks);
    }
    return reply("ready", 200, checks);
  } catch {
    return reply("unavailable", 503);
  }
}
