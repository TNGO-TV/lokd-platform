import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

const headers = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
};

type ReadinessChecks = { requiredTables: number; requiredTriggers: number };

function reply(status: "ready" | "unavailable", code: number, checks?: ReadinessChecks) {
  return Response.json(
    {
      status,
      service: "lokd-security",
      checkedAt: new Date().toISOString(),
      productionActivationAuthorized: false,
      checks: checks ?? null,
    },
    { status: code, headers },
  );
}

export async function GET() {
  if (!env.DB) return reply("unavailable", 503);
  try {
    const schema = await env.DB.prepare(`SELECT
      SUM(CASE WHEN type = 'table' AND name IN (
        'integration_provider_configs','api_idempotency_keys','integration_operations',
        'provider_webhook_inbox','domain_outbox_events','identity_verification_cases',
        'payment_orders','service_requests') THEN 1 ELSE 0 END) AS required_tables,
      SUM(CASE WHEN type = 'trigger' AND name IN (
        'officer_application_provenance_insert_v21','identity_case_transition_guard_v21',
        'payment_order_evidence_guard_v21','integration_operation_transition_guard_v21',
        'webhook_inbox_state_guard_v21','outbox_parent_provenance_v21') THEN 1 ELSE 0 END) AS required_triggers
      FROM sqlite_master`).first<{ required_tables: number; required_triggers: number }>();
    const checks = {
      requiredTables: Number(schema?.required_tables ?? 0),
      requiredTriggers: Number(schema?.required_triggers ?? 0),
    };
    if (checks.requiredTables !== 8 || checks.requiredTriggers !== 6) return reply("unavailable", 503, checks);
    return reply("ready", 200, checks);
  } catch {
    return reply("unavailable", 503);
  }
}
