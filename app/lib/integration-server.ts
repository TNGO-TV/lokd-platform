import type {
  PlatformAction,
  PlatformIdentityCase,
  PlatformInvoice,
  PlatformIntegration,
  PlatformPaymentOrder,
  PlatformServiceRequest,
  PlatformState,
  PlatformTimesheet,
  PlatformWorkflowSection,
} from "./platform-types";
import { runPlatformMaintenance } from "./platform-jobs";
import { calculatePayrollItem, SYNTHETIC_ENGINE_TEST_POLICY } from "./payroll-engine";

export class PlatformWorkflowError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function parseStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

export async function ensureIntegrationDemoData(db: D1Database) {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO integration_provider_configs
      (key, capability, provider, mode, status, required_for_pilot, configuration_version, capabilities,
       detail, environment, integrity_state, last_health_state, last_health_checked_at, last_event_at, updated_at)
      VALUES ('INT-DEMO-BACKEND', 'backend', 'LOKD internal backend', 'internal', 'sandbox_ready', 1, 'v25-runtime',
       '["D1 database","role access","scheduled jobs","durable outbox","audit trail","health checks"]',
       'The internal backend, operator controls and fail-closed production access boundary are integration-ready. Real-data activation remains separately gated.',
       'demo', 'synthetic', 'healthy', ?, NULL, ?)`).bind(now, now),
    db.prepare(`INSERT OR IGNORE INTO integration_provider_configs
      (key, capability, provider, mode, status, required_for_pilot, configuration_version, capabilities,
       detail, environment, integrity_state, last_health_state, last_health_checked_at, last_event_at, updated_at)
      VALUES ('INT-DEMO-IDENTITY', 'identity', 'iiDENTIFii', 'disabled', 'not_connected', 1, 'adapter-v1',
       '["hosted verification","document OCR","face match","liveness","webhook projection"]',
       'The canonical identity workflow and adapter contract are ready; production iiDENTIFii credentials and callback mapping are not connected.',
       'demo', 'synthetic', 'not_configured', ?, NULL, ?)`).bind(now, now),
    db.prepare(`INSERT OR IGNORE INTO integration_provider_configs
      (key, capability, provider, mode, status, required_for_pilot, configuration_version, capabilities,
       detail, environment, integrity_state, last_health_state, last_health_checked_at, last_event_at, updated_at)
      VALUES ('INT-DEMO-PAYMENTS', 'payments', 'Payment processor', 'disabled', 'not_connected', 1, 'adapter-v1',
       '["checkout","authorisation","clearing","reconciliation","refund webhooks"]',
       'The canonical payment workflow and adapter contract are ready; the production processor, credentials and signed webhooks are not connected.',
       'demo', 'synthetic', 'not_configured', ?, NULL, ?)`).bind(now, now),
    db.prepare(`INSERT OR IGNORE INTO integration_provider_configs
      (key, capability, provider, mode, status, required_for_pilot, configuration_version, capabilities,
       detail, environment, integrity_state, last_health_state, last_health_checked_at, last_event_at, updated_at)
      VALUES ('INT-DEMO-PAYROLL', 'payroll', 'LOKD payroll policy engine', 'internal', 'sandbox_ready', 1, 'v25-policy-engine',
       '["versioned policy","gross-to-net calculation","dual approval boundary","payslip artifact contract"]',
       'The deterministic policy engine and approval records are built. Live statutory values must be sourced and dual-approved before any production calculation.',
       'demo', 'synthetic', 'healthy', ?, NULL, ?)`).bind(now, now),
    db.prepare(`INSERT OR IGNORE INTO integration_provider_configs
      (key, capability, provider, mode, status, required_for_pilot, configuration_version, capabilities,
       detail, environment, integrity_state, last_health_state, last_health_checked_at, last_event_at, updated_at)
      VALUES ('INT-DEMO-MESSAGING', 'messaging', 'LOKD in-app notifications', 'internal', 'sandbox_ready', 1, 'v25-outbox-worker',
       '["durable outbox","idempotent dispatch","operator inbox","retry state"]',
       'The scheduled worker converts internal domain events into an auditable Operations inbox. External SMS, email or WhatsApp is optional rather than a launch dependency.',
       'demo', 'synthetic', 'healthy', ?, NULL, ?)`).bind(now, now),
    db.prepare(`INSERT OR IGNORE INTO integration_provider_configs
      (key, capability, provider, mode, status, required_for_pilot, configuration_version, capabilities,
       detail, environment, integrity_state, last_health_state, last_health_checked_at, last_event_at, updated_at)
      VALUES ('INT-DEMO-MAPS', 'maps', 'LOKD coordinate map', 'internal', 'sandbox_ready', 1, 'v25-coordinate-map',
       '["stored coordinates","site projection","presence signals","versioned travel evidence"]',
       'The Operations map runs from stored coordinates and versioned travel evidence, so a third-party mapping provider is not a pilot dependency.',
       'demo', 'synthetic', 'healthy', ?, NULL, ?)`).bind(now, now),
    db.prepare(`INSERT OR IGNORE INTO integration_provider_configs
      (key, capability, provider, mode, status, required_for_pilot, configuration_version, capabilities,
       detail, environment, integrity_state, last_health_state, last_health_checked_at, last_event_at, updated_at)
      VALUES ('INT-DEMO-EVIDENCE', 'evidence', 'Cloudflare R2 private evidence store', 'r2', 'sandbox_ready', 1, 'v25-r2',
       '["private object storage","SHA-256 content hash","retention class","authorised download"]',
       'The private object-store adapter and protected artifact route are built; runtime health verifies the R2 binding before activation.',
       'demo', 'synthetic', 'healthy', ?, NULL, ?)`).bind(now, now),
    db.prepare(`UPDATE integration_provider_configs SET
      provider = CASE capability
        WHEN 'backend' THEN 'LOKD internal backend'
        WHEN 'payroll' THEN 'LOKD payroll policy engine'
        WHEN 'messaging' THEN 'LOKD in-app notifications'
        WHEN 'maps' THEN 'LOKD coordinate map'
        ELSE 'Cloudflare R2 private evidence store' END,
      mode = CASE capability WHEN 'evidence' THEN 'r2' ELSE 'internal' END,
      status = CASE
        WHEN configuration_version IN ('contract-v1','unconfigured') OR mode IN ('disabled','schema_only')
          THEN 'sandbox_ready'
        ELSE status END,
      required_for_pilot = 1,
      configuration_version = CASE capability
        WHEN 'backend' THEN 'v25-runtime'
        WHEN 'payroll' THEN 'v25-policy-engine'
        WHEN 'messaging' THEN 'v25-outbox-worker'
        WHEN 'maps' THEN 'v25-coordinate-map'
        ELSE 'v25-r2' END,
      capabilities = CASE capability
        WHEN 'backend' THEN '["D1 database","role access","scheduled jobs","durable outbox","audit trail","health checks"]'
        WHEN 'payroll' THEN '["versioned policy","gross-to-net calculation","dual approval boundary","payslip artifact contract"]'
        WHEN 'messaging' THEN '["durable outbox","idempotent dispatch","operator inbox","retry state"]'
        WHEN 'maps' THEN '["stored coordinates","site projection","presence signals","versioned travel evidence"]'
        ELSE '["private object storage","SHA-256 content hash","retention class","authorised download"]' END,
      detail = CASE capability
        WHEN 'backend' THEN 'The internal backend, operator controls and fail-closed production access boundary are integration-ready. Real-data activation remains separately gated.'
        WHEN 'payroll' THEN 'The deterministic policy engine and approval records are built. Live statutory values must be sourced and dual-approved before any production calculation.'
        WHEN 'messaging' THEN 'The scheduled worker converts internal domain events into an auditable Operations inbox. External SMS, email or WhatsApp is optional rather than a launch dependency.'
        WHEN 'maps' THEN 'The Operations map runs from stored coordinates and versioned travel evidence, so a third-party mapping provider is not a pilot dependency.'
        ELSE 'The private object-store adapter and protected artifact route are built; runtime health verifies the R2 binding before activation.' END,
      last_health_state = CASE
        WHEN configuration_version IN ('contract-v1','unconfigured') OR mode IN ('disabled','schema_only')
          THEN 'healthy'
        ELSE last_health_state END,
      updated_at = ?
      WHERE environment = 'demo' AND integrity_state = 'synthetic'
        AND capability IN ('backend','payroll','messaging','maps','evidence')`).bind(now),
  ]);
}

export async function startDemoIdentityVerification(db: D1Database, applicationId: string, actorId: string) {
  await ensureIntegrationDemoData(db);
  const application = await db.prepare(`SELECT id, identity_verification_status AS identityStatus,
      identity_consent_version AS consentVersion, identity_consented_at AS consentedAt
    FROM officer_applications WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
    .bind(applicationId).first<{ id: string; identityStatus: string; consentVersion: string | null; consentedAt: string | null }>();
  if (!application) throw new PlatformWorkflowError("That synthetic application could not be found.", 404);
  if (!application.consentVersion || !application.consentedAt) {
    throw new PlatformWorkflowError("Applicant-controlled identity consent must be recorded before verification starts.", 409);
  }

  const existing = await db.prepare(`SELECT id, status FROM identity_verification_cases
    WHERE application_id = ? AND environment = 'demo' AND integrity_state = 'synthetic'
      AND status NOT IN ('cancelled', 'expired') ORDER BY created_at DESC LIMIT 1`)
    .bind(applicationId).first<{ id: string; status: string }>();
  if (existing) return existing;

  const now = new Date().toISOString();
  const caseId = id("IDV-DEMO");
  const operationId = id("IOP-DEMO");
  const idempotencyKey = `identity:${applicationId}:v1`;
  const requestHash = await sha256(`${applicationId}|sandbox|${application.consentVersion}|${application.consentedAt}`);
  await db.batch([
    db.prepare(`INSERT INTO identity_verification_cases
      (id, application_id, officer_id, provider_key, provider_reference, status, decision,
       consent_version, consented_at, checks, reason_codes, evidence_reference, environment,
       integrity_state, expires_at, created_at, updated_at, completed_at)
      VALUES (?, ?, NULL, 'INT-DEMO-IDENTITY', ?, 'processing', NULL, ?, ?,
        '["document","face_match","liveness"]', '[]', NULL, 'demo', 'synthetic', NULL, ?, ?, NULL)`)
      .bind(caseId, applicationId, `sandbox:${caseId}`, application.consentVersion, application.consentedAt, now, now),
    db.prepare(`INSERT INTO integration_operations
      (id, provider_key, capability, operation_type, entity_type, entity_id, idempotency_key,
       request_hash, provider_reference, state, attempts, environment, integrity_state, created_at, updated_at)
      VALUES (?, 'INT-DEMO-IDENTITY', 'identity', 'create_verification', 'officer_application', ?, ?, ?, ?,
        'awaiting_webhook', 1, 'demo', 'synthetic', ?, ?)`)
      .bind(operationId, applicationId, idempotencyKey, requestHash, `sandbox:${caseId}`, now, now),
    db.prepare(`INSERT INTO domain_outbox_events
      (id, aggregate_type, aggregate_id, event_type, payload_hash, payload_version, status, attempts,
       available_at, environment, integrity_state, created_at)
      VALUES (?, 'officer_application', ?, 'identity.verification.started', ?, 'v1', 'pending', 0,
        ?, 'demo', 'synthetic', ?)`)
      .bind(id("OUT-DEMO"), applicationId, requestHash, now, now),
    db.prepare(`UPDATE officer_applications SET identity_verification_status = 'checking',
      identity_provider = 'iidentifii_adapter_sandbox', identity_provider_reference = ?,
      status = 'verification_in_progress', updated_at = ?
      WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(caseId, now, applicationId),
    db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', ?, 'identity_verification_started', 'officer_application', ?,
       'DEMO ONLY: canonical identity case opened through the disabled iiDENTIFii adapter; no external provider call occurred.', ?)`)
      .bind(id("AUD"), actorId, applicationId, now),
  ]);
  return { id: caseId, status: "processing" };
}

