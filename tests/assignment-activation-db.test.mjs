import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  activateAssignment,
  evaluateAssignmentActivation,
  recordAssignmentActivationEvaluation,
  revalidateAssignment,
  releaseAssignmentHourReservations,
  runDueAssignmentRevalidations,
} from "../app/lib/assignment-activation-server.ts";
import { officerShiftEconomicsForRoster } from "../app/lib/pilot-pricing.ts";
import { REQUIRED_LAUNCH_GATE_CODES } from "../app/lib/workforce-core.ts";

class Prepared {
  constructor(owner, sql, values = []) {
    this.owner = owner;
    this.sql = sql;
    this.values = values;
  }
  bind(...values) { return new Prepared(this.owner, this.sql, values); }
  async first() {
    const result = this.owner.database.prepare(this.sql).get(...this.values) ?? null;
    await this.owner.afterRead?.({ method: "first", sql: this.sql, values: this.values, result });
    return result;
  }
  async all() {
    const results = this.owner.database.prepare(this.sql).all(...this.values);
    await this.owner.afterRead?.({ method: "all", sql: this.sql, values: this.values, result: results });
    return { results };
  }
  async run() { return this.runSync(); }
  runSync() {
    const result = this.owner.database.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Adapter {
  constructor(database, beforeBatch = null) {
    this.database = database;
    this.beforeBatch = beforeBatch;
  }
  prepare(sql) { return new Prepared(this, sql); }
  async batch(statements) {
    if (this.beforeBatch && statements.some((statement) => statement.sql.includes("INSERT INTO assignment_evidence_tokens"))) {
      const hook = this.beforeBatch;
      this.beforeBatch = null;
      await hook();
    }
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

class TwoActivationBarrierAdapter extends D1Adapter {
  constructor(database) {
    super(database);
    this.activationBatchArrivals = 0;
    this.releaseActivationBatches = null;
    this.activationBatchBarrier = new Promise((resolve) => {
      this.releaseActivationBatches = resolve;
    });
  }

  async batch(statements) {
    if (statements.some((statement) => statement.sql.includes("INSERT INTO assignment_evidence_tokens"))
      && this.activationBatchArrivals < 2) {
      this.activationBatchArrivals += 1;
      if (this.activationBatchArrivals === 2) this.releaseActivationBatches();
      else await this.activationBatchBarrier;
    }
    return super.batch(statements);
  }
}

class SameKeyEvaluationBarrierAdapter extends D1Adapter {
  constructor(database) {
    super(database);
    this.evaluationBatchArrivals = 0;
    this.releaseEvaluationBatches = null;
    this.evaluationBatchBarrier = new Promise((resolve) => {
      this.releaseEvaluationBatches = resolve;
    });
  }

  async batch(statements) {
    if (statements.some((statement) => statement.sql.includes("INSERT INTO assignment_activation_commands"))
      && this.evaluationBatchArrivals < 2) {
      this.evaluationBatchArrivals += 1;
      if (this.evaluationBatchArrivals === 2) this.releaseEvaluationBatches();
      else await this.evaluationBatchBarrier;
    }
    return super.batch(statements);
  }
}

class FactReadMutationAdapter extends D1Adapter {
  constructor(database, mutationLimit) {
    super(database);
    this.mutationLimit = mutationLimit;
    this.mutationCount = 0;
  }

  async afterRead({ sql }) {
    if (this.mutationCount >= this.mutationLimit
      || !sql.includes("FROM booking_funding_reconciliations WHERE active_key")) return;
    this.mutationCount += 1;
    run(this.database, `UPDATE launch_controls
      SET version=version+1,updated_at=? WHERE code='G2_CONTROL_ROOM_INSPECTION'`,
    new Date(Date.parse(now) + this.mutationCount * 1_000).toISOString());
  }
}

function migratedDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", "");
    database.exec(sql);
  }
  return database;
}

const now = "2026-08-27T08:00:00.000Z";
const expiry = "2041-12-31T23:59:59.999Z";
const startsAt = "2039-12-25T18:00:00.000Z";
const endsAt = "2039-12-26T06:00:00.000Z";

function run(database, sql, ...values) {
  return database.prepare(sql).run(...values);
}

function seedOfficer(database, id, engagementId, termsId) {
  run(database, `INSERT INTO officers
    (id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry,approval_status,banking_status,
     flex_available,external_work_acknowledged,rest_window_confirmed,created_at)
    VALUES (?,?,?,?,?,?,?,?, 'approved','verified',1,1,1,?)`,
    id, `Officer ${id}`, `+2700${id}`, `${id.toLowerCase()}@example.test`, "Johannesburg", `PSIRA-${id}`, "Grade B", "2041-12-31", now);
  run(database, `INSERT INTO officer_passports
    (officer_id,passport_number,public_token_hash,status,readiness_label,environment,integrity_state,
     evidence_reference,issued_at,last_reviewed_at,next_review_at,updated_at)
    VALUES (?,?,?,'active','LOKD Ready','production','verified',?,?,?,?,?)`,
    id, `PASS-${id}`, `HASH-${id}`, `passport:evidence:${id}`, now, now, expiry, now);
  run(database, `INSERT INTO officer_services (officer_id,service_type,qualified,opted_in,qualification_expiry)
    VALUES (?,'Unarmed',1,1,'2041-12-31')`, id);
  for (const [suffix, code, category, serviceType, purposeCode] of [
    ["CORE", "core_ready", "core", null, null],
    ["SERVICE", "service_unarmed", "service", "Unarmed", null],
    ["PURPOSE", "purpose_commercial", "purpose", null, "commercial_access"],
  ]) run(database, `INSERT INTO officer_endorsements
    (id,officer_id,code,label,category,service_type,purpose_code,status,environment,integrity_state,
     evidence_reference,assessed_at,expires_at,next_due_at,assessor,client_visible)
    VALUES (?,?,?,?,?,?,?,'current','production','verified',?,?,'2041-12-31','2041-09-01','Fixture assessor',1)`,
    `END-${id}-${suffix}`, id, code, code, category, serviceType, purposeCode, `endorsement:evidence:${id}:${code}`, now);
  for (const recordType of ["identity", "psira"]) run(database, `INSERT INTO compliance_records
    (id,officer_id,record_type,status,environment,integrity_state,evidence_reference,verified_at,expires_at,next_due_at)
    VALUES (?,?,?,'current','production','verified',?,?,?,?)`,
    `CR-${id}-${recordType}`, id, recordType, `compliance:evidence:${id}:${recordType}`, now, expiry, "2041-09-01T00:00:00.000Z");
  run(database, `INSERT INTO workforce_engagements
    (id,officer_id,employer_id,model,environment,status,active_key,engagement_reference,terms_version,
     payroll_status,benefits_status,weekly_hour_cap,activated_at,review_due_at,version,created_at,updated_at)
    VALUES (?,?, 'EMP-1','direct_flex','production','active',?,?, 'TERMS-v1','ready','ready',24,?,?,1,?,?)`,
    engagementId, id, id, `ENG-${id}`, now, expiry, now, now);
  run(database, `INSERT INTO workforce_terms_acceptances
    (id,workforce_engagement_id,officer_id,terms_version,acceptance_mode,environment,integrity_state,
     evidence_reference,accepted_at,expires_at,version,active_key,created_at)
    VALUES (?,?,?,'TERMS-v1','electronic','production','verified','terms:evidence',?,?,1,?,?)`, termsId, engagementId, id, now, expiry, engagementId, now);
  run(database, `INSERT INTO officer_availability_windows
    (id,officer_id,starts_at,ends_at,source,status,environment,integrity_state,evidence_reference,rest_confirmed_at,version,created_at)
    VALUES (?,?,?,?,'fixture','available','production','verified',?,?,1,?)`, `AV-${id}`, id,
    "2039-12-20T00:00:00.000Z", "2040-01-10T00:00:00.000Z", `availability:evidence:${id}`, now, now);
  run(database, `INSERT INTO officer_schedule_declarations
    (id,officer_id,version,status,environment,integrity_state,evidence_reference,declared_at,expires_at,supersedes_id,created_at)
    VALUES (?,?,1,'current','production','verified',?,?,?,NULL,?)`, `OSD-${id}`, id,
    `schedule:evidence:${id}`, now, expiry, now);
  run(database, `INSERT INTO officer_site_inductions
    (id,officer_id,site_id,induction_version,status,environment,integrity_state,evidence_reference,
     completed_at,expires_at,version,active_key,created_at)
    VALUES (?,?,'SITE-1','IND-v1','completed','production','verified','induction:evidence',?,?,1,?,?)`, `IND-${id}`, id, now, expiry, `${id}:SITE-1`, now);
  run(database, `INSERT INTO officer_travel_assessments
    (id,officer_id,site_id,status,environment,integrity_state,estimated_minutes,source,evidence_reference,
     assessed_at,valid_until,version,active_key,created_at)
    VALUES (?,?,'SITE-1','feasible','production','verified',30,'route_matrix','travel:evidence',?,?,1,?,?)`, `TRAVEL-${id}`, id, now, expiry, `${id}:SITE-1`, now);
}

function seedValid(database, secondOfficer = false) {
  for (const [index, code] of REQUIRED_LAUNCH_GATE_CODES.entries()) run(database, `INSERT INTO launch_controls
    (code,label,category,status,evidence_level,evidence_reference,detail,hard_gate,sort_order,verified_by,verified_at,expires_at,version,updated_at)
    VALUES (?,?,'fixture','passed','independently_verified',?,'Fixture evidence',1,?,'Verifier',?,?,1,?)
    ON CONFLICT(code) DO UPDATE SET
      label=excluded.label,
      category=excluded.category,
      status=excluded.status,
      evidence_level=excluded.evidence_level,
      evidence_reference=excluded.evidence_reference,
      detail=excluded.detail,
      hard_gate=excluded.hard_gate,
      sort_order=excluded.sort_order,
      verified_by=excluded.verified_by,
      verified_at=excluded.verified_at,
      expires_at=excluded.expires_at,
      version=excluded.version,
      updated_at=excluded.updated_at`,
    code, code, `evidence:${code}`, index + 1, now, expiry, now);
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-1','Fixture Client','Client Contact','client@example.test','approved','production','production_verified')`);
  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,purpose_code,purpose_label,engagement_model,
     calendar_category,calendar_label,minimum_grade,contract_months,start_date,end_date,shift_start,shift_end,
     client_price_cents,officer_rate_cents,pricing_version,environment,integrity_state,funding_status,release_cadence,status)
    VALUES ('BK-1','CL-1','Fixture Site','Johannesburg','Gate','Unarmed','commercial_access','Commercial access','flex',
     'christmas','Christmas peak day','Grade C',0,'2039-12-25','2039-12-25','20:00','08:00',350000,200000,
     'LOKD-PREMIUM-2026.09','production','production_verified','paid_in_full','Weekly','matching')`);
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,timezone,risk_band,service_type,
     geofence_radius_meters,geofence_version,telemetry_mode,sensitivity_classification,environment,integrity_state,
     status,version,updated_by,created_at,updated_at)
    VALUES ('SITE-1','CL-1','BK-1','Fixture Site','Johannesburg','Fixture address',-26100000,28100000,
     'Africa/Johannesburg','Standard','Unarmed',120,1,'simulated','operational','production','production_verified',
     'active',3,'fixture',?,?)`, now, now);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,service_type,purpose_code,minimum_grade,post_orders_version,environment,integrity_state,
     status,created_at,updated_at)
    VALUES ('POST-1','SITE-1','BK-1','Gate','Unarmed','commercial_access','Grade C','PO-v4',
     'production','production_verified','active',?,?)`, now, now);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,environment,integrity_state,
     status,version,created_at,updated_at)
    VALUES ('SLOT-1','SITE-1','POST-1','BK-1','2039-12-25',?,?, '2039-12-25T17:45:00.000Z',
     '2039-12-25T18:10:00.000Z','production','production_verified','uncovered',1,?,?)`, startsAt, endsAt, now, now);
  run(database, `INSERT INTO booking_funding_reconciliations
    (id,booking_id,environment,integrity_state,provider,provider_reference,currency,expected_amount_cents,cleared_amount_cents,status,
     cleared_at,reconciled_at,evidence_reference,evidence_verified_at,evidence_expires_at,version,active_key,created_at)
    VALUES ('FR-1','BK-1','production','verified','bank_api','BANK-1','ZAR',350000,350000,'cleared_reconciled',?,?, 'bank:evidence',?,?,1,'BK-1',?)`, now, now, now, expiry, now);
  run(database, `INSERT INTO site_risk_assessments
    (id,site_id,risk_rules_version,risk_band,status,environment,integrity_state,evidence_reference,approved_by,approved_at,valid_from,expires_at,version,active_key,created_at)
    VALUES ('RISK-1','SITE-1','RISK-v3','Standard','approved','production','verified','risk:evidence','Approver',?,?,?,3,'SITE-1',?)`, now, now, expiry, now);
  run(database, `INSERT INTO post_order_approvals
    (id,post_id,post_orders_version,status,environment,integrity_state,evidence_reference,approved_by,approved_at,valid_from,expires_at,version,active_key,created_at)
    VALUES ('POA-1','POST-1','PO-v4','approved','production','verified','orders:evidence','Approver',?,?,?,4,'POST-1',?)`, now, now, expiry, now);
  run(database, `INSERT INTO workforce_employers
    (id,legal_name,employer_type,environment,psira_status,nbcpss_status,psspf_status,uif_status,coida_status,
     insurance_status,service_agreement_status,status,last_reviewed_at,review_due_at,version,created_at,updated_at)
    VALUES ('EMP-1','LOKD Security','lokd_employer','production','current','current','current','current','current',
     'current','current','current',?,?,5,?,?)`, now, expiry, now, now);
  for (const control of ["psira", "nbcpss", "psspf", "uif", "coida", "insurance", "service_agreement"]) run(database, `INSERT INTO employer_compliance_evidence
    (id,employer_id,control_code,status,environment,integrity_state,evidence_reference,verified_at,expires_at,version,active_key,created_at)
    VALUES (?,'EMP-1',?,'current','production','verified',?,?,?,1,?,?)`, `ECE-${control}`, control, `evidence:${control}`, now, expiry, `EMP-1:${control}`, now);
  seedOfficer(database, "OFF-1", "WE-1", "WTA-1");
  if (secondOfficer) seedOfficer(database, "OFF-2", "WE-2", "WTA-2");
}

