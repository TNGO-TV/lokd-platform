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
import { runPlatformMaintenance } from "../app/lib/platform-jobs.ts";
import { calculatePayrollItem, SYNTHETIC_ENGINE_TEST_POLICY } from "../app/lib/payroll-engine.ts";

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
  assert.equal(state.integrations.find((item) => item.capability === "backend").status, "sandbox_ready");
  assert.equal(state.integrations.length, 7);
  assert.equal(state.summary.externalIntegrationsRemaining, 2);
  assert.equal(state.sections.find((item) => item.key === "funding").state, "adapter_ready");
  assert.equal(state.payroll.engineVersion, "payroll-engine-v3-shadow");
  assert.equal(state.payroll.creditTermsDays, 0);
  assert.equal(state.payroll.fundingModel, "advance_only");
  assert.equal(state.payroll.livePolicyActivated, false);
  assert.ok(state.payroll.policies.some((policy) => policy.id === "PAYPOL-ZA-2027-CANDIDATE"
    && policy.status === "source_review" && policy.sourceReferences.length >= 5));
  assert.ok(state.operatorControls.currentActorRoles.includes("payroll_reviewer"));
  assert.ok(state.operatorControls.policies.some((policy) => policy.actionCode === "settlement.release"
    && policy.secondApprovalRequired));
  await applyPlatformAction(db, {
    action: "run_payroll_shadow_validation",
    policyId: "PAYPOL-ZA-2027-CANDIDATE",
  }, "ops@example.test");
  const validatedState = await readPlatformState(db, "ops@example.test");
  assert.equal(validatedState.payroll.validations[0].status, "passed");
  assert.equal(validatedState.payroll.validations[0].activationEligible, false);
  assert.equal(validatedState.payroll.validations[0].settlementLocked, true);
  assert.throws(() => run(database, `UPDATE payroll_shadow_validation_runs SET status='failed'`),
    /payroll_shadow_validation_append_only/);
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

test("the policy-driven payroll engine is deterministic and rejects uncovered service dates", () => {
  const first = calculatePayrollItem(100_000, "2026-06-30", SYNTHETIC_ENGINE_TEST_POLICY);
  const repeated = calculatePayrollItem(100_000, "2026-06-30", SYNTHETIC_ENGINE_TEST_POLICY);
  assert.deepEqual(repeated, first);
  assert.equal(first.grossCents, 100_000);
  assert.equal(first.netPayCents, 90_000);
  assert.equal(first.employerCostCents, 102_500);
  assert.equal(first.coidaProvisionCents, 500);
  assert.equal(first.leaveAccruedMinutes, 4);
  assert.throws(() => calculatePayrollItem(100_000, "2100-01-01", SYNTHETIC_ENGINE_TEST_POLICY), /covers this service date/i);
});