export async function completeDemoIdentityVerification(db: D1Database, applicationId: string, actorId: string) {
  await ensureIntegrationDemoData(db);
  const identityCase = await db.prepare(`SELECT identity.id, identity.provider_reference AS providerReference,
      identity.status, operation.id AS operationId
    FROM identity_verification_cases identity
    LEFT JOIN integration_operations operation ON operation.entity_type = 'officer_application'
      AND operation.entity_id = identity.application_id AND operation.provider_key = identity.provider_key
      AND operation.environment = identity.environment
    WHERE identity.application_id = ? AND identity.environment = 'demo' AND identity.integrity_state = 'synthetic'
      AND identity.status IN ('processing', 'manual_review', 'verified')
    ORDER BY identity.created_at DESC, operation.created_at DESC LIMIT 1`)
    .bind(applicationId).first<{ id: string; providerReference: string | null; status: string; operationId: string | null }>();
  if (!identityCase) throw new PlatformWorkflowError("Start the synthetic identity workflow before completing it.", 409);
  if (identityCase.status === "verified") return { id: identityCase.id, status: "verified" };

  const now = new Date().toISOString();
  const eventIdValue = `sandbox.identity.verified:${identityCase.id}`;
  const rawHash = await sha256(`${eventIdValue}|verified`);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO provider_webhook_inbox
      (id, provider_key, provider_event_id, event_type, raw_body_hash, signature_state, processing_state,
       attempts, operation_id, environment, integrity_state, received_at, processed_at)
      VALUES (?, 'INT-DEMO-IDENTITY', ?, 'identity.verified', ?, 'sandbox_verified', 'processed', 1, ?,
        'demo', 'synthetic', ?, ?)`)
      .bind(id("WH-DEMO"), eventIdValue, rawHash, identityCase.operationId, now, now),
    db.prepare(`UPDATE identity_verification_cases SET status = 'verified', decision = 'sandbox_verified',
      checks = '["document_demo_pass","face_match_demo_pass","liveness_demo_pass"]', reason_codes = '[]',
      evidence_reference = ?, updated_at = ?, completed_at = ?
      WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(`demo-evidence:${identityCase.id}`, now, now, identityCase.id),
    db.prepare(`UPDATE integration_operations SET state = 'succeeded', attempts = CASE WHEN attempts < 1 THEN 1 ELSE attempts END,
      updated_at = ?, completed_at = ? WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, now, identityCase.operationId ?? ""),
    db.prepare(`UPDATE officer_applications SET identity_verification_status = 'demo_verified',
      identity_provider = 'iidentifii_adapter_sandbox', identity_provider_reference = ?, identity_verified_at = ?,
      status = 'credentials_review', updated_at = ?
      WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(identityCase.providerReference ?? identityCase.id, now, now, applicationId),
    db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', ?, 'identity_webhook_projected', 'officer_application', ?,
       'DEMO ONLY: a replay-safe sandbox webhook was projected into the canonical identity case. Production verification remains required.', ?)`)
      .bind(id("AUD"), actorId, applicationId, now),
  ]);
  return { id: identityCase.id, status: "verified" };
}

export async function demoPaymentOrderStatements(
  db: D1Database,
  input: { bookingId: string; clientId: string; amountCents: number; createdAt?: string },
) {
  const now = input.createdAt ?? new Date().toISOString();
  const paymentId = `PAYORD-${input.bookingId}`;
  const operationId = `IOP-PAY-${input.bookingId}`;
  const idempotencyKey = `payment:${input.bookingId}:v1`;
  const requestHash = await sha256(`${input.bookingId}|${input.clientId}|${input.amountCents}|ZAR`);
  return [
    db.prepare(`INSERT OR IGNORE INTO payment_orders
      (id, booking_id, client_id, provider_key, provider_reference, currency, amount_cents, status,
       idempotency_key, environment, integrity_state, created_at, updated_at)
      SELECT ?, booking.id, booking.client_id, 'INT-DEMO-PAYMENTS', ?, 'ZAR', ?, 'requires_action', ?,
       'demo', 'synthetic', ?, ? FROM bookings booking
      WHERE booking.id = ? AND booking.client_id = ? AND booking.environment = 'demo'
        AND booking.integrity_state = 'synthetic'`)
      .bind(paymentId, `sandbox:${paymentId}`, input.amountCents, idempotencyKey, now, now, input.bookingId, input.clientId),
    db.prepare(`INSERT OR IGNORE INTO integration_operations
      (id, provider_key, capability, operation_type, entity_type, entity_id, idempotency_key,
       request_hash, provider_reference, state, attempts, environment, integrity_state, created_at, updated_at)
      VALUES (?, 'INT-DEMO-PAYMENTS', 'payments', 'create_checkout', 'booking', ?, ?, ?, ?,
       'awaiting_webhook', 1, 'demo', 'synthetic', ?, ?)`)
      .bind(operationId, input.bookingId, idempotencyKey, requestHash, `sandbox:${paymentId}`, now, now),
    db.prepare(`INSERT OR IGNORE INTO domain_outbox_events
      (id, aggregate_type, aggregate_id, event_type, payload_hash, payload_version, status, attempts,
       available_at, environment, integrity_state, created_at)
      VALUES (?, 'booking', ?, 'payment.order.created', ?, 'v1', 'pending', 0, ?, 'demo', 'synthetic', ?)`)
      .bind(`OUT-PAY-${input.bookingId}`, input.bookingId, requestHash, now, now),
  ];
}

export async function createDemoPaymentOrder(
  db: D1Database,
  input: { bookingId: string; clientId: string; amountCents: number; createdAt?: string },
) {
  const paymentId = `PAYORD-${input.bookingId}`;
  await ensureIntegrationDemoData(db);
  const expectedHash = await sha256(`${input.bookingId}|${input.clientId}|${input.amountCents}|ZAR`);
  const existing = await db.prepare(`SELECT request_hash AS requestHash FROM integration_operations
    WHERE provider_key = 'INT-DEMO-PAYMENTS' AND environment = 'demo'
      AND idempotency_key = ? LIMIT 1`).bind(`payment:${input.bookingId}:v1`)
    .first<{ requestHash: string }>();
  if (existing && existing.requestHash !== expectedHash) {
    throw new PlatformWorkflowError("That payment command was already created with different terms.", 409);
  }
  if (!existing) await db.batch(await demoPaymentOrderStatements(db, input));
  return paymentId;
}

export async function reconcileDemoPayment(db: D1Database, bookingId: string, clientId: string, actorId: string) {
  await ensureIntegrationDemoData(db);
  const order = await db.prepare(`SELECT payment.id, payment.amount_cents AS amountCents,
      payment.status, payment.provider_reference AS providerReference, operation.id AS operationId,
      booking.status AS bookingStatus, booking.funding_status AS fundingStatus,
      (SELECT MAX(slot.ends_at) FROM roster_slots slot WHERE slot.booking_id = booking.id
        AND slot.environment = booking.environment AND slot.integrity_state = booking.integrity_state) AS bookingValidThrough
    FROM payment_orders payment
    JOIN bookings booking ON booking.id = payment.booking_id
    LEFT JOIN integration_operations operation ON operation.entity_type = 'booking'
      AND operation.entity_id = payment.booking_id AND operation.provider_key = payment.provider_key
      AND operation.environment = payment.environment
    WHERE payment.booking_id = ? AND payment.client_id = ? AND payment.environment = 'demo'
      AND payment.integrity_state = 'synthetic' AND booking.environment = 'demo'
      AND booking.integrity_state = 'synthetic'
    ORDER BY payment.created_at DESC, operation.created_at DESC LIMIT 1`)
    .bind(bookingId, clientId).first<{
      id: string; amountCents: number; status: string; providerReference: string | null; operationId: string | null;
      bookingStatus: string; fundingStatus: string; bookingValidThrough: string | null;
    }>();
  if (!order) throw new PlatformWorkflowError("This synthetic booking has no canonical payment order.", 409);
  if (order.status === "reconciled") {
    const projected = await db.prepare(`SELECT id FROM booking_funding_reconciliations
      WHERE booking_id = ? AND status = 'cleared_reconciled' AND active_key = ?
       AND environment = 'demo' AND integrity_state = 'synthetic'`).bind(bookingId, bookingId).first();
    if (!projected || order.fundingStatus !== "paid_in_full") {
      throw new PlatformWorkflowError("The payment projection is inconsistent and requires Operations review.", 409);
    }
    const invoiceProjection = await db.prepare(`SELECT invoice.id, invoice.funding_status AS fundingStatus,
      COALESCE((SELECT SUM(allocation.amount_cents) FROM invoice_receipt_allocations allocation
        WHERE allocation.invoice_id = invoice.id AND allocation.status = 'allocated'
          AND allocation.environment = invoice.environment
          AND allocation.integrity_state = invoice.integrity_state), 0) AS allocatedCents
      FROM client_invoices invoice WHERE invoice.booking_id = ?
        AND invoice.environment = 'demo' AND invoice.integrity_state = 'synthetic'
      ORDER BY invoice.created_at LIMIT 1`).bind(bookingId).first<{
        id: string; fundingStatus: string; allocatedCents: number;
      }>();
    if (invoiceProjection && (invoiceProjection.fundingStatus !== "fully_allocated_sandbox"
      || Number(invoiceProjection.allocatedCents) !== order.amountCents)) {
      throw new PlatformWorkflowError("The billing allocation is inconsistent and requires Operations review.", 409);
    }
    return order;
  }
  if (order.bookingStatus !== "awaiting_payment" || order.fundingStatus !== "awaiting_payment") {
    throw new PlatformWorkflowError("Approve the site and risk plan before recording payment.", 409);
  }
  if (!new Set(["created", "requires_action", "pending", "authorised", "captured", "cleared"]).has(order.status)) {
    throw new PlatformWorkflowError("This synthetic payment cannot be reconciled from its current state.", 409);
  }

  const now = new Date().toISOString();
  const eventIdValue = `sandbox.payment.reconciled:${order.id}`;
  const rawHash = await sha256(`${eventIdValue}|${order.amountCents}|ZAR`);
  const reconciliationId = `FUND-${bookingId}`;
  const providerReference = order.providerReference ?? `sandbox:${order.id}`;
  if (!order.bookingValidThrough) {
    throw new PlatformWorkflowError("This booking has no dated roster validity boundary.", 409);
  }
  const evidenceExpiresAt = order.bookingValidThrough;
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO provider_webhook_inbox
      (id, provider_key, provider_event_id, event_type, raw_body_hash, signature_state, processing_state,
       attempts, operation_id, environment, integrity_state, received_at, processed_at)
      VALUES (?, 'INT-DEMO-PAYMENTS', ?, 'payment.reconciled', ?, 'sandbox_verified', 'processed', 1, ?,
       'demo', 'synthetic', ?, ?)`)
      .bind(id("WH-DEMO"), eventIdValue, rawHash, order.operationId, now, now),
    db.prepare(`UPDATE payment_orders SET status = 'pending', updated_at = ?
      WHERE id = ? AND status IN ('created','requires_action') AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, order.id),
    db.prepare(`UPDATE payment_orders SET status = 'authorised', authorised_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending' AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, now, order.id),
    db.prepare(`UPDATE payment_orders SET status = 'captured', updated_at = ?
      WHERE id = ? AND status = 'authorised' AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, order.id),
    db.prepare(`UPDATE payment_orders SET status = 'cleared', cleared_at = ?, updated_at = ?
      WHERE id = ? AND status = 'captured' AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, now, order.id),
    db.prepare(`UPDATE payment_orders SET status = 'reconciled', reconciled_at = ?, updated_at = ?
      WHERE id = ? AND status = 'cleared' AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, now, order.id),
    db.prepare(`UPDATE integration_operations SET state = 'succeeded', updated_at = ?, completed_at = ?
      WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, now, order.operationId ?? ""),
    db.prepare(`INSERT OR IGNORE INTO booking_funding_reconciliations
      (id, booking_id, environment, integrity_state, provider, provider_reference, currency,
       expected_amount_cents, cleared_amount_cents, status, cleared_at, reconciled_at,
       evidence_reference, evidence_verified_at, evidence_expires_at, version, active_key, created_at)
      SELECT ?, booking.id, 'demo', 'synthetic', 'sandbox_payment_adapter', ?, 'ZAR',
       booking.client_price_cents, ?, 'cleared_reconciled', ?, ?, ?, ?, ?, 1, ?, ?
      FROM bookings booking JOIN payment_orders payment ON payment.id = ?
        AND payment.booking_id = booking.id AND payment.client_id = booking.client_id
        AND payment.status = 'reconciled' AND payment.amount_cents = booking.client_price_cents
        AND payment.environment = booking.environment AND payment.integrity_state = booking.integrity_state
      WHERE booking.id = ? AND booking.client_id = ?
       AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
      .bind(reconciliationId, providerReference, order.amountCents, now, now,
        `demo-evidence:${order.id}`, now, evidenceExpiresAt, bookingId, now, order.id, bookingId, clientId),
    db.prepare(`INSERT OR IGNORE INTO invoice_receipt_allocations
      (id, invoice_id, payment_order_id, funding_reconciliation_id, reverses_allocation_id,
       amount_cents, currency, status, environment, integrity_state, allocated_at, reversed_at)
      SELECT 'IRA-' || invoice.id, invoice.id, payment.id, funding.id, NULL,
       payment.amount_cents, payment.currency, 'allocated', 'demo', 'synthetic', ?, NULL
      FROM client_invoices invoice
      JOIN payment_orders payment ON payment.id = ? AND payment.booking_id = invoice.booking_id
        AND payment.client_id = invoice.client_id AND payment.status = 'reconciled'
        AND payment.environment = invoice.environment AND payment.integrity_state = invoice.integrity_state
      JOIN booking_funding_reconciliations funding ON funding.id = ?
        AND funding.booking_id = invoice.booking_id AND funding.status = 'cleared_reconciled'
        AND funding.environment = invoice.environment AND funding.integrity_state = invoice.integrity_state
      WHERE invoice.booking_id = ? AND invoice.client_id = ? AND invoice.document_type = 'invoice'
        AND invoice.original_invoice_id IS NULL AND invoice.subtotal_cents = payment.amount_cents
        AND invoice.environment = 'demo' AND invoice.integrity_state = 'synthetic'`)
      .bind(now, order.id, reconciliationId, bookingId, clientId),
    db.prepare(`UPDATE client_invoices SET funding_status = 'fully_allocated_sandbox',
      payment_reference = ?, balance_cents = 0, updated_at = ?, version = version + 1
      WHERE booking_id = ? AND client_id = ? AND document_type = 'invoice'
        AND original_invoice_id IS NULL AND environment = 'demo' AND integrity_state = 'synthetic'
        AND funding_status = 'not_started'
        AND subtotal_cents = (SELECT COALESCE(SUM(allocation.amount_cents), 0)
          FROM invoice_receipt_allocations allocation WHERE allocation.invoice_id = client_invoices.id
            AND allocation.status = 'allocated' AND allocation.environment = client_invoices.environment
            AND allocation.integrity_state = client_invoices.integrity_state)`)
      .bind(providerReference, now, bookingId, clientId),
    db.prepare(`UPDATE bookings SET funding_status = 'paid_in_full', status = 'matching'
      WHERE id = ? AND client_id = ? AND funding_status = 'awaiting_payment'
       AND environment = 'demo' AND integrity_state = 'synthetic'
       AND EXISTS (SELECT 1 FROM booking_funding_reconciliations funding
        WHERE funding.id = ? AND funding.booking_id = bookings.id
          AND funding.status = 'cleared_reconciled' AND funding.active_key = bookings.id
          AND funding.expected_amount_cents = bookings.client_price_cents
          AND funding.cleared_amount_cents = bookings.client_price_cents
          AND funding.environment = bookings.environment
          AND funding.integrity_state = bookings.integrity_state)`)
      .bind(bookingId, clientId, reconciliationId),
    db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, 'operations', ?, 'payment_webhook_projected', 'booking', ?,
       CASE WHEN EXISTS (SELECT 1 FROM payment_orders payment WHERE payment.id = ?
          AND payment.booking_id = ? AND payment.status = 'reconciled'
          AND payment.environment = 'demo' AND payment.integrity_state = 'synthetic')
        AND EXISTS (SELECT 1 FROM booking_funding_reconciliations funding WHERE funding.id = ?
          AND funding.booking_id = ? AND funding.status = 'cleared_reconciled'
          AND funding.active_key = ? AND funding.environment = 'demo' AND funding.integrity_state = 'synthetic')
        AND EXISTS (SELECT 1 FROM bookings booking WHERE booking.id = ?
          AND booking.funding_status = 'paid_in_full' AND booking.status = 'matching'
          AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic')
       THEN 'DEMO ONLY: a replay-safe sandbox payment event created canonical cleared and reconciled funding evidence. No money moved.'
       ELSE NULL END, ?)`)
      .bind(id("AUD"), actorId, bookingId, order.id, bookingId, reconciliationId,
        bookingId, bookingId, bookingId, now),
  ]);
  return { ...order, status: "reconciled" };
}