function seedReliefReservation(database, {
  reliefId = "REL-1",
  slotId = "SLOT-REL-1",
  starts = "2039-12-26T14:00:00.000Z",
  ends = "2039-12-27T07:00:00.000Z",
} = {}) {
  const minutes = (new Date(ends).getTime() - new Date(starts).getTime()) / 60_000;
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
     environment,integrity_state,status,version,created_at,updated_at)
    VALUES (?,'SITE-1','POST-1','BK-1',?,?,?,?,?,'production','production_verified','relief_active',1,?,?)`,
    slotId, starts.slice(0, 10), starts, ends, starts, starts, now, now);
  run(database, `INSERT INTO relief_dispatches
    (id,roster_slot_id,site_id,replacement_officer_id,environment,integrity_state,active_key,status,
     reason_code,priority,requested_by,requested_at,response_due_at,version)
    VALUES (?,?,'SITE-1','OFF-1','production','production_verified',?,'case_open',
     'operations_contingency','P1','ops',?,?,1)`, reliefId, slotId, slotId, now, expiry);
  const localMonday = "2039-12-26";
  run(database, `INSERT INTO workforce_hour_reservations
    (id,relief_dispatch_id,officer_id,workforce_engagement_id,source_type,source_id,iso_week_start,iso_week_end,
     segment_starts_at,segment_ends_at,reserved_minutes,weekly_cap_minutes,status,active_key,created_at)
    VALUES (?,?, 'OFF-1','WE-1','relief',?,'2039-12-26','2040-01-01',?,?,?,1440,'active',?,?)`,
  `H-${reliefId}`, reliefId, reliefId, starts, ends, minutes, `OFF-1:${localMonday}:${reliefId}`, now);
  return { reliefId, slotId, minutes };
}

function moveCandidateToCheckInWindow(database) {
  const base = Math.ceil(Date.now() / 60_000) * 60_000;
  const starts = new Date(base + 10 * 60_000).toISOString();
  const ends = new Date(base + (12 * 60 + 10) * 60_000).toISOString();
  const economics = officerShiftEconomicsForRoster({
    serviceType: "Unarmed",
    riskBand: "Standard",
    engagementModel: "flex",
    serviceDate: starts.slice(0, 10),
    startsAt: starts,
  });
  assert.ok(economics);
  run(database, `UPDATE bookings SET calendar_category=?,calendar_label=?,officer_rate_cents=? WHERE id='BK-1'`,
    economics.calendarCategory, economics.calendarLabel, economics.officerOfferCents);
  run(database, `UPDATE roster_slots SET service_date=?,starts_at=?,ends_at=?,arrival_due_at=?,check_in_due_at=? WHERE id='SLOT-1'`,
    economics.serviceDate, starts, ends, starts, starts);
  run(database, `UPDATE officer_availability_windows SET starts_at=?,ends_at=? WHERE officer_id='OFF-1'`,
    new Date(base - 24 * 60 * 60_000).toISOString(), new Date(base + 48 * 60 * 60_000).toISOString());
  return { starts, ends };
}

function count(database, table) {
  return Number(database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count);
}

function evidenceRevision(database) {
  return Number(database.prepare(`SELECT revision FROM activation_evidence_epoch WHERE singleton=1`).get().revision);
}

async function passDueScheduledCheckpoints(db) {
  const results = await runDueAssignmentRevalidations(db, "system:assignment-revalidation");
  assert.deepEqual(results.map((item) => item.checkpoint), ["t_minus_24", "t_minus_2"]);
  assert.equal(results.every((item) => item.ready), true);
  return results;
}

function insertCopiedRevalidationToken(database, id, checkpoint, evaluatedAt = new Date().toISOString()) {
  return run(database, `INSERT INTO assignment_evidence_tokens
    (id,command_id,checkpoint,source_revision,evaluation_hash,evaluated_at,roster_slot_id,officer_id,
     expected_slot_version,environment,funding_evidence,site_evidence,launch_evidence,officer_evidence,
     employer_evidence,schedule_evidence,created_at)
    SELECT ?,token.command_id,?,epoch.revision,token.evaluation_hash,?,token.roster_slot_id,token.officer_id,
      rs.version,'production',token.funding_evidence,token.site_evidence,token.launch_evidence,
      token.officer_evidence,token.employer_evidence,token.schedule_evidence,?
    FROM assignment_evidence_tokens token
    JOIN assignment_activation_commands c ON c.id=token.command_id
    JOIN roster_slots rs ON rs.id=c.roster_slot_id
    JOIN activation_evidence_epoch epoch ON epoch.singleton=1
    WHERE token.checkpoint='activation' LIMIT 1`, id, checkpoint, evaluatedAt, evaluatedAt);
}

const request = (key = "activation:test:one", officerId = "OFF-1") => ({
  rosterSlotId: "SLOT-1",
  officerId,
  expectedSlotVersion: 1,
  activationKey: key,
  environment: "production",
  checkpoint: "activation",
});

test("evaluation retries a torn fact read and returns the current source revision", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const initialRevision = evidenceRevision(database);
  const db = new FactReadMutationAdapter(database, 1);

  const evaluation = await evaluateAssignmentActivation(
    db,
    request("activation:stable-read-retry"),
  );

  assert.equal(db.mutationCount, 1);
  assert.ok(evaluation.sourceRevision > initialRevision);
  assert.equal(evaluation.sourceRevision, evidenceRevision(database));
  assert.equal(evaluation.facts.launchGates.find(
    (gate) => gate.code === "G2_CONTROL_ROOM_INSPECTION",
  )?.version, 2);
  assert.equal(count(database, "assignment_activation_commands"), 0);
  database.close();
});

test("evaluation fails closed after three unstable fact reads without creating a command", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new FactReadMutationAdapter(database, 3);

  await assert.rejects(
    () => evaluateAssignmentActivation(db, request("activation:stable-read-exhausted")),
    (error) => {
      assert.equal(error.status, 409);
      assert.match(error.message, /facts changed during evaluation; retry/i);
      return true;
    },
  );

  assert.equal(db.mutationCount, 3);
  assert.equal(count(database, "assignment_activation_commands"), 0);
  assert.equal(count(database, "assignment_activation_decisions"), 0);
  database.close();
});

test("successful activation creates every final record exactly once and is idempotent", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  const first = await activateAssignment(db, request(), "ops@example.test");
  assert.equal(first.state, "activated");
  assert.equal(count(database, "assignment_activation_commands"), 1);
  assert.equal(count(database, "assignment_activation_decisions"), 2);
  assert.equal(count(database, "assignment_activation_blockers"), 0);
  assert.equal(count(database, "roster_assignments"), 1);
  assert.equal(count(database, "shifts"), 1);
  assert.equal(count(database, "assignment_activation_snapshots"), 1);
  assert.equal(count(database, "assignment_workforce_snapshots"), 1);
  assert.equal(count(database, "assignment_evidence_tokens"), 1);
  assert.equal(count(database, "workforce_hour_reservations"), 2);
  assert.equal(count(database, "assignment_revalidations"), 3);
  assert.deepEqual({ ...database.prepare(`SELECT workforce_model AS workforceModel,employer_legal_name AS employerName,
    terms_version AS termsVersion,pricing_version AS pricingVersion,ordinary_wage_cents AS ordinaryWageCents,
    holiday_premium_cents AS holidayPremiumCents,statutory_cost_cents AS statutoryCostCents,
    funded_offer_cents AS fundedOfferCents,reserved_minutes AS reservedMinutes,evidence_valid_through AS validThrough,
    final,integrity_state AS integrityState FROM assignment_activation_snapshots`).get() }, {
    workforceModel: "direct_flex",
    employerName: "LOKD Security",
    termsVersion: "TERMS-v1",
    pricingVersion: "LOKD-PREMIUM-2026.09",
    ordinaryWageCents: 80000,
    holidayPremiumCents: 120000,
    statutoryCostCents: 30000,
    fundedOfferCents: 200000,
    reservedMinutes: 720,
    validThrough: endsAt,
    final: 1,
    integrityState: "production_verified",
  });
  assert.deepEqual(database.prepare(`SELECT iso_week_start AS week, reserved_minutes AS minutes FROM workforce_hour_reservations ORDER BY iso_week_start`).all()
    .map((row) => ({ ...row })), [
    { week: "2039-12-19", minutes: 240 },
    { week: "2039-12-26", minutes: 480 },
  ]);
  const token = database.prepare(`SELECT source_revision AS sourceRevision, funding_evidence AS fundingEvidence,
    site_evidence AS siteEvidence, employer_evidence AS employerEvidence, schedule_evidence AS scheduleEvidence
    FROM assignment_evidence_tokens WHERE checkpoint='activation'`).get();
  assert.ok(Number(token.sourceRevision) > 0);
  assert.equal(JSON.parse(token.fundingEvidence).reconciliationId, "FR-1");
  assert.equal(JSON.parse(token.siteEvidence).induction.id, "IND-OFF-1");
  assert.ok(JSON.parse(token.employerEvidence).employer.evidence.some((item) => item.id === "ECE-psira"));
  assert.equal(JSON.parse(token.scheduleEvidence).availability.id, "AV-OFF-1");
  assert.equal(JSON.parse(token.scheduleEvidence).declaration.id, "OSD-OFF-1");
  const snapshotEvidence = database.prepare(`SELECT funding_evidence AS fundingEvidence,
    site_evidence AS siteEvidence, employer_evidence AS employerEvidence, schedule_evidence AS scheduleEvidence
    FROM assignment_activation_snapshots`).get();
  assert.deepEqual({ ...snapshotEvidence }, {
    fundingEvidence: token.fundingEvidence,
    siteEvidence: token.siteEvidence,
    employerEvidence: token.employerEvidence,
    scheduleEvidence: token.scheduleEvidence,
  });
  const repeated = await activateAssignment(db, request(), "ops@example.test");
  assert.equal(repeated.id, first.id);
  assert.equal(count(database, "assignment_activation_snapshots"), 1);
  database.close();
});

test("Christmas work stored as ordinary is blocked and server-prices the Christmas wage", async () => {
  const database = migratedDatabase();
  seedValid(database);
  run(database, `UPDATE bookings SET calendar_category='ordinary',calendar_label='Ordinary Monday-Saturday',
    officer_rate_cents=80000 WHERE id='BK-1'`);
  const db = new D1Adapter(database);
  const evaluation = await evaluateAssignmentActivation(db, request("activation:calendar-christmas-as-ordinary"));
  assert.equal(evaluation.facts.compensation.storedCalendarCategory, "ordinary");
  assert.equal(evaluation.facts.compensation.calendarCategory, "christmas");
  assert.equal(evaluation.facts.compensation.ordinaryWageCents, 80000);
  assert.equal(evaluation.facts.compensation.holidayPremiumCents, 120000);
  assert.equal(evaluation.facts.compensation.officerOfferCents, 200000);
  assert.ok(evaluation.result.blockers.some((blocker) => blocker.code === "CALENDAR_CATEGORY_MISMATCH"));
  assert.ok(evaluation.result.blockers.some((blocker) => blocker.code === "STORED_OFFICER_OFFER_MISMATCH"));
  const saved = await recordAssignmentActivationEvaluation(db, request("activation:calendar-christmas-as-ordinary"), "ops@example.test");
  assert.equal(saved.state, "blocked");
  assert.equal(count(database, "assignment_activation_snapshots"), 0);
  database.close();
});

test("ordinary work stored as Christmas is blocked and server-prices the ordinary wage", async () => {
  const database = migratedDatabase();
  seedValid(database);
  run(database, `UPDATE roster_slots SET service_date='2040-01-03',starts_at='2040-01-03T06:00:00.000Z',
    ends_at='2040-01-03T18:00:00.000Z',arrival_due_at='2040-01-03T05:45:00.000Z',
    check_in_due_at='2040-01-03T06:10:00.000Z' WHERE id='SLOT-1'`);
  const db = new D1Adapter(database);
  const evaluation = await evaluateAssignmentActivation(db, request("activation:calendar-ordinary-as-christmas"));
  assert.equal(evaluation.facts.compensation.storedCalendarCategory, "christmas");
  assert.equal(evaluation.facts.compensation.calendarCategory, "ordinary");
  assert.equal(evaluation.facts.compensation.ordinaryWageCents, 80000);
  assert.equal(evaluation.facts.compensation.holidayPremiumCents, 0);
  assert.equal(evaluation.facts.compensation.officerOfferCents, 80000);
  assert.ok(evaluation.result.blockers.some((blocker) => blocker.code === "CALENDAR_CATEGORY_MISMATCH"));
  assert.ok(evaluation.result.blockers.some((blocker) => blocker.code === "STORED_OFFICER_OFFER_MISMATCH"));
  const saved = await recordAssignmentActivationEvaluation(db, request("activation:calendar-ordinary-as-christmas"), "ops@example.test");
  assert.equal(saved.state, "blocked");
  assert.equal(count(database, "assignment_activation_snapshots"), 0);
  database.close();
});

test("the database rejects a roster service date differing from the Johannesburg start date", () => {
  const database = migratedDatabase();
  seedValid(database);
  assert.throws(() => run(database, `UPDATE roster_slots SET service_date='2039-12-24' WHERE id='SLOT-1'`),
    /production_roster_service_date_invalid/);
  assert.equal(database.prepare(`SELECT service_date AS serviceDate FROM roster_slots WHERE id='SLOT-1'`).get().serviceDate,
    "2039-12-25");
  database.close();
});

test("a saved Ready evaluation activates with the same idempotency key exactly once", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  const activationRequest = request("activation:evaluated-ready");
  const evaluated = await recordAssignmentActivationEvaluation(db, activationRequest, "ops@example.test");
  assert.equal(evaluated.state, "ready");
  assert.equal(database.prepare(`SELECT integrity_state AS integrity FROM assignment_activation_commands`).get().integrity, "production_candidate");
  const activated = await activateAssignment(db, activationRequest, "ops@example.test");
  assert.equal(activated.state, "activated");
  assert.equal(count(database, "assignment_activation_commands"), 1);
  assert.equal(count(database, "assignment_activation_decisions"), 2);
  assert.equal(count(database, "assignment_activation_snapshots"), 1);
  database.close();
});

test("concurrent duplicate activation keys converge on one complete activation", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new SameKeyEvaluationBarrierAdapter(database);
  const activationRequest = request("activation:concurrent-same-key");
  const results = await Promise.all([
    activateAssignment(db, activationRequest, "ops:first@example.test"),
    activateAssignment(db, activationRequest, "ops:second@example.test"),
  ]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(results[0].state, "activated");
  assert.equal(results[1].state, "activated");
  for (const table of ["assignment_activation_commands", "roster_assignments", "shifts",
    "assignment_activation_snapshots", "assignment_workforce_snapshots"]) {
    assert.equal(count(database, table), 1, table);
  }
  assert.equal(count(database, "assignment_evidence_tokens"), 1);
  assert.equal(count(database, "assignment_revalidations"), 3);
  database.close();
});

test("same idempotency key with a different request is rejected without new records", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  await activateAssignment(db, request(), "ops@example.test");
  await assert.rejects(() => activateAssignment(db, { ...request(), officerId: "OFF-X" }, "ops@example.test"), /different request/i);
  assert.equal(count(database, "assignment_activation_commands"), 1);
  database.close();
});

test("a TOCTOU gate change aborts the entire activation batch", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database, () => {
    database.prepare(`UPDATE launch_controls SET status='pending' WHERE code='G2_CONTROL_ROOM_INSPECTION'`).run();
  });
  await assert.rejects(() => activateAssignment(db, request("activation:rollback"), "ops@example.test"), /rolled back|required launch gate/i);
  for (const table of ["roster_assignments", "shifts", "assignment_activation_snapshots",
    "assignment_workforce_snapshots", "assignment_evidence_tokens",
    "workforce_hour_reservations", "assignment_revalidations"]) assert.equal(count(database, table), 0, table);
  assert.equal(count(database, "assignment_activation_commands"), 1);
  assert.equal(count(database, "assignment_activation_decisions"), 2);
  assert.equal(count(database, "assignment_activation_blockers"), 1);
  assert.deepEqual({ ...database.prepare(`SELECT state,roster_assignment_id AS assignmentId,shift_id AS shiftId FROM assignment_activation_commands`).get() },
    { state: "blocked", assignmentId: null, shiftId: null });
  database.close();
});

test("concurrent claims for one slot produce exactly one activated assignment", async () => {
  const database = migratedDatabase();
  seedValid(database, true);
  const db = new D1Adapter(database);
  const results = await Promise.allSettled([
    activateAssignment(db, request("activation:race:one", "OFF-1"), "ops@example.test"),
    activateAssignment(db, request("activation:race:two", "OFF-2"), "ops@example.test"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(count(database, "assignment_activation_snapshots"), 1);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM roster_assignments WHERE active_key='SLOT-1'`).get().count), 1);
  database.close();
});

