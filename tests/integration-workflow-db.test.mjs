import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyPlatformAction,
  completeDemoIdentityVerification,
  createDemoPaymentOrder,
  createServiceRequest,
  ensureIntegrationDemoData,
  readPlatformState,
  reconcileDemoPayment,
  startDemoIdentityVerification,
} from "../app/lib/integration-server.ts";

class Prepared {
  constructor(owner, sql, values = []) { this.owner = owner; this.sql = sql; this.values = values; }
  bind(...values) { return new Prepared(this.owner, this.sql, values); }
  async first() { return this.owner.database.prepare(this.sql).get(...this.values) ?? null; }
  async all() { return { results: this.owner.database.prepare(this.sql).all(...this.values) }; }
  async run() { return this.runSync(); }
  runSync() {
    const result = this.owner.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Adapter {
  constructor(database) { this.database = database; }
  prepare(sql) { return new Prepared(this, sql); }
  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.runSync());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    database.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}

function run(database, sql, ...values) { return database.prepare(sql).run(...values); }
function one(database, sql, ...values) { return database.prepare(sql).get(...values); }

function seedDomain(database) {
  const now = "2026-08-28T08:00:00.000Z";
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-INT','Integration Client','Client User','client@example.test','approved','demo','synthetic')`);
  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,purpose_code,purpose_label,engagement_model,
     calendar_category,calendar_label,minimum_grade,contract_months,start_date,end_date,shift_start,shift_end,
     client_price_cents,officer_rate_cents,pricing_version,environment,integrity_state,funding_status,release_cadence,status)
    VALUES ('BK-INT','CL-INT','Integration Site','Rosebank','Main gate','Unarmed','commercial_access',
     'Commercial access','fixed','ordinary','Ordinary Monday-Saturday','Grade C',1,'2039-08-29','2039-09-28',
     '06:00','18:00',140000,80000,'V21-TEST','demo','synthetic','awaiting_payment','Weekly','awaiting_payment')`);
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,environment,integrity_state)
    VALUES ('SITE-INT','CL-INT','BK-INT','Integration Site','Rosebank','1 Integration Avenue',-26145900,28041400,'demo','synthetic')`);
  run(database, `INSERT INTO client_invoices
    (id,booking_id,client_id,service_period_start,service_period_end,subtotal_cents,pricing_version,
     environment,integrity_state,created_at,updated_at)
    VALUES ('INV-INT','BK-INT','CL-INT','2039-08-29','2039-09-28',140000,'V21-TEST',
     'demo','synthetic',?,?)`, now, now);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,service_type,purpose_code,minimum_grade,environment,integrity_state)
    VALUES ('POST-INT','SITE-INT','BK-INT','Main gate','Unarmed','commercial_access','Grade C','demo','synthetic')`);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
     position_index,calendar_category,officer_offer_cents,environment,integrity_state,status,version)
    VALUES ('SLOT-INT','SITE-INT','POST-INT','BK-INT','2039-08-29','2039-08-29T04:00:00.000Z',
     '2039-08-29T16:00:00.000Z','2039-08-29T03:45:00.000Z','2039-08-29T04:10:00.000Z',
     1,'ordinary',80000,'demo','synthetic','uncovered',1)`);
  run(database, `INSERT INTO officers
    (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry,approval_status,banking_status,created_at)
    VALUES ('OFF-INT','Integration Officer','+27820000111','officer@example.test','Johannesburg',
     'PSIRA-INT','Grade B','2040-12-31','approved','verified',?)`, now);
  run(database, `INSERT INTO officer_passports
    (officer_id,passport_number,public_token_hash,status,readiness_label,environment,integrity_state,updated_at)
    VALUES ('OFF-INT','PASS-INT','HASH-INT','active','LOKD Ready','demo','synthetic',?)`, now);
  run(database, `INSERT INTO officer_applications
    (id,pathway,full_name,mobile_normalized,email_normalized,city,province,psira_status,psira_number,psira_grade,
     service_interests,purpose_interests,training_interests,over_18_confirmed,eligibility_acknowledged,
     privacy_notice_version,privacy_acknowledged_at,identity_verification_status,identity_consent_version,
     identity_consented_at,environment,integrity_state,
     status,source,retention_review_at,created_at,updated_at)
    VALUES ('APP-INT','qualified','Integration Applicant','+27820000222','applicant@example.test','Johannesburg',
     'Gauteng','active','PSIRA-APP','Grade B','["Unarmed"]','["Commercial access"]','[]',1,1,
     'test-v1',?,'not_started','identity-consent-test-v1',?,'demo','synthetic','submitted','test','2040-12-31',?,?)`, now, now, now, now);
}