export async function createServiceRequest(
  db: D1Database,
  input: {
    requestedByRole: "client" | "officer" | "operations";
    requestedById: string;
    category: string;
    summary: string;
    detail: string;
    priority?: "normal" | "high" | "urgent";
    clientId?: string | null;
    officerId?: string | null;
    bookingId?: string | null;
    shiftId?: string | null;
  },
) {
  const summary = input.summary.trim().replace(/\s+/g, " ");
  const detail = input.detail.trim().replace(/\s+/g, " ");
  if (summary.length < 3 || summary.length > 120) throw new PlatformWorkflowError("Enter a short request summary.");
  if (detail.length < 3 || detail.length > 1200) throw new PlatformWorkflowError("Enter request details.");
  await ensureIntegrationDemoData(db);
  const requestId = id("SR-DEMO");
  const now = new Date().toISOString();
  const payloadHash = await sha256(`${requestId}|${input.category}|${summary}|${detail}`);
  await db.batch([
    db.prepare(`INSERT INTO service_requests
      (id, client_id, officer_id, booking_id, shift_id, requested_by_role, requested_by_id,
       category, summary, detail, priority, status, owner_id, environment, integrity_state,
       created_at, updated_at, resolved_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, 'demo', 'synthetic', ?, ?, NULL, 1)`)
      .bind(requestId, input.clientId ?? null, input.officerId ?? null, input.bookingId ?? null,
        input.shiftId ?? null, input.requestedByRole, input.requestedById, input.category, summary,
        detail, input.priority ?? "normal", now, now),
    db.prepare(`INSERT INTO domain_outbox_events
      (id, aggregate_type, aggregate_id, event_type, payload_hash, payload_version, status, attempts,
       available_at, environment, integrity_state, created_at)
      VALUES (?, 'service_request', ?, 'service.request.opened', ?, 'v1', 'pending', 0,
       ?, 'demo', 'synthetic', ?)`)
      .bind(id("OUT-DEMO"), requestId, payloadHash, now, now),
    db.prepare(`INSERT INTO audit_events
      (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
      VALUES (?, ?, ?, 'service_request_opened', 'service_request', ?, ?, ?)`)
      .bind(id("AUD"), input.requestedByRole, input.requestedById, requestId,
        `${input.category}: ${summary}`, now),
  ]);
  return requestId;
}