test("simultaneous different-slot claims cannot violate one officer's rest window", async () => {
  const database = migratedDatabase();
  seedValid(database);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
     environment,integrity_state,status,version,created_at,updated_at)
    SELECT 'SLOT-2',site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
      environment,integrity_state,'uncovered',1,created_at,updated_at
    FROM roster_slots WHERE id='SLOT-1'`);
  const db = new D1Adapter(database);
  const results = await Promise.allSettled([
    activateAssignment(db, request("activation:officer-race:one"), "ops@example.test"),
    activateAssignment(db, { ...request("activation:officer-race:two"), rosterSlotId: "SLOT-2" }, "ops@example.test"),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(count(database, "assignment_activation_snapshots"), 1);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM roster_assignments WHERE active_key IS NOT NULL`).get().count), 1);
  database.close();
});

test("stale concurrent Direct Flex activations cannot exceed the same-week ceiling", async () => {
  const database = migratedDatabase();
  seedValid(database);
  run(database, `UPDATE workforce_engagements SET weekly_hour_cap=10 WHERE id='WE-1'`);
  run(database, `UPDATE bookings SET start_date='2040-01-03',end_date='2040-01-05',
    shift_start='08:00',shift_end='14:00',calendar_category='ordinary',calendar_label='Ordinary Monday-Saturday',
    officer_rate_cents=80000 WHERE id='BK-1'`);
  run(database, `UPDATE roster_slots SET service_date='2040-01-03',
    starts_at='2040-01-03T06:00:00.000Z',ends_at='2040-01-03T12:00:00.000Z',
    arrival_due_at='2040-01-03T05:45:00.000Z',check_in_due_at='2040-01-03T06:10:00.000Z'
    WHERE id='SLOT-1'`);
  run(database, `UPDATE officer_availability_windows SET ends_at='2040-01-10T00:00:00.000Z'
    WHERE officer_id='OFF-1'`);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
     environment,integrity_state,status,version,created_at,updated_at)
    VALUES ('SLOT-2','SITE-1','POST-1','BK-1','2040-01-05','2040-01-05T06:00:00.000Z',
     '2040-01-05T12:00:00.000Z','2040-01-05T05:45:00.000Z','2040-01-05T06:10:00.000Z',
     'production','production_verified','uncovered',1,?,?)`, now, now);

  const db = new TwoActivationBarrierAdapter(database);
  const results = await Promise.allSettled([
    activateAssignment(db, request("activation:weekly-race:one"), "ops@example.test"),
    activateAssignment(db, { ...request("activation:weekly-race:two"), rosterSlotId: "SLOT-2" }, "ops@example.test"),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.match(String(rejected[0].reason), /weekly|ceiling|rolled back/i);

  assert.deepEqual(database.prepare(`SELECT state,COUNT(*) AS count FROM assignment_activation_commands
    GROUP BY state ORDER BY state`).all().map((row) => ({ ...row })), [
    { state: "activated", count: 1 },
    { state: "blocked", count: 1 },
  ]);
  assert.deepEqual({ ...database.prepare(`SELECT roster_assignment_id AS assignmentId,shift_id AS shiftId
    FROM assignment_activation_commands WHERE state='blocked'`).get() }, { assignmentId: null, shiftId: null });
  assert.equal(database.prepare(`SELECT code FROM assignment_activation_blockers`).get().code, "WEEKLY_HOUR_CAP_CONFLICT");
  assert.equal(count(database, "roster_assignments"), 1);
  assert.equal(count(database, "shifts"), 1);
  assert.equal(count(database, "assignment_activation_snapshots"), 1);
  assert.equal(count(database, "assignment_revalidations"), 3);
  assert.deepEqual({ ...database.prepare(`SELECT COUNT(*) AS count,SUM(reserved_minutes) AS minutes,
    MAX(weekly_cap_minutes) AS cap FROM workforce_hour_reservations WHERE status='active'`).get() },
  { count: 1, minutes: 360, cap: 600 });
  database.close();
});

for (const route of ["managed", "partner"]) {
  test(`${route} activation freezes the correct employer and payroll route`, async () => {
    const database = migratedDatabase();
    seedValid(database);
    if (route === "managed") {
      run(database, `UPDATE workforce_engagements SET model='managed',weekly_hour_cap=NULL WHERE id='WE-1'`);
    } else {
      run(database, `UPDATE workforce_engagements SET model='partner',weekly_hour_cap=NULL,
        payroll_status='partner_confirmed',benefits_status='partner_confirmed' WHERE id='WE-1'`);
      run(database, `UPDATE workforce_employers SET employer_type='partner_company',legal_name='Approved Partner Security' WHERE id='EMP-1'`);
    }
    const db = new D1Adapter(database);
    const activated = await activateAssignment(db, request(`activation:${route}`), "ops@example.test");
    assert.equal(activated.state, "activated");
    const snapshot = database.prepare(`SELECT workforce_model AS model,employer_legal_name AS employer,
      statutory_cost_cents AS statutoryCost FROM assignment_activation_snapshots`).get();
    assert.equal(snapshot.model, route);
    assert.equal(snapshot.employer, route === "partner" ? "Approved Partner Security" : "LOKD Security");
    assert.equal(snapshot.statutoryCost, route === "partner" ? 0 : 30000);
    assert.equal(count(database, "workforce_hour_reservations"), 0);
    database.close();
  });
}

test("synthetic commands cannot invoke production activation", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  await assert.rejects(() => activateAssignment(db, { ...request("activation:demo-rejected"), environment: "demo_synthetic" }, "ops@example.test"), /synthetic demo/i);
  assert.equal(count(database, "assignment_activation_commands"), 0);
  assert.equal(count(database, "roster_assignments"), 0);
  database.close();
});

test("a production candidate command cannot reference synthetic client, booking, site, post or slot records", () => {
  const database = migratedDatabase();
  seedValid(database);
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-DEMO-CANDIDATE','Synthetic Client','Demo Contact','demo@example.test','approved','demo','synthetic')`);
  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,
     shift_start,shift_end,client_price_cents,officer_rate_cents,environment,integrity_state,funding_status,release_cadence,status)
    VALUES ('BK-DEMO-CANDIDATE','CL-DEMO-CANDIDATE','Synthetic Site','Johannesburg','Gate','Unarmed','Grade C',0,
     '2040-01-01','2040-01-01','08:00','20:00',140000,80000,'demo','synthetic','paid_in_full','Weekly','matching')`);
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,environment,integrity_state)
    VALUES ('SITE-DEMO-CANDIDATE','CL-DEMO-CANDIDATE','BK-DEMO-CANDIDATE','Synthetic Site','Johannesburg',
     'Demo address',-26100000,28100000,'demo','synthetic')`);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,environment,integrity_state)
    VALUES ('POST-DEMO-CANDIDATE','SITE-DEMO-CANDIDATE','BK-DEMO-CANDIDATE','Gate','demo','synthetic')`);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
     environment,integrity_state,status,version)
    VALUES ('SLOT-DEMO-CANDIDATE','SITE-DEMO-CANDIDATE','POST-DEMO-CANDIDATE','BK-DEMO-CANDIDATE','2040-01-01',
     '2040-01-01T06:00:00.000Z','2040-01-01T18:00:00.000Z','2040-01-01T05:45:00.000Z',
     '2040-01-01T06:10:00.000Z','demo','synthetic','uncovered',1)`);

  const insertCommand = (id, environment, integrityState) => run(database, `INSERT INTO assignment_activation_commands
    (id,activation_key,request_hash,roster_slot_id,officer_id,expected_slot_version,environment,integrity_state,
     state,roster_assignment_id,shift_id,requested_by,requested_at,completed_at,version)
    VALUES (?,?,?,?, 'OFF-1',1,?,?, 'ready',NULL,NULL,'ops@example.test',?,?,1)`,
  id, `key:${id}`, `hash:${id}`, "SLOT-DEMO-CANDIDATE", environment, integrityState, now, now);

  assert.throws(
    () => insertCommand("AC-PROD-DEMO-BASE", "production", "production_candidate"),
    /production_activation_command_base_provenance_invalid/,
  );
  insertCommand("AC-SYNTHETIC-DEMO-BASE", "demo_synthetic", "synthetic_demo_only");
  assert.deepEqual({ ...database.prepare(`SELECT environment,integrity_state AS integrityState
    FROM assignment_activation_commands`).get() }, {
    environment: "demo_synthetic",
    integrityState: "synthetic_demo_only",
  });
  database.close();
});

