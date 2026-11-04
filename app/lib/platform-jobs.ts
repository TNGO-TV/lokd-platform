import {env} from 'cloudflare:workers';
import {runOperationsNotifications,type OperationsMailRuntime} from './production-notifications';
import { checkSchemaReadiness, schemaMigration } from "./schema-readiness";
import { operationsMfaRequired } from "./operations-mfa-policy";

type MaintenanceOptions = {
  actorId: string;
  trigger: "scheduled" | "operator";
  evidenceStoreBound: boolean;
  environment?: string;
  integrityState?: string;
};

export type PlatformMaintenanceResult = {
  runId: string;
  status: "completed";
  processedEvents: number;
  requiredTables: number;
  requiredTriggers: number;
  evidenceStoreBound: boolean;
};

type PendingOutboxEvent = {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
};

function runId() {
  return `JOB-${crypto.randomUUID()}`;
}

function notificationSubject(eventType: string) {
  const words = eventType.replaceAll(".", " ").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

async function dispatchInternalEvents(
  db: D1Database,
  environment: string,
  integrityState: string,
  leaseOwner: string,
  now: string,
) {
  const result = await db.prepare(`SELECT id, aggregate_type AS aggregateType,
    aggregate_id AS aggregateId, event_type AS eventType
    FROM domain_outbox_events
    WHERE environment = ? AND integrity_state = ? AND status IN ('pending','retryable_failed')
      AND COALESCE(next_attempt_at, available_at) <= ?
      AND aggregate_type NOT IN ('identity_case','payment_order')
      AND event_type NOT LIKE 'identity.%' AND event_type NOT LIKE 'payment.%'
    ORDER BY available_at, created_at LIMIT 50`).bind(environment, integrityState, now).all<PendingOutboxEvent>();
  let processed = 0;
  for (const event of result.results ?? []) {
    const notificationId = `NOTIFY-${crypto.randomUUID()}`;
    const leaseExpiresAt = new Date(Date.parse(now) + 60_000).toISOString();
    const statements = [];
    if ((await db.prepare(`SELECT status FROM domain_outbox_events WHERE id = ?`).bind(event.id)
      .first<{ status: string }>())?.status === "retryable_failed") {
      statements.push(db.prepare(`UPDATE domain_outbox_events SET status = 'pending', next_attempt_at = NULL
        WHERE id = ? AND status = 'retryable_failed'`).bind(event.id));
    }
    statements.push(
      db.prepare(`UPDATE domain_outbox_events SET status = 'dispatching', attempts = attempts + 1,
        lease_owner = ?, lease_expires_at = ? WHERE id = ? AND status = 'pending'`)
        .bind(leaseOwner, leaseExpiresAt, event.id),
      db.prepare(`INSERT OR IGNORE INTO operator_notifications
        (id, source_event_id, audience_role, subject, message, status, environment, integrity_state, created_at)
        SELECT ?, id, 'operations', ?, ?, 'unread', environment, integrity_state, ?
        FROM domain_outbox_events WHERE id = ? AND status = 'dispatching' AND lease_owner = ?`)
        .bind(notificationId, notificationSubject(event.eventType),
          `${event.aggregateType} ${event.aggregateId} produced ${event.eventType}.`, now, event.id, leaseOwner),
      db.prepare(`UPDATE domain_outbox_events SET status = 'dispatched', dispatched_at = ?,
        lease_owner = NULL, lease_expires_at = NULL, last_error_code = NULL
        WHERE id = ? AND status = 'dispatching' AND lease_owner = ?`)
        .bind(now, event.id, leaseOwner),
    );
    const results = await db.batch(statements);
    const last = results.at(-1) as { meta?: { changes?: number } } | undefined;
    processed += Number(last?.meta?.changes ?? 0);
  }
  return processed;
}

function controlStatement(
  db: D1Database,
  input: {
    code: string;
    category: string;
    label: string;
    status: "ready" | "blocked";
    evidenceReference: string;
    detail: string;
    environment: string;
    integrityState: string;
    checkedAt: string;
    checkedBy: string;
  },
) {
  return db.prepare(`INSERT INTO platform_readiness_controls
    (code, category, label, status, required_for_integration_ready, evidence_reference, detail,
     environment, integrity_state, checked_at, checked_by, version)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(code) DO UPDATE SET status = excluded.status,
      evidence_reference = excluded.evidence_reference, detail = excluded.detail,
      checked_at = excluded.checked_at, checked_by = excluded.checked_by, version = version + 1
    WHERE platform_readiness_controls.environment = excluded.environment
      AND platform_readiness_controls.integrity_state = excluded.integrity_state`)
    .bind(input.code, input.category, input.label, input.status, input.evidenceReference, input.detail,
      input.environment, input.integrityState, input.checkedAt, input.checkedBy);
}

export async function runPlatformMaintenance(db: D1Database, options: MaintenanceOptions): Promise<PlatformMaintenanceResult> {
  const environment = "production";
  const integrityState = "production_verified";
  const id = runId();
  const startedAt = new Date().toISOString();
  await db.prepare(`INSERT INTO scheduled_job_runs
    (id, job_key, "trigger", status, processed_count, failure_count, detail,
     environment, integrity_state, started_at, completed_at)
    VALUES (?, 'platform-maintenance', ?, 'running', 0, 0, 'Maintenance started.', ?, ?, ?, NULL)`)
    .bind(id, options.trigger, environment, integrityState, startedAt).run();

  try {
    if(environment==='production')await runOperationsNotifications(db,env as OperationsMailRuntime);
    const checks = await checkSchemaReadiness(db);
    if (!checks.schemaComplete) {
      throw new Error("Required current database objects are missing.");
    }
    const processedEvents = await dispatchInternalEvents(db, environment, integrityState, id, startedAt);
    const evidenceStatus = options.evidenceStoreBound ? "ready" : "blocked";
    const completedAt = new Date().toISOString();
    const prefix = `${environment}:`;
    await db.batch([
      controlStatement(db, { code: `${prefix}database`, category: "backend", label: "Database and provenance guards", status: "ready", evidenceReference: `schema:${schemaMigration}`, detail: "Current required tables, guards, views and explicit indexes are present. Provider connectivity, evidence validity and operational acceptance are not assessed by this schema check.", environment, integrityState, checkedAt: completedAt, checkedBy: options.actorId }),
      controlStatement(db, { code: `${prefix}access`, category: "security", label: "Authenticated role boundary", status: "ready", evidenceReference: "code:operator-controls-v29", detail: operationsMfaRequired() ? "Role limits, recent MFA and distinct maker/checker approvals are enforced for controlled payroll commands." : "MFA is temporarily off by owner instruction. Role limits and distinct maker/checker approvals remain enforced for controlled payroll commands.", environment, integrityState, checkedAt: completedAt, checkedBy: options.actorId }),
      controlStatement(db, { code: `${prefix}jobs`, category: "backend", label: "Scheduled jobs and durable outbox", status: "ready", evidenceReference: `job:${id}`, detail: `The maintenance runner completed and dispatched ${processedEvents} internal event(s) idempotently.`, environment, integrityState, checkedAt: completedAt, checkedBy: options.actorId }),
      controlStatement(db, { code: `${prefix}maps`, category: "operations", label: "Coordinate map and travel evidence", status: "ready", evidenceReference: "code:coordinate-map-v25", detail: "Operations uses stored coordinates and versioned travel assessments without making an external mapping provider a launch dependency.", environment, integrityState, checkedAt: completedAt, checkedBy: options.actorId }),
      controlStatement(db, { code: `${prefix}evidence`, category: "security", label: "Private evidence object store", status: evidenceStatus, evidenceReference: options.evidenceStoreBound ? "binding:BUCKET" : "binding:missing", detail: options.evidenceStoreBound ? "The private R2 binding is present; artifacts are hash-addressed in D1 and served only through an authorised route." : "The evidence adapter is built, but the private R2 binding is not present in this runtime.", environment, integrityState, checkedAt: completedAt, checkedBy: options.actorId }),
      db.prepare(`INSERT INTO service_heartbeats
        (key, status, environment, detail, checked_at, last_success_at, consecutive_failures)
        VALUES (?, 'healthy', ?, ?, ?, ?, 0)
        ON CONFLICT(key) DO UPDATE SET status = 'healthy', detail = excluded.detail,
          checked_at = excluded.checked_at, last_success_at = excluded.last_success_at, consecutive_failures = 0`)
        .bind(`${environment}:platform-maintenance`, environment,
          `Production maintenance completed; ${processedEvents} internal event(s) dispatched.`, completedAt, completedAt),
      db.prepare(`UPDATE scheduled_job_runs SET status = 'completed', processed_count = ?,
        detail = ?, completed_at = ? WHERE id = ? AND status = 'running'`)
        .bind(processedEvents, `Schema, evidence binding and internal outbox checked.`, completedAt, id),
    ]);
    return { runId: id, status: "completed", processedEvents, ...checks, evidenceStoreBound: options.evidenceStoreBound };
  } catch (cause) {
    const completedAt = new Date().toISOString();
    const detail = cause instanceof Error ? cause.message.slice(0, 800) : "Unknown maintenance failure.";
    await db.batch([
      db.prepare(`UPDATE scheduled_job_runs SET status = 'failed', failure_count = 1,
        detail = ?, completed_at = ? WHERE id = ? AND status = 'running'`).bind(detail, completedAt, id),
      db.prepare(`INSERT INTO service_heartbeats
        (key, status, environment, detail, checked_at, last_success_at, consecutive_failures)
        VALUES (?, 'unavailable', ?, ?, ?, NULL, 1)
        ON CONFLICT(key) DO UPDATE SET status = 'unavailable', detail = excluded.detail,
          checked_at = excluded.checked_at, consecutive_failures = consecutive_failures + 1`)
        .bind(`${environment}:platform-maintenance`, environment, detail, completedAt),
    ]);
    throw cause;
  }
}

// Deadlines come from persisted intake and expiry policies; callers cannot supply
// a clock or shorten retention. Linked business records require manual review.
export async function runDataRetention(db: D1Database) {
  const result = await db.batch([
    db.prepare(`DELETE FROM client_enquiries WHERE id IN (
      SELECT id FROM client_enquiries e WHERE julianday(retention_review_at) <= julianday('now')
      AND NOT EXISTS (SELECT 1 FROM signup_cases c WHERE c.source_id=e.id)
      AND NOT EXISTS (SELECT 1 FROM operational_delivery_jobs j WHERE j.source_id=e.id AND j.state='dispatching')
      ORDER BY retention_review_at LIMIT 100)`),
    db.prepare(`DELETE FROM api_idempotency_keys WHERE id IN (
      SELECT id FROM api_idempotency_keys WHERE julianday(expires_at) <= julianday('now')
      ORDER BY expires_at LIMIT 500)`),
    db.prepare(`DELETE FROM public_officer_presence WHERE id IN (
      SELECT id FROM public_officer_presence WHERE julianday(expires_at) <= julianday('now')
      ORDER BY expires_at LIMIT 500)`),
    db.prepare(`DELETE FROM officer_application_receipts WHERE application_id IN (
      SELECT a.id FROM officer_applications a WHERE julianday(a.retention_review_at) <= julianday('now')
      AND NOT EXISTS (SELECT 1 FROM signup_cases c WHERE c.source_id=a.id)
      AND EXISTS (SELECT 1 FROM officer_application_receipts r WHERE r.application_id=a.id)
      ORDER BY a.retention_review_at LIMIT 100)`),
  ]);
  const removed = result.map(r => Number(r.meta.changes ?? 0));
  console.info(JSON.stringify({ event: 'data_retention_completed', enquiries: removed[0],
    requestReceipts: removed[1], presenceSessions: removed[2], applicationReceipts: removed[3] }));
  return { enquiries: removed[0], requestReceipts: removed[1], presenceSessions: removed[2], applicationReceipts: removed[3] };
}