async function readIntegrations(db: D1Database): Promise<PlatformIntegration[]> {
  const result = await db.prepare(`SELECT key, capability, provider, mode, status,
    required_for_pilot AS requiredForPilot, configuration_version AS configurationVersion,
    capabilities, detail, last_health_state AS lastHealthState,
    last_health_checked_at AS lastHealthCheckedAt, last_event_at AS lastEventAt
    FROM integration_provider_configs WHERE environment = 'demo' AND integrity_state = 'synthetic'
    ORDER BY CASE capability WHEN 'backend' THEN 1 WHEN 'identity' THEN 2 WHEN 'payments' THEN 3
      WHEN 'payroll' THEN 4 WHEN 'messaging' THEN 5 WHEN 'maps' THEN 6 ELSE 7 END`).all<{
      key: string; capability: string; provider: string; mode: string; status: PlatformIntegration["status"];
      requiredForPilot: number; configurationVersion: string; capabilities: string; detail: string;
      lastHealthState: string; lastHealthCheckedAt: string | null; lastEventAt: string | null;
    }>();
  return (result.results ?? []).map(({ requiredForPilot, capabilities, ...row }) => ({
    ...row,
    requiredForPilot: Boolean(requiredForPilot),
    capabilities: parseStringArray(capabilities),
  }));
}

function workflowSections(integrations: PlatformIntegration[]): PlatformWorkflowSection[] {
  const status = (capability: string) => integrations.find((item) => item.capability === capability)?.status;
  return [
    { key: "client", label: "Client to roster", state: "connected", detail: "Request, quote, site, risk, post orders, invoice funding and the full dated roster share one guarded booking chain.", remaining: "Activate authenticated production tenants after the controlled-pilot gates pass." },
    { key: "officer", label: "Officer onboarding", state: status("identity") === "healthy" ? "connected" : "adapter_ready", detail: "Applications, applicant consent, identity cases, training routing and restricted Network profiles are persisted.", remaining: "Connect iiDENTIFii and activate authenticated production intake." },
    { key: "funding", label: "Funding and allocation", state: status("payments") === "healthy" ? "connected" : "adapter_ready", detail: "Payment commands, webhook projection, cleared funding evidence and invoice allocation are replay-safe in the demo backend.", remaining: "Connect the selected processor and its signed production webhooks." },
    { key: "activation", label: "Assignment readiness", state: "connected", detail: "Offer acceptance materialises every dated slot with frozen economics, employer routing and workforce snapshots.", remaining: "Replace synthetic identity and funding evidence with signed provider evidence." },
    { key: "delivery", label: "Shift to finance handoff", state: "connected", detail: "Arrival, check-in, incidents, relief, completion, client evidence, timesheet approval, policy calculation and billing handoff are operator controlled.", remaining: "Load a sourced, dual-approved live payroll policy before paid processing." },
    { key: "production", label: "Software integration readiness", state: status("backend") === "sandbox_ready" ? "connected" : "blocked", detail: "D1, role controls, scheduled jobs, outbox dispatch, in-app notifications, evidence storage, health checks and the policy engine are built into the runtime.", remaining: "Connect iiDENTIFii and the selected payment processor; regulated launch approval remains a separate business gate." },
  ];
}