for (const [label, mutation] of [
  ["funding clearing provenance", `UPDATE booking_funding_reconciliations SET cleared_at=NULL WHERE id='FR-1'`],
  ["officer grade", `UPDATE officers SET psira_grade='Grade E' WHERE id='OFF-1'`],
  ["Passport environment", `UPDATE officer_passports SET environment='demo',integrity_state='synthetic' WHERE officer_id='OFF-1'`],
]) {
  test(`commit-time ${label} mutation rolls the activation back completely`, async () => {
    const database = migratedDatabase();
    seedValid(database);
    const db = new D1Adapter(database, () => run(database, mutation));
    await assert.rejects(() => activateAssignment(db, request(`activation:toctou:${label.replaceAll(" ", "-")}`), "ops@example.test"), /rolled back/i);
    for (const table of ["roster_assignments", "shifts", "assignment_activation_snapshots",
      "assignment_workforce_snapshots", "assignment_evidence_tokens",
      "workforce_hour_reservations", "assignment_revalidations"]) {
      assert.equal(count(database, table), 0, table);
    }
    assert.equal(database.prepare(`SELECT state FROM assignment_activation_commands`).get().state, "blocked");
    assert.equal(count(database, "assignment_activation_blockers"), 1);
    database.close();
  });
}

test("relief reservations are included in the weekly ceiling", async () => {
  const database = migratedDatabase();
  seedValid(database);
  seedReliefReservation(database);
  const db = new D1Adapter(database);
  await assert.rejects(() => activateAssignment(db, request("activation:relief-cap"), "ops@example.test"), /weekly|ceiling|reserve/i);
  assert.equal(Number(database.prepare(`SELECT SUM(reserved_minutes) AS minutes FROM workforce_hour_reservations WHERE status='active'`).get().minutes), 1020);
  assert.equal(count(database, "assignment_activation_snapshots"), 0);
  database.close();
});