test("platform maintenance records controls and dispatches internal outbox events idempotently", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  seedDomain(database);
  await ensureIntegrationDemoData(db);
  const requestId = await createServiceRequest(db, {
    requestedByRole: "client",
    requestedById: "client@example.test",
    clientId: "CL-INT",
    bookingId: "BK-INT",
    category: "change_request",
    summary: "Notify Operations",
    detail: "This event should become one durable in-app notification.",
  });

  const first = await runPlatformMaintenance(db, {
    actorId: "ops@example.test",
    trigger: "test",
    evidenceStoreBound: true,
  });
  const second = await runPlatformMaintenance(db, {
    actorId: "ops@example.test",
    trigger: "test",
    evidenceStoreBound: true,
  });

  assert.equal(first.status, "completed");
  assert.equal(first.requiredTables, 20);
  assert.equal(first.requiredTriggers, 29);
  assert.equal(first.processedEvents, 1);
  assert.equal(second.processedEvents, 0);
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM platform_readiness_controls WHERE status='ready'`).total, 6);
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM operator_notifications WHERE source_event_id=(
    SELECT id FROM domain_outbox_events WHERE aggregate_id=? LIMIT 1)`, requestId).total, 1);
  assert.equal(one(database, `SELECT status FROM domain_outbox_events WHERE aggregate_id=? LIMIT 1`, requestId).status, "dispatched");
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM scheduled_job_runs WHERE status='completed'`).total, 2);
  database.close();
});

test("Operations can run a replay-safe synthetic gross-to-net calculation after timesheet approval", async () => {
  const database = migratedDatabase();
  const db = new D1Adapter(database);
  seedDomain(database);
  const now = "2026-08-30T08:00:00.000Z";
  run(database, `INSERT INTO workforce_employers
    (id,legal_name,employer_type,environment,status,created_at,updated_at)
    VALUES ('EMP-PAY','LOKD Test Employer','direct','demo','current',?,?)`, now, now);
  run(database, `INSERT INTO workforce_engagements
    (id,officer_id,employer_id,model,environment,status,active_key,engagement_reference,terms_version,
     payroll_status,benefits_status,created_at,updated_at)
    VALUES ('WE-PAY','OFF-INT','EMP-PAY','direct_flex','demo','active','OFF-INT','synthetic:engagement',
     'test-terms','ready','ready',?,?)`, now, now);
  run(database, `INSERT INTO shifts
    (id,booking_id,officer_id,scheduled_date,environment,integrity_state,status,earnings_cents)
    VALUES ('SHIFT-PAY','BK-INT','OFF-INT','2026-08-30','demo','synthetic','completed',100000)`);
  run(database, `INSERT INTO shift_timesheets
    (id,shift_id,booking_id,officer_id,workforce_engagement_id,employer_id,workforce_model,
     service_date,scheduled_starts_at,scheduled_ends_at,scheduled_minutes,recorded_minutes,payable_minutes,
     gross_wage_cents,calendar_category,policy_version,client_evidence_status,operations_status,
     evidence_reference,evidence_hash,active_key,approved_by,approved_at,submitted_at,locked_at,
     environment,integrity_state,version,created_at,updated_at)
    VALUES ('TS-PAY','SHIFT-PAY','BK-INT','OFF-INT','WE-PAY','EMP-PAY','direct_flex',
     '2026-08-30','2026-08-30T04:00:00.000Z','2026-08-30T16:00:00.000Z',720,720,720,
     100000,'ordinary','synthetic-wage-v1','confirmed','approved_for_backend',
     'synthetic:evidence','hash','SHIFT-PAY','ops@example.test',?,?,?,
     'demo','synthetic',2,?,?)`, now, now, now, now, now);
  run(database, `INSERT INTO payroll_runs
    (id,batch_key,employer_id,period_start,period_end,pay_date,run_type,currency,status,gross_cents,
     item_count,environment,integrity_state,created_by,created_at,updated_at,version)
    VALUES ('PR-PAY','test:pay','EMP-PAY','2026-08-30','2026-08-30','2026-08-30','synthetic_handoff',
     'ZAR','awaiting_backend_calculation',100000,1,'demo','synthetic','ops@example.test',?,?,1)`, now, now);
  run(database, `INSERT INTO payroll_items
    (id,payroll_run_id,officer_id,workforce_engagement_id,employer_id,workforce_model,gross_wage_cents,
     status,environment,integrity_state,created_at,updated_at)
    VALUES ('PI-PAY','PR-PAY','OFF-INT','WE-PAY','EMP-PAY','direct_flex',100000,
     'awaiting_backend_calculation','demo','synthetic',?,?)`, now, now);
  run(database, `INSERT INTO pay_item_sources
    (id,payroll_item_id,timesheet_id,timesheet_version,payable_minutes,gross_wage_cents,
     active_key,environment,integrity_state,created_at)
    VALUES ('PIS-PAY','PI-PAY','TS-PAY',2,720,100000,'TS-PAY','demo','synthetic',?)`, now);

  await applyPlatformAction(db, { action: "calculate_payroll_run", payrollRunId: "PR-PAY" }, "ops@example.test");
  await applyPlatformAction(db, { action: "calculate_payroll_run", payrollRunId: "PR-PAY" }, "ops@example.test");

  assert.deepEqual({ ...one(database, `SELECT status,employee_deduction_cents AS deductions,
    net_pay_cents AS netPay,employer_cost_cents AS employerCost,calculation_version AS calculationVersion
    FROM payroll_runs WHERE id='PR-PAY'`) }, {
    status: "calculated_for_review",
    deductions: 10000,
    netPay: 90000,
    employerCost: 102500,
    calculationVersion: "payroll-engine-v3-shadow",
  });
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM pay_item_lines WHERE payroll_item_id='PI-PAY'`).total, 6);
  assert.deepEqual({ ...one(database, `SELECT status,requested_by AS requestedBy,amount_cents AS amountCents
    FROM operator_approval_requests WHERE aggregate_id='PR-PAY'`) }, {
    status: "pending_first_approval",
    requestedBy: "ops@example.test",
    amountCents: 90000,
  });
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM domain_outbox_events
    WHERE event_type='payroll.calculated_for_review' AND aggregate_id='BK-INT'`).total, 1);
  assert.equal(one(database, `SELECT COUNT(*) AS total FROM audit_events
    WHERE event_type='synthetic_payroll_calculated' AND entity_id='PR-PAY'`).total, 1);

  assert.throws(() => run(database, `UPDATE payroll_runs SET status='first_approved',
    approved_by='ops@example.test' WHERE id='PR-PAY'`), /payroll_maker_checker_first_approval_invalid/);
  assert.throws(() => run(database, `UPDATE payroll_runs SET status='first_approved'
    WHERE id='PR-PAY'`), /payroll_maker_checker_first_approval_invalid/);
  await applyPlatformAction(db, {
    action: "approve_payroll_run",
    payrollRunId: "PR-PAY",
    version: 2,
  }, "payroll-reviewer@demo.lokd.invalid");
  assert.deepEqual({ ...one(database, `SELECT status,approved_by AS approvedBy,version
    FROM payroll_runs WHERE id='PR-PAY'`) }, {
    status: "first_approved",
    approvedBy: "payroll-reviewer@demo.lokd.invalid",
    version: 3,
  });
  await assert.rejects(() => applyPlatformAction(db, {
    action: "second_approve_payroll_run",
    payrollRunId: "PR-PAY",
    version: 3,
  }, "finance-approver@demo.lokd.invalid"), /MFA/i);
  run(database, `UPDATE operator_accounts SET mfa_status='verified',mfa_verified_at=?
    WHERE id='finance-approver@demo.lokd.invalid'`, new Date().toISOString());
  await applyPlatformAction(db, {
    action: "second_approve_payroll_run",
    payrollRunId: "PR-PAY",
    version: 3,
  }, "finance-approver@demo.lokd.invalid");
  assert.deepEqual({ ...one(database, `SELECT status,approved_by AS approvedBy,
    second_approved_by AS secondApprovedBy,version FROM payroll_runs WHERE id='PR-PAY'`) }, {
    status: "approved_for_export",
    approvedBy: "payroll-reviewer@demo.lokd.invalid",
    secondApprovedBy: "finance-approver@demo.lokd.invalid",
    version: 4,
  });
  assert.equal(one(database, `SELECT status FROM operator_approval_requests WHERE aggregate_id='PR-PAY'`).status, "approved");
  assert.equal(one(database, `SELECT settlement_reference AS settlementReference FROM payroll_runs
    WHERE id='PR-PAY'`).settlementReference, null);
  assert.throws(() => run(database, `UPDATE payroll_runs SET status='released_for_settlement',
    settlement_reference='SETTLEMENT-MUST-NOT-EXIST' WHERE id='PR-PAY'`),
  /payroll_settlement_locked_until_controlled_pilot_authorisation/);
  assert.throws(() => run(database, `INSERT INTO disbursement_batches
    (id,employer_id,rail,currency,status,total_cents,item_count,provider_reference,
     environment,integrity_state,created_by,created_at,updated_at)
    VALUES ('DB-PAY','EMP-PAY','eft','ZAR','submitted',90000,1,'provider-ref',
     'demo','synthetic','ops@example.test',?,?)`, now, now),
  /payroll_disbursement_locked_until_controlled_pilot_authorisation/);
  assert.throws(() => run(database, `INSERT INTO payslips
    (id,payroll_item_id,artifact_id,document_version,status,environment,integrity_state,generated_at)
    VALUES ('PS-PAY','PI-PAY','ART-NOT-ISSUED',1,'generated','demo','synthetic',?)`, now),
  /payroll_payslip_issue_locked_until_controlled_pilot_authorisation/);
  database.close();
});

test("zero-credit database guards block credit terms and unfunded officer offers", () => {
  const database = migratedDatabase();
  seedDomain(database);
  assert.throws(() => run(database, `UPDATE bookings SET credit_terms_days=30 WHERE id='BK-INT'`),
    /zero_credit_advance_funding_required/);
  assert.throws(() => run(database, `UPDATE bookings SET funding_model='invoice_credit' WHERE id='BK-INT'`),
    /zero_credit_advance_funding_required/);
  assert.throws(() => run(database, `INSERT INTO offers
    (id,booking_id,officer_id,position_index,amount_cents,status,expires_at)
    VALUES ('OF-NO-CREDIT','BK-INT','OFF-INT',1,80000,'open','2039-08-28T00:00:00.000Z')`),
  /offer_release_requires_full_cleared_advance_funding/);
  database.close();
});