test("identity workflow is idempotent and projects one replay-safe sandbox event", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  seedDomain(database);
  await ensureIntegrationDemoData(db);

  const first = await startDemoIdentityVerification(db, "APP-INT", "ops@example.test");
  const repeated = await startDemoIdentityVerification(db, "APP-INT", "ops@example.test");
  assert.equal(repeated.id, first.id);
  await completeDemoIdentityVerification(db, "APP-INT", "ops@example.test");
  await completeDemoIdentityVerification(db, "APP-INT", "ops@example.test");

  assert.deepEqual({ ...one(database, `SELECT status,decision FROM identity_verification_cases WHERE id=?`, first.id) },
    { status: "verified", decision: "sandbox_verified" });
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM provider_webhook_inbox WHERE provider_key='INT-DEMO-IDENTITY'`).total, 1);
  assert.equal(one(database, `SELECT identity_verification_status AS status FROM officer_applications WHERE id='APP-INT'`).status, "demo_verified");
  database.close();
});

test("payment projection walks the canonical state machine and creates one funding reconciliation", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  seedDomain(database);
  await createDemoPaymentOrder(db, { bookingId: "BK-INT", clientId: "CL-INT", amountCents: 140000 });
  await reconcileDemoPayment(db, "BK-INT", "CL-INT", "ops@example.test");
  await reconcileDemoPayment(db, "BK-INT", "CL-INT", "ops@example.test");

  assert.equal(one(database, `SELECT status FROM payment_orders WHERE booking_id='BK-INT'`).status, "reconciled");
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM booking_funding_reconciliations WHERE booking_id='BK-INT'`).total, 1);
  assert.deepEqual({ ...one(database, `SELECT funding_status AS fundingStatus,status FROM bookings WHERE id='BK-INT'`) },
    { fundingStatus: "paid_in_full", status: "matching" });
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM provider_webhook_inbox WHERE provider_key='INT-DEMO-PAYMENTS'`).total, 1);
  assert.deepEqual({ ...one(database, `SELECT funding_status AS fundingStatus,balance_cents AS balanceCents
    FROM client_invoices WHERE id='INV-INT'`) }, { fundingStatus: "fully_allocated_sandbox", balanceCents: 0 });
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM invoice_receipt_allocations
    WHERE invoice_id='INV-INT' AND amount_cents=140000 AND status='allocated'`).total, 1);
  await applyPlatformAction(db, { action: "review_invoice", invoiceId: "INV-INT", version: 2 }, "ops@example.test");
  assert.equal(one(database, `SELECT status FROM client_invoices WHERE id='INV-INT'`).status, "ready_for_backend");
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM domain_outbox_events
    WHERE aggregate_id='BK-INT' AND event_type='invoice.ready_for_backend'`).total, 1);
  assert.throws(() => run(database, `UPDATE payment_orders SET status='created' WHERE booking_id='BK-INT'`), /payment_order_transition_invalid/);
  database.close();
});

test("client and officer requests preserve tenant provenance and support optimistic Operations ownership", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  seedDomain(database);
  const clientRequest = await createServiceRequest(db, {
    requestedByRole: "client", requestedById: "client@example.test", clientId: "CL-INT", bookingId: "BK-INT",
    category: "change_request", summary: "Change gate instructions", detail: "Use the north gate for the next roster window.",
  });
  const officerRequest = await createServiceRequest(db, {
    requestedByRole: "officer", requestedById: "officer@example.test", officerId: "OFF-INT",
    category: "assessment", summary: "Book assessment", detail: "Please provide the next assessment date.",
  });
  await applyPlatformAction(db, { action: "triage_service_request", requestId: clientRequest, version: 1 }, "ops@example.test");
  await applyPlatformAction(db, { action: "resolve_service_request", requestId: clientRequest, version: 2, resolution: "Change recorded." }, "ops@example.test");
  assert.equal(one(database, `SELECT status FROM service_requests WHERE id=?`, clientRequest).status, "resolved");
  assert.equal(one(database, `SELECT status FROM service_requests WHERE id=?`, officerRequest).status, "open");
  assert.rejects(() => applyPlatformAction(db, { action: "triage_service_request", requestId: clientRequest, version: 1 }, "ops@example.test"), /changed|resolved/i);
  assert.throws(() => run(database, `INSERT INTO service_requests
    (id,client_id,requested_by_role,requested_by_id,category,summary,detail,environment,integrity_state,created_at,updated_at)
    VALUES ('SR-BAD','CL-INT','client','x','x','Bad','Bad','production','production_verified','x','x')`),
  /service_request_parent_provenance_mismatch/);

  const state = await readPlatformState(db);
  assert.equal(state.serviceRequests.length, 2);
  assert.equal(state.integrations.find((item) => item.capability === "identity").status, "not_connected");
  assert.equal(state.sections.find((item) => item.key === "funding").state, "adapter_ready");
  assert.throws(() => run(database, `DELETE FROM domain_outbox_events`), /outbox_append_only/);
  database.close();
});

test("provider inbox, identity, payment and outbox transitions fail closed under direct SQL", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  seedDomain(database);
  await ensureIntegrationDemoData(db);

  const identity = await startDemoIdentityVerification(db, "APP-INT", "ops@example.test");
  assert.throws(() => run(database, `UPDATE identity_verification_cases SET status='verified' WHERE id=?`, identity.id),
    /identity_verification_evidence_missing/);
  assert.throws(() => run(database, `UPDATE identity_verification_cases SET provider_reference='replacement' WHERE id=?`, identity.id),
    /identity_case_identity_immutable/);
  await completeDemoIdentityVerification(db, "APP-INT", "ops@example.test");
  assert.throws(() => run(database, `UPDATE identity_verification_cases SET status='processing' WHERE id=?`, identity.id),
    /identity_case_(transition_invalid|terminal)/);

  await createDemoPaymentOrder(db, { bookingId: "BK-INT", clientId: "CL-INT", amountCents: 140000 });
  assert.throws(() => run(database, `UPDATE payment_orders SET status='reconciled' WHERE booking_id='BK-INT'`),
    /payment_order_(transition_invalid|evidence_missing)/);
  await reconcileDemoPayment(db, "BK-INT", "CL-INT", "ops@example.test");
  assert.throws(() => run(database, `UPDATE payment_orders SET cleared_at=NULL WHERE booking_id='BK-INT'`),
    /payment_order_evidence_invalid/);

  run(database, `INSERT INTO provider_webhook_inbox
    (id,provider_key,provider_event_id,event_type,raw_body_hash,signature_state,processing_state,attempts,
     operation_id,environment,integrity_state,received_at)
    VALUES ('WH-UNVERIFIED','INT-DEMO-PAYMENTS','evt-unverified','payment.cleared','hash','unverified',
     'received',0,NULL,'demo','synthetic','2026-08-28T08:00:00.000Z')`);
  assert.throws(() => run(database, `UPDATE provider_webhook_inbox SET processing_state='processed',
    processed_at='2026-08-28T08:01:00.000Z' WHERE id='WH-UNVERIFIED'`), /webhook_signature_required/);

  const outboxId = one(database, `SELECT id FROM domain_outbox_events WHERE aggregate_type='booking' AND aggregate_id='BK-INT'`).id;
  assert.throws(() => run(database, `UPDATE domain_outbox_events SET status='dispatched' WHERE id=?`, outboxId),
    /outbox_transition_invalid/);
  assert.throws(() => run(database, `INSERT INTO domain_outbox_events
    (id,aggregate_type,aggregate_id,event_type,payload_hash,payload_version,status,attempts,available_at,
     environment,integrity_state,created_at)
    VALUES ('OUT-CROSS','booking','BK-INT','test','hash','v1','pending',0,'x','production','production_verified','x')`),
  /outbox_parent_provenance_mismatch/);
  database.close();
});