test("completed relief stays counted while cancelled relief releases hours", () => {
  const completed = migratedDatabase();
  seedValid(completed);
  seedReliefReservation(completed, { reliefId: "REL-CLOSED", slotId: "SLOT-REL-CLOSED",
    starts: "2039-12-26T14:00:00.000Z", ends: "2039-12-26T18:00:00.000Z" });
  run(completed, `UPDATE relief_dispatches SET status='closed',active_key=NULL,closed_at=?,version=version+1 WHERE id='REL-CLOSED'`, now);
  assert.equal(Number(completed.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations WHERE status='active'`).get().count), 1);
  completed.close();

  const cancelled = migratedDatabase();
  seedValid(cancelled);
  seedReliefReservation(cancelled, { reliefId: "REL-CANCEL", slotId: "SLOT-REL-CANCEL",
    starts: "2039-12-26T14:00:00.000Z", ends: "2039-12-26T18:00:00.000Z" });
  run(cancelled, `UPDATE relief_dispatches SET status='cancelled',active_key=NULL,closed_at=?,version=version+1 WHERE id='REL-CANCEL'`, now);
  assert.deepEqual({ ...cancelled.prepare(`SELECT status,release_reason AS reason FROM workforce_hour_reservations`).get() },
    { status: "released", reason: "relief_cancelled" });
  cancelled.close();
});

test("cancellation releases reservations without deleting their history", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:cancel"), "ops@example.test");
  await releaseAssignmentHourReservations(db, activated.rosterAssignmentId, "cancelled", "ops@example.test");
  assert.equal(count(database, "workforce_hour_reservations"), 2);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations WHERE status='active'`).get().count), 0);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations WHERE status='released' AND release_reason='assignment_cancelled'`).get().count), 2);
  assert.equal(database.prepare(`SELECT status FROM shifts WHERE id=?`).get(activated.shiftId).status, "cancelled");
  assert.equal(count(database, "audit_events"), 1);
  await assert.rejects(() => revalidateAssignment(db, activated.shiftId, "t_minus_24", "ops@example.test"), /cancelled|released|active assignment/i);
  database.close();
});

test("replacement releases reservations without deleting their history", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:replace"), "ops@example.test");
  await releaseAssignmentHourReservations(db, activated.rosterAssignmentId, "replaced", "ops@example.test");
  assert.equal(count(database, "workforce_hour_reservations"), 2);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations WHERE status='active'`).get().count), 0);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations
    WHERE status='released' AND release_reason='assignment_replaced'`).get().count), 2);
  assert.deepEqual({ ...database.prepare(`SELECT status,active_key AS activeKey FROM roster_assignments
    WHERE id=?`).get(activated.rosterAssignmentId) }, { status: "replaced", activeKey: null });
  assert.equal(database.prepare(`SELECT status FROM shifts WHERE id=?`).get(activated.shiftId).status, "cancelled");
  assert.equal(count(database, "assignment_activation_snapshots"), 1);
  database.close();
});

test("on-post, completed and verified work cannot be released or lose reserved hours", async () => {
  const database = migratedDatabase();
  seedValid(database);
  moveCandidateToCheckInWindow(database);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:late-release"), "ops@example.test");
  const activeReservationCount = Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations
    WHERE roster_assignment_id=? AND status='active'`).get(activated.rosterAssignmentId).count);
  assert.ok(activeReservationCount > 0);
  const assertProtected = (shiftStatus) => {
    assert.deepEqual({ ...database.prepare(`SELECT status,active_key AS activeKey,released_at AS releasedAt
      FROM roster_assignments WHERE id=?`).get(activated.rosterAssignmentId) }, {
      status: "confirmed",
      activeKey: "SLOT-1",
      releasedAt: null,
    });
    assert.equal(database.prepare(`SELECT status FROM shifts WHERE id=?`).get(activated.shiftId).status, shiftStatus);
    assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations
      WHERE roster_assignment_id=? AND status='active'`).get(activated.rosterAssignmentId).count), activeReservationCount);
  };

  await passDueScheduledCheckpoints(db);
  const checkIn = await revalidateAssignment(db, activated.shiftId, "check_in", "officer@example.test", true);
  assert.equal(checkIn.ready, true);
  await assert.rejects(
    () => releaseAssignmentHourReservations(db, activated.rosterAssignmentId, "cancelled", "ops@example.test"),
    /current state/i,
  );
  assertProtected("on_post");

  const completedAt = new Date().toISOString();
  run(database, `UPDATE shifts SET status='completed',check_out_at=?,client_signoff_status='pending'
    WHERE id=?`, completedAt, activated.shiftId);
  await assert.rejects(
    () => releaseAssignmentHourReservations(db, activated.rosterAssignmentId, "replaced", "ops@example.test"),
    /current state/i,
  );
  assertProtected("completed");

  const signedOffAt = new Date(Date.now() + 1_000).toISOString();
  run(database, `UPDATE shifts SET status='verified',client_signoff_status='approved',signed_off_at=?
    WHERE id=?`, signedOffAt, activated.shiftId);
  await assert.rejects(
    () => releaseAssignmentHourReservations(db, activated.rosterAssignmentId, "released", "ops@example.test"),
    /current state/i,
  );
  assertProtected("verified");
  assert.equal(count(database, "audit_events"), 0);
  database.close();
});

test("active reservations cannot be released while their assignment source remains active", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:raw-hour-release"), "ops@example.test");
  const reservationId = database.prepare(`SELECT id FROM workforce_hour_reservations
    WHERE roster_assignment_id=? ORDER BY id LIMIT 1`).get(activated.rosterAssignmentId).id;

  assert.throws(() => run(database, `UPDATE workforce_hour_reservations
    SET status='released',active_key=NULL,released_at=?,release_reason='assignment_cancelled'
    WHERE id=?`, new Date().toISOString(), reservationId), /hour_reservation_release_source_invalid/);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations
    WHERE roster_assignment_id=? AND status='active'`).get(activated.rosterAssignmentId).count), 2);
  database.close();
});