export async function readPlatformState(db: D1Database): Promise<PlatformState> {
  await ensureIntegrationDemoData(db);
  const integrations = await readIntegrations(db);
  const [identity, payments, requests, timesheetRows, invoiceRows, outbox, webhook, controlRows, jobRows, notificationRows] = await Promise.all([
    db.prepare(`SELECT identity.id, identity.application_id AS applicationId, identity.officer_id AS officerId,
      application.full_name AS applicantName, config.provider, identity.provider_reference AS providerReference,
      identity.status, identity.decision, identity.checks, identity.reason_codes AS reasonCodes,
      identity.created_at AS createdAt, identity.updated_at AS updatedAt
      FROM identity_verification_cases identity
      JOIN integration_provider_configs config ON config.key = identity.provider_key
      LEFT JOIN officer_applications application ON application.id = identity.application_id
      WHERE identity.environment = 'demo' AND identity.integrity_state = 'synthetic'
      ORDER BY identity.updated_at DESC LIMIT 50`).all<{
        id: string; applicationId: string | null; officerId: string | null; applicantName: string | null;
        provider: string; providerReference: string | null; status: string; decision: string | null;
        checks: string; reasonCodes: string; createdAt: string; updatedAt: string;
      }>(),
    db.prepare(`SELECT payment.id, payment.booking_id AS bookingId, client.organisation_name AS clientName,
      config.provider, payment.provider_reference AS providerReference, payment.currency,
      payment.amount_cents AS amountCents, payment.status, payment.created_at AS createdAt,
      payment.updated_at AS updatedAt FROM payment_orders payment
      JOIN clients client ON client.id = payment.client_id
      JOIN integration_provider_configs config ON config.key = payment.provider_key
      WHERE payment.environment = 'demo' AND payment.integrity_state = 'synthetic'
      ORDER BY payment.updated_at DESC LIMIT 50`).all<PlatformPaymentOrder>(),
    db.prepare(`SELECT id, requested_by_role AS requestedByRole, requested_by_id AS requestedById,
      client_id AS clientId, officer_id AS officerId, booking_id AS bookingId, shift_id AS shiftId,
      category, summary, detail, priority, status, owner_id AS ownerId, version,
      created_at AS createdAt, updated_at AS updatedAt FROM service_requests
      WHERE environment = 'demo' AND integrity_state = 'synthetic'
      ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'triaged' THEN 2 ELSE 3 END, updated_at DESC LIMIT 100`)
      .all<PlatformServiceRequest>(),
    db.prepare(`SELECT timesheet.id, timesheet.shift_id AS shiftId, timesheet.booking_id AS bookingId,
      COALESCE(site.name, booking.site_name) AS siteName, officer.full_name AS officerName,
      timesheet.service_date AS serviceDate, timesheet.scheduled_minutes AS scheduledMinutes,
      timesheet.recorded_minutes AS recordedMinutes, timesheet.payable_minutes AS payableMinutes,
      timesheet.gross_wage_cents AS grossWageCents, timesheet.calendar_category AS calendarCategory,
      timesheet.client_evidence_status AS clientEvidenceStatus,
      timesheet.operations_status AS operationsStatus, timesheet.workforce_model AS workforceModel,
      employer.legal_name AS employerName,
      (SELECT item.payroll_run_id FROM pay_item_sources source
        JOIN payroll_items item ON item.id = source.payroll_item_id
        WHERE source.timesheet_id = timesheet.id AND source.active_key = timesheet.id
          AND source.environment = timesheet.environment AND source.integrity_state = timesheet.integrity_state
        LIMIT 1) AS payrollRunId,
      COALESCE((SELECT run.status FROM pay_item_sources source
        JOIN payroll_items item ON item.id = source.payroll_item_id
        JOIN payroll_runs run ON run.id = item.payroll_run_id
        WHERE source.timesheet_id = timesheet.id AND source.active_key = timesheet.id
          AND source.environment = timesheet.environment AND source.integrity_state = timesheet.integrity_state
        LIMIT 1), (SELECT payable.status FROM partner_payables payable
          WHERE payable.timesheet_id = timesheet.id AND payable.environment = timesheet.environment
            AND payable.integrity_state = timesheet.integrity_state LIMIT 1)) AS backendHandoffStatus,
      (SELECT item.employee_deduction_cents FROM pay_item_sources source
        JOIN payroll_items item ON item.id = source.payroll_item_id
        WHERE source.timesheet_id = timesheet.id AND source.active_key = timesheet.id
          AND source.environment = timesheet.environment AND source.integrity_state = timesheet.integrity_state
        LIMIT 1) AS employeeDeductionCents,
      (SELECT item.net_pay_cents FROM pay_item_sources source
        JOIN payroll_items item ON item.id = source.payroll_item_id
        WHERE source.timesheet_id = timesheet.id AND source.active_key = timesheet.id
          AND source.environment = timesheet.environment AND source.integrity_state = timesheet.integrity_state
        LIMIT 1) AS netPayCents,
      (SELECT item.policy_version FROM pay_item_sources source
        JOIN payroll_items item ON item.id = source.payroll_item_id
        WHERE source.timesheet_id = timesheet.id AND source.active_key = timesheet.id
          AND source.environment = timesheet.environment AND source.integrity_state = timesheet.integrity_state
        LIMIT 1) AS policyVersion,
      (SELECT run.calculation_version FROM pay_item_sources source
        JOIN payroll_items item ON item.id = source.payroll_item_id
        JOIN payroll_runs run ON run.id = item.payroll_run_id
        WHERE source.timesheet_id = timesheet.id AND source.active_key = timesheet.id
          AND source.environment = timesheet.environment AND source.integrity_state = timesheet.integrity_state
        LIMIT 1) AS calculationVersion,
      timesheet.submitted_at AS submittedAt, timesheet.approved_by AS approvedBy,
      timesheet.approved_at AS approvedAt, timesheet.version
      FROM shift_timesheets timesheet
      JOIN bookings booking ON booking.id = timesheet.booking_id
      JOIN officers officer ON officer.id = timesheet.officer_id
      LEFT JOIN operational_sites site ON site.booking_id = timesheet.booking_id
        AND site.environment = timesheet.environment AND site.integrity_state = timesheet.integrity_state
      LEFT JOIN workforce_employers employer ON employer.id = timesheet.employer_id
        AND employer.environment = timesheet.environment
      WHERE timesheet.environment = 'demo' AND timesheet.integrity_state = 'synthetic'
        AND timesheet.active_key = timesheet.shift_id
      ORDER BY CASE timesheet.operations_status WHEN 'awaiting_review' THEN 1 ELSE 2 END,
        timesheet.service_date DESC LIMIT 100`).all<PlatformTimesheet>(),
    db.prepare(`SELECT invoice.id, invoice.booking_id AS bookingId,
      client.organisation_name AS clientName, booking.site_name AS siteName,
      invoice.service_period_start AS servicePeriodStart, invoice.service_period_end AS servicePeriodEnd,
      invoice.currency, invoice.subtotal_cents AS subtotalCents, invoice.tax_cents AS taxCents,
      invoice.total_cents AS totalCents,
      COALESCE((SELECT SUM(allocation.amount_cents) FROM invoice_receipt_allocations allocation
        WHERE allocation.invoice_id = invoice.id AND allocation.status = 'allocated'
          AND allocation.environment = invoice.environment
          AND allocation.integrity_state = invoice.integrity_state), 0) AS allocatedCents,
      invoice.status, invoice.funding_status AS fundingStatus, invoice.tax_treatment AS taxTreatment,
      invoice.payment_reference AS paymentReference, invoice.issue_reference AS issueReference,
      invoice.version, invoice.created_at AS createdAt, invoice.updated_at AS updatedAt
      FROM client_invoices invoice
      JOIN bookings booking ON booking.id = invoice.booking_id
      JOIN clients client ON client.id = invoice.client_id
      WHERE invoice.environment = 'demo' AND invoice.integrity_state = 'synthetic'
        AND invoice.document_type = 'invoice' AND invoice.original_invoice_id IS NULL
      ORDER BY CASE invoice.status WHEN 'draft' THEN 1 WHEN 'ready_for_backend' THEN 2 ELSE 3 END,
        invoice.updated_at DESC LIMIT 100`).all<PlatformInvoice>(),
    db.prepare(`SELECT COUNT(*) AS total FROM domain_outbox_events
      WHERE environment = 'demo' AND integrity_state = 'synthetic' AND status = 'pending'`).first<{ total: number }>(),
    db.prepare(`SELECT COUNT(*) AS total FROM provider_webhook_inbox
      WHERE environment = 'demo' AND integrity_state = 'synthetic' AND processing_state <> 'processed'`).first<{ total: number }>(),
    db.prepare(`SELECT code, category, label, status,
      required_for_integration_ready AS requiredForIntegrationReady,
      evidence_reference AS evidenceReference, detail, checked_at AS checkedAt, checked_by AS checkedBy
      FROM platform_readiness_controls
      WHERE environment = 'demo' AND integrity_state = 'synthetic'
      ORDER BY category, label`).all<{
        code: string; category: string; label: string; status: "ready" | "blocked" | "pending";
        requiredForIntegrationReady: number; evidenceReference: string | null; detail: string;
        checkedAt: string; checkedBy: string;
      }>(),
    db.prepare(`SELECT id, job_key AS jobKey, "trigger", status, processed_count AS processedCount,
      failure_count AS failureCount, detail, started_at AS startedAt, completed_at AS completedAt
      FROM scheduled_job_runs WHERE environment = 'demo' AND integrity_state = 'synthetic'
      ORDER BY started_at DESC LIMIT 10`).all<PlatformState["jobRuns"][number]>(),
    db.prepare(`SELECT id, subject, message, status, created_at AS createdAt
      FROM operator_notifications WHERE environment = 'demo' AND integrity_state = 'synthetic'
      ORDER BY created_at DESC LIMIT 25`).all<PlatformState["notifications"][number]>(),
  ]);
  const identityCases: PlatformIdentityCase[] = (identity.results ?? []).map(({ checks, reasonCodes, ...row }) => ({
    ...row,
    checks: parseStringArray(checks),
    reasonCodes: parseStringArray(reasonCodes),
  }));
  const paymentOrders = payments.results ?? [];
  const serviceRequests = requests.results ?? [];
  const timesheets = timesheetRows.results ?? [];
  const invoices = invoiceRows.results ?? [];
  const readinessControls = (controlRows.results ?? []).map(({ requiredForIntegrationReady, ...control }) => ({
    ...control,
    requiredForIntegrationReady: Boolean(requiredForIntegrationReady),
  }));
  const jobRuns = jobRows.results ?? [];
  const notifications = notificationRows.results ?? [];
  const required = integrations.filter((item) => item.requiredForPilot);
  const external = integrations.filter((item) => item.capability === "identity" || item.capability === "payments");
  const requiredControls = readinessControls.filter((item) => item.requiredForIntegrationReady);
  return {
    environment: "demo",
    generatedAt: new Date().toISOString(),
    summary: {
      healthyIntegrations: required.filter((item) => item.status === "healthy" || item.status === "sandbox_ready").length,
      requiredIntegrations: required.length,
      openServiceRequests: serviceRequests.filter((item) => item.status !== "resolved").length,
      queuedOutboxEvents: outbox?.total ?? 0,
      pendingWebhooks: webhook?.total ?? 0,
      activeIdentityCases: identityCases.filter((item) => !new Set(["verified", "rejected", "expired", "cancelled"]).has(item.status)).length,
      unreconciledPayments: paymentOrders.filter((item) => item.status !== "reconciled").length,
      timesheetsAwaitingReview: timesheets.filter((item) => item.operationsStatus === "awaiting_review").length,
      invoicesAwaitingHandoff: invoices.filter((item) => item.fundingStatus === "fully_allocated_sandbox" && item.status === "draft").length,
      payrollHandoffs: timesheets.filter((item) => Boolean(item.backendHandoffStatus)).length,
      externalIntegrationsRemaining: external.filter((item) => item.status !== "healthy").length,
      readyControls: requiredControls.filter((item) => item.status === "ready").length,
      requiredControls: requiredControls.length,
      unreadOperatorNotifications: notifications.filter((item) => item.status === "unread").length,
    },
    sections: workflowSections(integrations),
    integrations,
    identityCases,
    paymentOrders,
    serviceRequests,
    timesheets,
    invoices,
    readinessControls,
    jobRuns,
    notifications,
  };
}