test("a terminal activated assignment cannot be resurrected after its hours are released", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:no-resurrection"), "ops@example.test");
  await releaseAssignmentHourReservations(db, activated.rosterAssignmentId, "cancelled", "ops@example.test");

  assert.throws(() => run(database, `UPDATE roster_assignments
    SET status='confirmed',active_key=roster_slot_id,released_at=NULL,version=version+1 WHERE id=?`,
  activated.rosterAssignmentId), /activated_assignment_lifecycle_invalid/);
  assert.deepEqual({ ...database.prepare(`SELECT status,active_key AS activeKey FROM roster_assignments
    WHERE id=?`).get(activated.rosterAssignmentId) }, { status: "cancelled", activeKey: null });
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations
    WHERE roster_assignment_id=? AND status='released'`).get(activated.rosterAssignmentId).count), 2);
  database.close();
});

test("final snapshots and decisions reject updates and deletes", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  await activateAssignment(db, request("activation:immutable"), "ops@example.test");
  assert.throws(() => run(database, `UPDATE assignment_activation_snapshots SET employer_legal_name='Changed'`), /activation_snapshots_immutable/);
  assert.throws(() => run(database, `DELETE FROM assignment_activation_snapshots`), /activation_snapshots_immutable/);
  assert.throws(() => run(database, `UPDATE assignment_activation_decisions SET summary='Changed'`), /activation_decisions_append_only/);
  assert.throws(() => run(database, `DELETE FROM assignment_activation_decisions`), /activation_decisions_append_only/);
  database.close();
});

test("evidence tokens reject updates and deletes", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  await activateAssignment(db, request("activation:immutable-evidence-token"), "ops@example.test");

  const token = database.prepare(`SELECT id FROM assignment_evidence_tokens LIMIT 1`).get();
  assert.ok(token?.id);
  assert.throws(() => run(database, `UPDATE assignment_evidence_tokens
    SET funding_evidence='{}' WHERE id=?`, token.id), /assignment_evidence_tokens_append_only/);
  assert.throws(() => run(database, `DELETE FROM assignment_evidence_tokens WHERE id=?`, token.id),
    /assignment_evidence_tokens_append_only/);
  assert.equal(count(database, "assignment_evidence_tokens"), 1);
  database.close();
});

for (const [checkpoint, transitionCheckIn] of [
  ["t_minus_24", false],
  ["t_minus_2", false],
  ["check_in", true],
]) {
  test(`${checkpoint} rejects a stale evidence token and records the authoritative blocker on retry`, async () => {
    const database = migratedDatabase();
    seedValid(database);
    moveCandidateToCheckInWindow(database);
    const db = new D1Adapter(database);
    const activated = await activateAssignment(
      db,
      request(`activation:revalidation-token:${checkpoint}`),
      "ops@example.test",
    );
    if (checkpoint === "t_minus_2") {
      const prerequisite = await revalidateAssignment(
        db,
        activated.shiftId,
        "t_minus_24",
        "system:assignment-revalidation",
      );
      assert.equal(prerequisite.ready, true);
    } else if (checkpoint === "check_in") {
      await passDueScheduledCheckpoints(db);
    }
    const before = {
      decisions: count(database, "assignment_activation_decisions"),
      blockers: count(database, "assignment_activation_blockers"),
      tokens: count(database, "assignment_evidence_tokens"),
    };

    db.beforeBatch = () => run(database, `UPDATE officer_passports
      SET status='suspended' WHERE officer_id='OFF-1'`);
    await assert.rejects(
      () => revalidateAssignment(db, activated.shiftId, checkpoint, "ops@example.test", transitionCheckIn),
      /facts changed before commit|revalidation remains pending/i,
    );

    assert.deepEqual({ ...database.prepare(`SELECT rv.status,rv.decision_id AS decisionId,
      rv.evaluated_at AS evaluatedAt FROM assignment_revalidations rv
      JOIN assignment_activation_snapshots snap ON snap.id=rv.snapshot_id
      WHERE snap.shift_id=? AND rv.checkpoint=?`).get(activated.shiftId, checkpoint) }, {
      status: "pending",
      decisionId: null,
      evaluatedAt: null,
    });
    assert.deepEqual({ ...database.prepare(`SELECT status,check_in_at AS checkInAt
      FROM shifts WHERE id=?`).get(activated.shiftId) }, { status: "confirmed", checkInAt: null });
    assert.equal(count(database, "assignment_activation_decisions"), before.decisions);
    assert.equal(count(database, "assignment_activation_blockers"), before.blockers);
    assert.equal(count(database, "assignment_evidence_tokens"), before.tokens);

    const retry = await revalidateAssignment(
      db,
      activated.shiftId,
      checkpoint,
      "ops@example.test",
      transitionCheckIn,
    );
    assert.equal(retry.ready, false);
    assert.equal(retry.idempotent, false);
    assert.deepEqual({ ...database.prepare(`SELECT rv.status,b.code
      FROM assignment_revalidations rv
      JOIN assignment_activation_snapshots snap ON snap.id=rv.snapshot_id
      JOIN assignment_activation_decisions d ON d.id=rv.decision_id
      JOIN assignment_activation_blockers b ON b.decision_id=d.id
      WHERE snap.shift_id=? AND rv.checkpoint=?`).get(activated.shiftId, checkpoint) }, {
      status: "failed",
      code: "PASSPORT_NOT_CURRENT",
    });
    assert.equal(count(database, "assignment_activation_decisions"), before.decisions + 1);
    assert.equal(count(database, "assignment_activation_blockers"), before.blockers + 1);
    assert.equal(count(database, "assignment_evidence_tokens"), before.tokens + 1);
    assert.deepEqual({ ...database.prepare(`SELECT status,check_in_at AS checkInAt
      FROM shifts WHERE id=?`).get(activated.shiftId) }, { status: "confirmed", checkInAt: null });
    database.close();
  });
}

test("revalidations reject early execution and the due runner processes T-24 and T-2 once", async () => {
  const database = migratedDatabase();
  seedValid(database);
  run(database, `UPDATE workforce_engagements SET weekly_hour_cap=12 WHERE id='WE-1'`);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:revalidation"), "ops@example.test");
  await assert.rejects(() => revalidateAssignment(db, activated.shiftId, "t_minus_24", "ops@example.test"), /not due/i);
  database.close();

  const dueDatabase = migratedDatabase();
  seedValid(dueDatabase);
  run(dueDatabase, `UPDATE workforce_engagements SET weekly_hour_cap=12 WHERE id='WE-1'`);
  moveCandidateToCheckInWindow(dueDatabase);
  const dueDb = new D1Adapter(dueDatabase);
  const dueActivation = await activateAssignment(dueDb, request("activation:due-runner"), "ops@example.test");
  await passDueScheduledCheckpoints(dueDb);
  assert.equal((await revalidateAssignment(dueDb, dueActivation.shiftId, "t_minus_24", "ops@example.test")).idempotent, true);
  assert.equal((await runDueAssignmentRevalidations(dueDb, "system:assignment-revalidation")).length, 0);
  run(dueDatabase, `UPDATE officer_passports SET status='suspended' WHERE officer_id='OFF-1'`);
  const checkIn = await revalidateAssignment(dueDb, dueActivation.shiftId, "check_in", "officer@example.test", true);
  assert.equal(checkIn.ready, false);
  assert.deepEqual({ ...dueDatabase.prepare(`SELECT status,check_in_at AS checkInAt FROM shifts WHERE id=?`).get(dueActivation.shiftId) },
    { status: "confirmed", checkInAt: null });
  assert.equal(Number(dueDatabase.prepare(`SELECT COUNT(*) AS count FROM assignment_activation_blockers b JOIN assignment_activation_decisions d ON d.id=b.decision_id WHERE d.checkpoint='check_in'`).get().count) > 0, true);
  dueDatabase.close();
});

test("T-2 and check-in fail closed while their scheduled prerequisites remain pending", async () => {
  const database = migratedDatabase();
  seedValid(database);
  moveCandidateToCheckInWindow(database);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:pending-prerequisites"), "ops@example.test");
  const before = {
    decisions: count(database, "assignment_activation_decisions"),
    blockers: count(database, "assignment_activation_blockers"),
    tokens: count(database, "assignment_evidence_tokens"),
  };

  await assert.rejects(
    () => revalidateAssignment(db, activated.shiftId, "t_minus_2", "system:assignment-revalidation"),
    /T−24 revalidation must pass before T−2/i,
  );
  await assert.rejects(
    () => revalidateAssignment(db, activated.shiftId, "check_in", "officer@example.test", true),
    /T−24 and T−2 revalidation must pass before check-in/i,
  );
  assert.throws(
    () => insertCopiedRevalidationToken(database, "AET-DIRECT-PENDING-T2", "t_minus_2"),
    /t_minus_24_revalidation_must_pass_first/,
  );

  assert.deepEqual(database.prepare(`SELECT checkpoint,status FROM assignment_revalidations
    ORDER BY scheduled_at`).all().map((row) => ({ ...row })), [
    { checkpoint: "t_minus_24", status: "pending" },
    { checkpoint: "t_minus_2", status: "pending" },
    { checkpoint: "check_in", status: "pending" },
  ]);
  assert.deepEqual({ ...database.prepare(`SELECT status,check_in_at AS checkInAt FROM shifts WHERE id=?`)
    .get(activated.shiftId) }, { status: "confirmed", checkInAt: null });
  assert.equal(count(database, "assignment_activation_decisions"), before.decisions);
  assert.equal(count(database, "assignment_activation_blockers"), before.blockers);
  assert.equal(count(database, "assignment_evidence_tokens"), before.tokens);
  database.close();
});

test("check-in closes at the roster deadline in both the server and database guards", async () => {
  const database = migratedDatabase();
  seedValid(database);
  moveCandidateToCheckInWindow(database);
  const missedDeadline = new Date(Date.now() - 60_000).toISOString();
  run(database, `UPDATE roster_slots SET check_in_due_at=? WHERE id='SLOT-1'`, missedDeadline);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:missed-check-in-deadline"), "ops@example.test");
  await passDueScheduledCheckpoints(db);

  await assert.rejects(
    () => revalidateAssignment(db, activated.shiftId, "check_in", "officer@example.test", true),
    /check-in deadline has passed/i,
  );
  assert.throws(
    () => insertCopiedRevalidationToken(database, "AET-DIRECT-LATE-CHECK-IN", "check_in"),
    /assignment_evidence_token_shift_window_closed/,
  );
  assert.deepEqual({ ...database.prepare(`SELECT status,check_in_at AS checkInAt FROM shifts WHERE id=?`)
    .get(activated.shiftId) }, { status: "confirmed", checkInAt: null });
  assert.equal(database.prepare(`SELECT status FROM assignment_revalidations
    WHERE checkpoint='check_in'`).get().status, "pending");
  database.close();
});

test("primary activation cannot cross the scheduled start boundary", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  const activationRequest = request("activation:start-boundary");
  const evaluated = await recordAssignmentActivationEvaluation(db, activationRequest, "ops@example.test");
  assert.equal(evaluated.state, "ready");

  const base = Math.floor(Date.now() / 60_000) * 60_000;
  const pastStart = new Date(base - 60_000).toISOString();
  const futureEnd = new Date(base + 12 * 60 * 60_000).toISOString();
  const serviceDate = new Date(base + 2 * 60 * 60_000).toISOString().slice(0, 10);
  run(database, `UPDATE roster_slots SET service_date=?,starts_at=?,ends_at=?,arrival_due_at=?,check_in_due_at=?
    WHERE id='SLOT-1'`, serviceDate, pastStart, futureEnd, pastStart, new Date(base + 10 * 60_000).toISOString());
  run(database, `UPDATE officer_availability_windows SET starts_at=?,ends_at=? WHERE officer_id='OFF-1'`,
    new Date(base - 24 * 60 * 60_000).toISOString(), new Date(base + 24 * 60 * 60_000).toISOString());
  const tokenTime = new Date().toISOString();
  assert.throws(() => run(database, `INSERT INTO assignment_evidence_tokens
    (id,command_id,checkpoint,source_revision,evaluation_hash,evaluated_at,roster_slot_id,officer_id,
     expected_slot_version,environment,funding_evidence,site_evidence,launch_evidence,officer_evidence,
     employer_evidence,schedule_evidence,created_at)
    SELECT 'AET-DIRECT-LATE-ACTIVATION',c.id,'activation',epoch.revision,
      '0000000000000000000000000000000000000000000000000000000000000000',?,c.roster_slot_id,c.officer_id,
      c.expected_slot_version,'production','{}','{}','[]','{}','{}','{}',?
    FROM assignment_activation_commands c JOIN activation_evidence_epoch epoch ON epoch.singleton=1
    WHERE c.activation_key=?`, tokenTime, tokenTime, activationRequest.activationKey),
  /assignment_evidence_token_shift_window_closed/);

  await assert.rejects(
    () => activateAssignment(db, activationRequest, "ops@example.test"),
    /must be activated before its scheduled start/i,
  );
  for (const table of ["roster_assignments", "shifts", "assignment_activation_snapshots",
    "assignment_workforce_snapshots", "workforce_hour_reservations", "assignment_revalidations"]) {
    assert.equal(count(database, table), 0, table);
  }
  assert.equal(database.prepare(`SELECT state FROM assignment_activation_commands`).get().state, "blocked");
  database.close();
});

test("a revalidation cannot borrow a passed decision from another activation command", async () => {
  const database = migratedDatabase();
  seedValid(database, true);
  moveCandidateToCheckInWindow(database);
  run(database, `UPDATE officer_availability_windows SET starts_at=(SELECT starts_at FROM officer_availability_windows WHERE officer_id='OFF-1'),
    ends_at=(SELECT ends_at FROM officer_availability_windows WHERE officer_id='OFF-1') WHERE officer_id='OFF-2'`);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
     environment,integrity_state,status,version,created_at,updated_at)
    SELECT 'SLOT-2',site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
      environment,integrity_state,'uncovered',1,created_at,updated_at FROM roster_slots WHERE id='SLOT-1'`);
  const db = new D1Adapter(database);
  const first = await activateAssignment(db, request("activation:decision-owner", "OFF-1"), "ops@example.test");
  const second = await activateAssignment(db, {
    ...request("activation:decision-target", "OFF-2"),
    rosterSlotId: "SLOT-2",
  }, "ops@example.test");
  const firstResult = await revalidateAssignment(db, first.shiftId, "t_minus_24", "system:assignment-revalidation");
  assert.equal(firstResult.ready, true);
  const borrowed = database.prepare(`SELECT rv.decision_id AS decisionId,rv.evaluated_at AS evaluatedAt
    FROM assignment_revalidations rv JOIN assignment_activation_snapshots snap ON snap.id=rv.snapshot_id
    WHERE snap.shift_id=? AND rv.checkpoint='t_minus_24'`).get(first.shiftId);

  assert.throws(() => run(database, `UPDATE assignment_revalidations
    SET status='passed',decision_id=?,evaluated_at=?
    WHERE snapshot_id=(SELECT id FROM assignment_activation_snapshots WHERE shift_id=?) AND checkpoint='t_minus_24'`,
  borrowed.decisionId, borrowed.evaluatedAt, second.shiftId), /assignment_revalidation_decision_binding_invalid/);
  assert.deepEqual({ ...database.prepare(`SELECT rv.status,rv.decision_id AS decisionId
    FROM assignment_revalidations rv JOIN assignment_activation_snapshots snap ON snap.id=rv.snapshot_id
    WHERE snap.shift_id=? AND rv.checkpoint='t_minus_24'`).get(second.shiftId) }, {
    status: "pending",
    decisionId: null,
  });
  database.close();
});

test("successful check-in revalidation and shift transition commit atomically", async () => {
  const database = migratedDatabase();
  seedValid(database);
  moveCandidateToCheckInWindow(database);
  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:check-in-success"), "ops@example.test");
  await passDueScheduledCheckpoints(db);
  const result = await revalidateAssignment(db, activated.shiftId, "check_in", "officer@example.test", true);
  assert.equal(result.ready, true);
  const checkInState = { ...database.prepare(`SELECT sh.status,sh.check_in_at AS checkInAt,rv.status AS revalidationStatus
    FROM shifts sh JOIN assignment_activation_snapshots snap ON snap.shift_id=sh.id
    JOIN assignment_revalidations rv ON rv.snapshot_id=snap.id AND rv.checkpoint='check_in' WHERE sh.id=?`).get(activated.shiftId) };
  assert.equal(checkInState.status, "on_post");
  assert.equal(checkInState.revalidationStatus, "passed");
  assert.ok(checkInState.checkInAt);
  assert.equal((await revalidateAssignment(db, activated.shiftId, "check_in", "officer@example.test", true)).idempotent, true);
  database.close();
});

function insertWorkCommitment(database, {
  id,
  starts,
  ends,
  officerId = "OFF-1",
  status = "declared",
  environment = "production",
  integrityState = environment === "production" ? "verified" : "synthetic",
  evidenceReference = `commitment:evidence:${id}`,
  verifiedAt = now,
  expiresAt = expiry,
}) {
  run(database, `INSERT INTO officer_work_commitments
    (id,officer_id,source_type,source_reference,starts_at,ends_at,status,environment,integrity_state,
     evidence_reference,verified_at,expires_at,created_at)
    VALUES (?,?,'external_employer',?,?,?,?,?,?,?,?,?,?)`,
  id, officerId, `external:${id}`, starts, ends, status, environment, integrityState,
  evidenceReference, verifiedAt, expiresAt, now);
}