export async function applyPlatformAction(
  db: D1Database,
  action: PlatformAction,
  actorId: string,
  runtime: { evidenceStoreBound?: boolean } = {},
) {
  await ensureIntegrationDemoData(db);
  const now = new Date().toISOString();
  if (action.action === "refresh_integration_health" || action.action === "run_platform_maintenance") {
    await runPlatformMaintenance(db, {
      actorId,
      trigger: "operator",
      evidenceStoreBound: Boolean(runtime.evidenceStoreBound),
      environment: "demo",
      integrityState: "synthetic",
    });
    return;
  }

  if (action.action === "calculate_payroll_run") {
    const row = await db.prepare(`SELECT run.id, run.status, run.version,
      item.id AS itemId, item.gross_wage_cents AS grossWageCents,
      source.timesheet_id AS timesheetId, timesheet.booking_id AS bookingId,
      timesheet.service_date AS serviceDate
      FROM payroll_runs run
      JOIN payroll_items item ON item.payroll_run_id = run.id
      JOIN pay_item_sources source ON source.payroll_item_id = item.id AND source.active_key = source.timesheet_id
      JOIN shift_timesheets timesheet ON timesheet.id = source.timesheet_id
      WHERE run.id = ? AND run.environment = 'demo' AND run.integrity_state = 'synthetic'
      LIMIT 1`).bind(action.payrollRunId).first<{
        id: string; status: string; version: number; itemId: string; grossWageCents: number;
        timesheetId: string; bookingId: string; serviceDate: string;
      }>();
    if (!row) throw new PlatformWorkflowError("That synthetic payroll run could not be found.", 404);
    if (row.status === "calculated_for_review") return;
    if (!new Set(["awaiting_backend_calculation", "retryable_calculation_failed"]).has(row.status)) {
      throw new PlatformWorkflowError("That payroll run is not awaiting calculation.", 409);
    }
    const claim = await db.prepare(`UPDATE payroll_runs SET status = 'calculating', updated_at = ?
      WHERE id = ? AND version = ? AND status IN ('awaiting_backend_calculation','retryable_calculation_failed')
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(now, row.id, row.version).run();
    if (Number(claim.meta.changes ?? 0) !== 1) {
      const current = await db.prepare(`SELECT status FROM payroll_runs WHERE id = ?`).bind(row.id).first<{ status: string }>();
      if (current?.status === "calculated_for_review") return;
      throw new PlatformWorkflowError("That payroll run is already being calculated. Refresh before trying again.", 409);
    }
    try {
      const calculation = calculatePayrollItem(row.grossWageCents, row.serviceDate, SYNTHETIC_ENGINE_TEST_POLICY);
      const payloadHash = await sha256(`${row.id}|${row.version}|${calculation.policyVersion}|${calculation.netPayCents}`);
      await db.batch([
        db.prepare(`UPDATE payroll_items SET employee_deduction_cents = ?, net_pay_cents = ?,
        employer_cost_cents = ?, status = 'calculated_for_review', policy_version = ?, updated_at = ?
        WHERE id = ? AND status = 'awaiting_backend_calculation' AND environment = 'demo'
          AND integrity_state = 'synthetic'`)
          .bind(calculation.totalEmployeeDeductionsCents, calculation.netPayCents,
          calculation.employerCostCents, calculation.policyVersion, now, row.itemId),
        db.prepare(`UPDATE payroll_runs SET status = 'calculated_for_review',
        employee_deduction_cents = ?, net_pay_cents = ?, employer_cost_cents = ?,
        policy_version = ?, calculation_version = 'payroll-engine-v1', updated_at = ?, version = version + 1
        WHERE id = ? AND version = ? AND status = 'calculating'
          AND environment = 'demo' AND integrity_state = 'synthetic'`)
          .bind(calculation.totalEmployeeDeductionsCents, calculation.netPayCents,
          calculation.employerCostCents, calculation.policyVersion, now, row.id, row.version),
        db.prepare(`INSERT OR IGNORE INTO pay_item_lines
        (id, payroll_item_id, line_type, code, description, amount_cents, quantity_minutes,
         rate_cents, rate_basis_points, statutory_code, rule_version, environment, integrity_state, created_at)
        VALUES (?, ?, 'deduction', 'PAYE', 'Synthetic policy-engine PAYE', ?, NULL, NULL, NULL,
          'PAYE', ?, 'demo', 'synthetic', ?)`)
          .bind(`LINE-${row.itemId}-PAYE`, row.itemId, calculation.payeCents, calculation.policyVersion, now),
        db.prepare(`INSERT OR IGNORE INTO pay_item_lines
        (id, payroll_item_id, line_type, code, description, amount_cents, quantity_minutes,
         rate_cents, rate_basis_points, statutory_code, rule_version, environment, integrity_state, created_at)
        VALUES (?, ?, 'deduction', 'UIF-EMPLOYEE', 'Synthetic policy-engine employee UIF', ?, NULL, NULL, NULL,
          'UIF', ?, 'demo', 'synthetic', ?)`)
          .bind(`LINE-${row.itemId}-UIF-EMP`, row.itemId, calculation.employeeUifCents, calculation.policyVersion, now),
        db.prepare(`INSERT OR IGNORE INTO pay_item_lines
        (id, payroll_item_id, line_type, code, description, amount_cents, quantity_minutes,
         rate_cents, rate_basis_points, statutory_code, rule_version, environment, integrity_state, created_at)
        VALUES (?, ?, 'employer_cost', 'UIF-EMPLOYER', 'Synthetic policy-engine employer UIF', ?, NULL, NULL, NULL,
          'UIF', ?, 'demo', 'synthetic', ?)`)
          .bind(`LINE-${row.itemId}-UIF-ER`, row.itemId, calculation.employerUifCents, calculation.policyVersion, now),
        db.prepare(`INSERT OR IGNORE INTO pay_item_lines
        (id, payroll_item_id, line_type, code, description, amount_cents, quantity_minutes,
         rate_cents, rate_basis_points, statutory_code, rule_version, environment, integrity_state, created_at)
        VALUES (?, ?, 'employer_cost', 'SDL', 'Synthetic policy-engine skills levy', ?, NULL, NULL, NULL,
          'SDL', ?, 'demo', 'synthetic', ?)`)
          .bind(`LINE-${row.itemId}-SDL`, row.itemId, calculation.skillsDevelopmentLevyCents, calculation.policyVersion, now),
        db.prepare(`INSERT OR IGNORE INTO domain_outbox_events
        (id, aggregate_type, aggregate_id, event_type, payload_hash, payload_version, payload_json,
         idempotency_key, status, attempts, available_at, environment, integrity_state, created_at)
        VALUES (?, 'booking', ?, 'payroll.calculated_for_review', ?, 'v1', ?, ?, 'pending', 0, ?, 'demo', 'synthetic', ?)`)
          .bind(`OUT-${row.id}`, row.bookingId, payloadHash,
          JSON.stringify({ payrollRunId: row.id, timesheetId: row.timesheetId, policyVersion: calculation.policyVersion }),
          `payroll-calculation:${row.id}:${row.version}`, now, now),
        db.prepare(`INSERT INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        VALUES (?, 'operations', ?, 'synthetic_payroll_calculated', 'payroll_run', ?, ?, ?)`)
          .bind(id("AUD"), actorId, row.id,
          `DEMO ONLY: gross, deductions, net pay and employer cost were calculated under ${calculation.policyVersion}. No payslip or payment was issued.`, now),
      ]);
    } catch (cause) {
      await db.prepare(`UPDATE payroll_runs SET status = 'retryable_calculation_failed', updated_at = ?
        WHERE id = ? AND version = ? AND status = 'calculating'`)
        .bind(new Date().toISOString(), row.id, row.version).run();
      throw cause;
    }
    return;
  }

  if (action.action === "approve_timesheet") {
    const timesheet = await db.prepare(`SELECT id, shift_id AS shiftId, booking_id AS bookingId,
      officer_id AS officerId, workforce_engagement_id AS workforceEngagementId,
      employer_id AS employerId, workforce_model AS workforceModel, service_date AS serviceDate,
      recorded_minutes AS recordedMinutes, gross_wage_cents AS grossWageCents,
      client_evidence_status AS clientEvidenceStatus, operations_status AS operationsStatus, version
      FROM shift_timesheets WHERE id = ? AND active_key = shift_id
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(action.timesheetId).first<{
        id: string; shiftId: string; bookingId: string; officerId: string;
        workforceEngagementId: string | null; employerId: string | null; workforceModel: string | null;
        serviceDate: string; recordedMinutes: number; grossWageCents: number;
        clientEvidenceStatus: string; operationsStatus: string; version: number;
      }>();
    if (!timesheet) throw new PlatformWorkflowError("That synthetic timesheet could not be found.", 404);
    if (timesheet.version !== action.version) {
      throw new PlatformWorkflowError("This timesheet changed. Refresh before trying again.", 409);
    }
    if (timesheet.clientEvidenceStatus !== "confirmed") {
      throw new PlatformWorkflowError("Client service evidence must be confirmed before Operations approval.", 409);
    }
    if (timesheet.operationsStatus !== "awaiting_review") {
      throw new PlatformWorkflowError("This timesheet has already left the review queue.", 409);
    }
    if (!timesheet.workforceEngagementId || !timesheet.employerId || !timesheet.workforceModel) {
      throw new PlatformWorkflowError("The frozen employer and workforce route is incomplete.", 409);
    }

    const isPartner = timesheet.workforceModel === "partner";
    const runId = `PR-DEMO-${timesheet.id}`;
    const itemId = `PI-DEMO-${timesheet.id}`;
    const payloadHash = await sha256(`${timesheet.id}|${timesheet.version}|${timesheet.recordedMinutes}|${timesheet.grossWageCents}`);
    const statements = [
      db.prepare(`UPDATE shift_timesheets SET payable_minutes = recorded_minutes,
        operations_status = 'approved_for_backend', approved_by = ?, approved_at = ?, locked_at = ?,
        updated_at = ?, version = version + 1 WHERE id = ? AND version = ?
          AND client_evidence_status = 'confirmed' AND operations_status = 'awaiting_review'
          AND environment = 'demo' AND integrity_state = 'synthetic'`)
        .bind(actorId, now, now, now, timesheet.id, timesheet.version),
      ...(isPartner ? [
        db.prepare(`INSERT OR IGNORE INTO partner_payables
          (id, timesheet_id, employer_id, service_agreement_version, amount_cents, currency,
           status, remittance_reference, environment, integrity_state, created_at, updated_at)
          SELECT ?, timesheet.id, timesheet.employer_id, 'synthetic-handoff-v1', timesheet.gross_wage_cents,
           'ZAR', 'awaiting_backend_settlement', NULL, 'demo', 'synthetic', ?, ?
          FROM shift_timesheets timesheet WHERE timesheet.id = ? AND timesheet.version = ?
            AND timesheet.operations_status = 'approved_for_backend' AND timesheet.approved_by = ?
            AND timesheet.environment = 'demo' AND timesheet.integrity_state = 'synthetic'`)
          .bind(`PP-DEMO-${timesheet.id}`, now, now, timesheet.id, timesheet.version + 1, actorId),
      ] : [
        db.prepare(`INSERT OR IGNORE INTO payroll_runs
          (id, batch_key, employer_id, period_start, period_end, pay_date, run_type, currency, status,
           gross_cents, employee_deduction_cents, net_pay_cents, employer_cost_cents, item_count,
           policy_version, calculation_version, export_reference, payslip_bundle_reference,
           settlement_reference, environment, integrity_state, created_by, approved_by, second_approved_by,
           created_at, updated_at, approved_at, exported_at, settled_at, version)
          SELECT ?, ?, timesheet.employer_id, timesheet.service_date, timesheet.service_date,
           timesheet.service_date, 'synthetic_handoff', 'ZAR', 'awaiting_backend_calculation',
           timesheet.gross_wage_cents, NULL, NULL, NULL, 1, 'LOKD-DEMO-GROSS-HANDOFF-v1', NULL,
           NULL, NULL, NULL, 'demo', 'synthetic', ?, NULL, NULL, ?, ?, NULL, NULL, NULL, 1
          FROM shift_timesheets timesheet WHERE timesheet.id = ? AND timesheet.version = ?
            AND timesheet.operations_status = 'approved_for_backend' AND timesheet.approved_by = ?
            AND timesheet.environment = 'demo' AND timesheet.integrity_state = 'synthetic'`)
          .bind(runId, `demo:${timesheet.id}`, actorId, now, now, timesheet.id, timesheet.version + 1, actorId),
        db.prepare(`INSERT OR IGNORE INTO payroll_items
          (id, payroll_run_id, officer_id, payroll_profile_id, workforce_engagement_id, employer_id,
           workforce_model, gross_wage_cents, employee_deduction_cents, net_pay_cents,
           employer_cost_cents, status, policy_version, payslip_reference, settlement_reference,
           environment, integrity_state, created_at, updated_at)
          SELECT ?, run.id, timesheet.officer_id, NULL, timesheet.workforce_engagement_id,
           timesheet.employer_id, timesheet.workforce_model, timesheet.gross_wage_cents,
           NULL, NULL, NULL, 'awaiting_backend_calculation', 'LOKD-DEMO-GROSS-HANDOFF-v1',
           NULL, NULL, 'demo', 'synthetic', ?, ? FROM shift_timesheets timesheet
          JOIN payroll_runs run ON run.id = ? AND run.status = 'awaiting_backend_calculation'
          WHERE timesheet.id = ? AND timesheet.version = ?
            AND timesheet.operations_status = 'approved_for_backend' AND timesheet.approved_by = ?`)
          .bind(itemId, now, now, runId, timesheet.id, timesheet.version + 1, actorId),
        db.prepare(`INSERT OR IGNORE INTO pay_item_sources
          (id, payroll_item_id, timesheet_id, timesheet_version, payable_minutes,
           gross_wage_cents, active_key, environment, integrity_state, created_at)
          SELECT ?, item.id, timesheet.id, timesheet.version, timesheet.payable_minutes,
           timesheet.gross_wage_cents, timesheet.id, 'demo', 'synthetic', ?
          FROM shift_timesheets timesheet JOIN payroll_items item ON item.id = ?
          WHERE timesheet.id = ? AND timesheet.version = ?
            AND timesheet.operations_status = 'approved_for_backend' AND timesheet.approved_by = ?`)
          .bind(`PIS-DEMO-${timesheet.id}`, now, itemId, timesheet.id, timesheet.version + 1, actorId),
        db.prepare(`INSERT OR IGNORE INTO pay_item_lines
          (id, payroll_item_id, line_type, code, description, amount_cents, quantity_minutes,
           rate_cents, rate_basis_points, statutory_code, rule_version, environment, integrity_state, created_at)
          SELECT ?, item.id, 'earning', 'FROZEN_SHIFT_OFFER',
           'Synthetic gross shift value approved by Operations for production-backend calculation',
           item.gross_wage_cents, timesheet.payable_minutes, NULL, NULL, NULL,
           'LOKD-DEMO-GROSS-HANDOFF-v1', 'demo', 'synthetic', ?
          FROM payroll_items item JOIN shift_timesheets timesheet ON timesheet.id = ?
          WHERE item.id = ? AND timesheet.operations_status = 'approved_for_backend'
            AND timesheet.approved_by = ?`)
          .bind(`PIL-DEMO-${timesheet.id}`, now, timesheet.id, itemId, actorId),
      ]),
      db.prepare(`INSERT OR IGNORE INTO domain_outbox_events
        (id, aggregate_type, aggregate_id, event_type, payload_hash, payload_version, status, attempts,
         available_at, environment, integrity_state, created_at, payload_json, correlation_key, idempotency_key)
        SELECT ?, 'booking', booking.id, 'timesheet.approved_for_backend', ?, 'v1', 'pending', 0,
         ?, 'demo', 'synthetic', ?, ?, ?, ? FROM bookings booking
        JOIN shift_timesheets timesheet ON timesheet.booking_id = booking.id
        WHERE timesheet.id = ? AND timesheet.version = ? AND timesheet.operations_status = 'approved_for_backend'
          AND timesheet.approved_by = ? AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'`)
        .bind(`OUT-TS-${timesheet.id}`, payloadHash, now, now,
          JSON.stringify({ timesheetId: timesheet.id, route: isPartner ? "partner_payable" : "payroll_calculation" }),
          timesheet.id, `approve:${timesheet.id}:v${timesheet.version}`, timesheet.id, timesheet.version + 1, actorId),
      db.prepare(`INSERT OR IGNORE INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        SELECT ?, 'operations', ?, 'timesheet_approved_for_backend', 'timesheet', timesheet.id,
         ?, ? FROM shift_timesheets timesheet WHERE timesheet.id = ? AND timesheet.version = ?
          AND timesheet.operations_status = 'approved_for_backend' AND timesheet.approved_by = ?`)
        .bind(`AUD-TS-${timesheet.id}`, actorId,
          isPartner
            ? "DEMO ONLY: service evidence and frozen value were approved into the partner-payable backend handoff. No remittance or money movement occurred."
            : "DEMO ONLY: service evidence and the frozen gross value were approved for production-backend calculation. Deductions, net pay, payslip and settlement remain unset.",
          now, timesheet.id, timesheet.version + 1, actorId),
    ];
    const results = await db.batch(statements);
    if (!results[0]?.meta?.changes) {
      throw new PlatformWorkflowError("This timesheet changed. Refresh before trying again.", 409);
    }
    return;
  }

  if (action.action === "review_invoice") {
    const invoice = await db.prepare(`SELECT id, booking_id AS bookingId, status,
      funding_status AS fundingStatus, tax_treatment AS taxTreatment, version
      FROM client_invoices WHERE id = ? AND document_type = 'invoice' AND original_invoice_id IS NULL
        AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(action.invoiceId).first<{
        id: string; bookingId: string; status: string; fundingStatus: string; taxTreatment: string; version: number;
      }>();
    if (!invoice) throw new PlatformWorkflowError("That synthetic billing record could not be found.", 404);
    if (invoice.version !== action.version) {
      throw new PlatformWorkflowError("This billing record changed. Refresh before trying again.", 409);
    }
    if (invoice.fundingStatus !== "fully_allocated_sandbox") {
      throw new PlatformWorkflowError("Reconciled funding must be allocated before billing review.", 409);
    }
    if (invoice.status !== "draft") {
      throw new PlatformWorkflowError("This billing record has already left the review queue.", 409);
    }
    const payloadHash = await sha256(`${invoice.id}|${invoice.version}|${invoice.fundingStatus}`);
    const results = await db.batch([
      db.prepare(`UPDATE client_invoices SET status = 'ready_for_backend',
        issue_reference = ?, updated_at = ?, version = version + 1
        WHERE id = ? AND version = ? AND status = 'draft' AND funding_status = 'fully_allocated_sandbox'
          AND environment = 'demo' AND integrity_state = 'synthetic'`)
        .bind(`demo:billing-review:${invoice.id}`, now, invoice.id, invoice.version),
      db.prepare(`INSERT OR IGNORE INTO domain_outbox_events
        (id, aggregate_type, aggregate_id, event_type, payload_hash, payload_version, status, attempts,
         available_at, environment, integrity_state, created_at, payload_json, correlation_key, idempotency_key)
        SELECT ?, 'booking', booking.id, 'invoice.ready_for_backend', ?, 'v1', 'pending', 0,
         ?, 'demo', 'synthetic', ?, ?, ?, ? FROM bookings booking JOIN client_invoices invoice
          ON invoice.booking_id = booking.id WHERE invoice.id = ? AND invoice.version = ?
          AND invoice.status = 'ready_for_backend' AND booking.environment = 'demo'
          AND booking.integrity_state = 'synthetic'`)
        .bind(`OUT-INV-${invoice.id}`, payloadHash, now, now,
          JSON.stringify({ invoiceId: invoice.id, taxTreatment: invoice.taxTreatment }),
          invoice.id, `review:${invoice.id}:v${invoice.version}`, invoice.id, invoice.version + 1),
      db.prepare(`INSERT OR IGNORE INTO audit_events
        (id, actor_type, actor_id, event_type, entity_type, entity_id, detail, created_at)
        SELECT ?, 'operations', ?, 'invoice_reviewed_for_backend', 'invoice', invoice.id,
         'DEMO ONLY: funding allocation and pricing provenance were reviewed. Tax configuration, invoice number, document issue and receipt remain production-backend actions.', ?
        FROM client_invoices invoice WHERE invoice.id = ? AND invoice.version = ?
          AND invoice.status = 'ready_for_backend'`)
        .bind(`AUD-INV-${invoice.id}`, actorId, now, invoice.id, invoice.version + 1),
    ]);
    if (!results[0]?.meta?.changes) {
      throw new PlatformWorkflowError("This billing record changed. Refresh before trying again.", 409);
    }
    return;
  }

  const request = await db.prepare(`SELECT id, status, version FROM service_requests
    WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
    .bind(action.requestId).first<{ id: string; status: string; version: number }>();
  if (!request) throw new PlatformWorkflowError("That service request could not be found.", 404);
  if (request.version !== action.version) throw new PlatformWorkflowError("This request changed. Refresh before trying again.", 409);

  if (action.action === "triage_service_request") {
    if (request.status !== "open") throw new PlatformWorkflowError("Only open requests can be triaged.", 409);
    const result = await db.prepare(`UPDATE service_requests SET status = 'triaged', owner_id = ?,
      updated_at = ?, version = version + 1 WHERE id = ? AND version = ? AND status = 'open'
      AND environment = 'demo' AND integrity_state = 'synthetic'`)
      .bind(actorId, now, request.id, request.version).run();
    if (!result.meta.changes) throw new PlatformWorkflowError("This request changed. Refresh before trying again.", 409);
    return;
  }

  const resolution = action.resolution.trim().replace(/\s+/g, " ");
  if (resolution.length < 3 || resolution.length > 600) throw new PlatformWorkflowError("Enter a concise resolution note.");
  if (request.status === "resolved") throw new PlatformWorkflowError("This request is already resolved.", 409);
  const result = await db.prepare(`UPDATE service_requests SET status = 'resolved', owner_id = ?,
    detail = detail || '\nResolution: ' || ?, updated_at = ?, resolved_at = ?, version = version + 1
    WHERE id = ? AND version = ? AND status <> 'resolved' AND environment = 'demo' AND integrity_state = 'synthetic'`)
    .bind(actorId, resolution, now, now, request.id, request.version).run();
  if (!result.meta.changes) throw new PlatformWorkflowError("This request changed. Refresh before trying again.", 409);
}