test("a production work commitment added after activation enforces the exact eight-hour rest boundary", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  await activateAssignment(db, request("activation:commitment-rest-boundary"), "ops@example.test");

  assert.throws(() => insertWorkCommitment(database, {
    id: "OWC-REST-UNDER",
    starts: "2039-12-26T13:59:00.000Z",
    ends: "2039-12-26T14:59:00.000Z",
  }), /production_work_commitment_rest_conflict/);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM officer_work_commitments
    WHERE id='OWC-REST-UNDER'`).get().count), 0);

  insertWorkCommitment(database, {
    id: "OWC-REST-EXACT",
    starts: "2039-12-26T14:00:00.000Z",
    ends: "2039-12-26T15:00:00.000Z",
  });
  assert.deepEqual({ ...database.prepare(`SELECT status,environment,integrity_state AS integrityState
    FROM officer_work_commitments WHERE id='OWC-REST-EXACT'`).get() }, {
    status: "declared",
    environment: "production",
    integrityState: "verified",
  });
  database.close();
});

test("a production work commitment conflicting with relief work is rejected", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  await activateAssignment(db, request("activation:commitment-relief-conflict"), "ops@example.test");
  seedReliefReservation(database, {
    reliefId: "REL-COMMITMENT",
    slotId: "SLOT-REL-COMMITMENT",
    starts: "2039-12-26T14:00:00.000Z",
    ends: "2039-12-26T16:00:00.000Z",
  });

  assert.throws(() => insertWorkCommitment(database, {
    id: "OWC-RELIEF-CONFLICT",
    starts: "2039-12-26T23:59:00.000Z",
    ends: "2039-12-27T00:59:00.000Z",
  }), /production_work_commitment_rest_conflict/);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM officer_work_commitments
    WHERE id='OWC-RELIEF-CONFLICT'`).get().count), 0);
  database.close();
});

test("a production work commitment cannot push Direct Flex work above the weekly ceiling", async () => {
  const database = migratedDatabase();
  seedValid(database);
  const db = new D1Adapter(database);
  await activateAssignment(db, request("activation:commitment-weekly-cap"), "ops@example.test");

  assert.throws(() => insertWorkCommitment(database, {
    id: "OWC-WEEKLY-CAP",
    starts: "2039-12-26T14:00:00.000Z",
    ends: "2039-12-27T07:00:00.000Z",
  }), /production_work_commitment_weekly_cap_exceeded/);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM officer_work_commitments
    WHERE id='OWC-WEEKLY-CAP'`).get().count), 0);
  database.close();
});

test("production work commitments reject mutation, invalid provenance and deletion", () => {
  const database = migratedDatabase();
  seedValid(database);

  assert.throws(() => insertWorkCommitment(database, {
    id: "OWC-BAD-PROVENANCE",
    starts: "2039-12-29T08:00:00.000Z",
    ends: "2039-12-29T09:00:00.000Z",
    environment: "staging",
    integrityState: "verified",
  }), /officer_work_commitment_provenance_invalid/);

  insertWorkCommitment(database, {
    id: "OWC-IMMUTABLE",
    starts: "2039-12-29T08:00:00.000Z",
    ends: "2039-12-29T10:00:00.000Z",
  });
  assert.throws(() => run(database, `UPDATE officer_work_commitments
    SET source_reference='changed' WHERE id='OWC-IMMUTABLE'`), /production_work_commitment_append_only/);
  assert.throws(() => run(database, `UPDATE officer_work_commitments
    SET environment='demo',integrity_state='synthetic' WHERE id='OWC-IMMUTABLE'`),
  /officer_work_commitment_provenance_immutable|production_work_commitment_append_only/);
  assert.throws(() => run(database, `DELETE FROM officer_work_commitments WHERE id='OWC-IMMUTABLE'`),
    /production_work_commitment_delete_forbidden/);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM officer_work_commitments
    WHERE id='OWC-IMMUTABLE' AND source_reference='external:OWC-IMMUTABLE'
      AND environment='production' AND integrity_state='verified'`).get().count), 1);
  database.close();
});

test("cancelled production work commitments are excluded from activation conflicts and hours", async () => {
  const database = migratedDatabase();
  seedValid(database);
  insertWorkCommitment(database, {
    id: "OWC-CANCELLED",
    starts: startsAt,
    ends: endsAt,
  });
  run(database, `UPDATE officer_work_commitments SET status='cancelled' WHERE id='OWC-CANCELLED'`);

  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:cancelled-commitment"), "ops@example.test");
  assert.equal(activated.state, "activated");
  assert.equal(database.prepare(`SELECT status FROM officer_work_commitments
    WHERE id='OWC-CANCELLED'`).get().status, "cancelled");
  assert.equal(Number(database.prepare(`SELECT SUM(reserved_minutes) AS minutes FROM workforce_hour_reservations
    WHERE roster_assignment_id=? AND status='active'`).get(activated.rosterAssignmentId).minutes), 720);
  database.close();
});

test("synthetic demo commitments do not block a production activation", async () => {
  const database = migratedDatabase();
  seedValid(database);
  insertWorkCommitment(database, {
    id: "OWC-DEMO-SYNTHETIC",
    starts: startsAt,
    ends: endsAt,
    environment: "demo",
    integrityState: "synthetic",
    evidenceReference: null,
    verifiedAt: null,
    expiresAt: null,
  });

  const db = new D1Adapter(database);
  const activated = await activateAssignment(db, request("activation:ignore-demo-commitment"), "ops@example.test");
  assert.equal(activated.state, "activated");
  assert.equal(database.prepare(`SELECT environment FROM officer_work_commitments
    WHERE id='OWC-DEMO-SYNTHETIC'`).get().environment, "demo");
  database.close();
});

test("demo and production schedule declarations keep independent append-only version chains", () => {
  const database = migratedDatabase();
  seedValid(database);
  run(database, `INSERT INTO officer_schedule_declarations
    (id,officer_id,version,status,environment,integrity_state,evidence_reference,declared_at,expires_at,supersedes_id,created_at)
    VALUES ('OSD-DEMO-OFF-1','OFF-1',1,'current','demo','synthetic','demo:schedule:OFF-1',?,?,NULL,?)`,
  now, expiry, now);
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM officer_schedule_declarations
    WHERE officer_id='OFF-1' AND version=1`).get().count), 2);
  assert.throws(() => run(database, `UPDATE officer_schedule_declarations SET status='revoked'
    WHERE id='OSD-OFF-1'`), /schedule_declarations_append_only/);
  assert.throws(() => run(database, `DELETE FROM officer_schedule_declarations
    WHERE id='OSD-OFF-1'`), /schedule_declarations_append_only/);
  database.close();
});
