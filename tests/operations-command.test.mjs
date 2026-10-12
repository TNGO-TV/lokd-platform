import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  ageInMinutes,
  coverageStateLabel,
  deriveCoverageState,
  deriveOperationalState,
  highestPriority,
  highestSeverity,
  projectGautengCoordinate,
  minutesUntil,
  signalFreshness,
} from "../app/lib/operations-core.ts";
import {
  directFlexHoursDecision,
  launchGateDecision,
  REQUIRED_LAUNCH_GATE_CODES,
  workforceActivationDecision,
} from "../app/lib/workforce-core.ts";
import { splitAcrossIsoWeeks } from "../app/lib/assignment-activation-core.ts";
import {
  applyOperationsAction,
  ensureOperationsDemoData,
  readOperationsState,
  reliefCandidateEligibility,
} from "../app/lib/operations-server.ts";

class Prepared {
  constructor(owner, sql, values = []) {
    this.owner = owner;
    this.sql = sql;
    this.values = values;
  }
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

function migratedOperationsDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys=ON");
  for (const file of fs.readdirSync(new URL("../drizzle", import.meta.url)).filter((name) => name.endsWith(".sql")).sort()) {
    database.exec(fs.readFileSync(new URL(`../drizzle/${file}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
  }
  return database;
}

function demoReliefSlot(database) {
  return database.prepare(`SELECT id,booking_id AS bookingId,service_date AS serviceDate,
    starts_at AS startsAt,ends_at AS endsAt FROM roster_slots WHERE id='SLOT-LIN-02'`).get();
}

function run(database, sql, ...values) {
  return database.prepare(sql).run(...values);
}

const launchEvidenceAt = "2026-08-27T08:00:00.000Z";
const completeLaunchGates = () => REQUIRED_LAUNCH_GATE_CODES.map((code) => ({
  code,
  status: "passed",
  hardGate: true,
  evidenceLevel: "independently_verified",
  evidenceReference: `evidence:${code}`,
  verifiedAt: launchEvidenceAt,
  expiresAt: "2027-08-27T08:00:00.000Z",
}));

const coverageBase = {
  status: "scheduled",
  startsAt: "2026-08-27T10:00:00.000Z",
  arrivalDueAt: "2026-08-27T09:45:00.000Z",
  checkInDueAt: "2026-08-27T10:10:00.000Z",
  checkInAt: null,
  officerId: "OFF-001",
  activeRelief: false,
};

test("fresh on-post evidence produces an operational site", () => {
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "on_post",
    signalAgeMinutes: 4,
    highestIncidentSeverity: null,
    highestExceptionPriority: null,
  }), "operational");
});

test("a stale on-post signal becomes attention rather than a false location conclusion", () => {
  assert.equal(signalFreshness(16), "stale");
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "on_post",
    signalAgeMinutes: 16,
    highestIncidentSeverity: null,
    highestExceptionPriority: null,
  }), "attention");
});

test("critical incidents and P0 exceptions override otherwise healthy coverage", () => {
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "on_post",
    signalAgeMinutes: 2,
    highestIncidentSeverity: "critical",
    highestExceptionPriority: null,
  }), "critical");
  assert.equal(deriveOperationalState({
    active: true,
    shiftStatus: "confirmed",
    signalAgeMinutes: 2,
    highestIncidentSeverity: null,
    highestExceptionPriority: "P0",
  }), "critical");
});

test("severity and exception ordering always returns the worst active condition", () => {
  assert.equal(highestSeverity(["low", "high", "medium"]), "high");
  assert.equal(highestPriority(["P3", "P1", "P2"]), "P1");
});

test("signal age rejects invalid values and never returns negative minutes", () => {
  const now = new Date("2026-08-27T12:00:00.000Z");
  assert.equal(ageInMinutes("2026-08-27T11:56:00.000Z", now), 4);
  assert.equal(ageInMinutes("2026-08-27T12:05:00.000Z", now), 0);
  assert.equal(signalFreshness(ageInMinutes(null, now)), "unavailable");
});

test("Gauteng coordinate projection remains inside the command canvas", () => {
  const rosebank = projectGautengCoordinate(-26.1468, 28.0417);
  assert.ok(rosebank.x > 4 && rosebank.x < 96);
  assert.ok(rosebank.y > 4 && rosebank.y < 96);
  assert.deepEqual(projectGautengCoordinate(-90, 180), { x: 96, y: 96 });
});

test("arrival assurance uses stored deadlines and preserves a check-in grace window", () => {
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T09:44:00.000Z") }), "confirmed");
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T09:45:00.000Z") }), "arrival_at_risk");
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T10:09:00.000Z") }), "arrival_at_risk");
  assert.equal(deriveCoverageState({ ...coverageBase, now: new Date("2026-08-27T10:11:00.000Z") }), "check_in_missing");
});

test("check-in evidence overrides arrival risk and never creates an automatic no-show conclusion", () => {
  assert.equal(deriveCoverageState({ ...coverageBase, checkInAt: "2026-08-27T10:08:00.000Z", now: new Date("2026-08-27T10:20:00.000Z") }), "on_post");
  assert.equal(coverageStateLabel("check_in_missing"), "Check-in not recorded");
  assert.ok(!coverageStateLabel("check_in_missing").toLowerCase().includes("no-show"));
});

test("an assignment status cannot manufacture on-post evidence", () => {
  assert.equal(deriveCoverageState({
    ...coverageBase,
    status: "on_post",
    now: new Date("2026-08-27T10:09:00.000Z"),
  }), "arrival_at_risk");
  assert.equal(deriveCoverageState({
    ...coverageBase,
    status: "on_post",
    now: new Date("2026-08-27T10:11:00.000Z"),
  }), "check_in_missing");
});

test("a required slot can be uncovered without manufacturing a shift or officer", () => {
  assert.equal(deriveCoverageState({ ...coverageBase, status: "uncovered", officerId: null, now: new Date("2026-08-27T08:00:00.000Z") }), "uncovered");
  assert.equal(deriveCoverageState({ ...coverageBase, activeRelief: true, now: new Date("2026-08-27T09:50:00.000Z") }), "relief_active");
});

test("coverage time helpers retain exact UTC interval semantics for night shifts", () => {
  const now = new Date("2026-08-27T16:00:00.000Z");
  assert.equal(minutesUntil("2026-08-27T18:00:00.000Z", now), 120);
  assert.equal(minutesUntil("2026-08-28T06:00:00.000Z", now), 840);
});

test("reported paperwork does not pass a hard launch gate", () => {
  const gates = completeLaunchGates().map((gate) => gate.code === "G1_PSIRA_PAPERWORK"
    ? { ...gate, status: "reported" }
    : gate.code === "G2_CONTROL_ROOM_INSPECTION" ? { ...gate, status: "pending" } : gate);
  assert.deepEqual(launchGateDecision(gates, "2026-08-27T12:00:00.000Z"), {
    ready: false,
    blockers: ["G1_PSIRA_PAPERWORK", "G2_CONTROL_ROOM_INSPECTION"],
  });
});

test("a missing launch-control register fails closed", () => {
  const decision = launchGateDecision([], "2026-08-27T12:00:00.000Z");
  assert.equal(decision.ready, false);
  assert.equal(decision.blockers.length, REQUIRED_LAUNCH_GATE_CODES.length);
  assert.ok(decision.blockers.includes("MISSING:G2_CONTROL_ROOM_INSPECTION"));
});

test("passed launch gates still require valid evidence through activation", () => {
  const gates = completeLaunchGates().map((gate) => gate.code === "G8_PAYROLL_INSURANCE"
    ? { ...gate, expiresAt: "2026-08-27T10:00:00.000Z" }
    : gate);
  assert.deepEqual(launchGateDecision(gates, "2026-08-27T12:00:00.000Z").blockers, ["G8_PAYROLL_INSURANCE"]);
  const noEvidence = completeLaunchGates().map((gate) => gate.code === "G0_PHASE1_SCOPE"
    ? { ...gate, evidenceReference: null }
    : gate);
  assert.deepEqual(launchGateDecision(noEvidence, "2026-08-27T12:00:00.000Z").blockers, ["G0_PHASE1_SCOPE"]);
});

test("Direct Flex accepts 24 hours a week and rejects the next hour", () => {
  assert.deepEqual(directFlexHoursDecision(12, 12, 24), {
    eligible: true,
    projectedHours: 24,
    weeklyHourCap: 24,
  });
  assert.equal(directFlexHoursDecision(24, 1, 24).eligible, false);
});

test("Operations exposes a truthful synthetic activation queue and records a fail-closed rehearsal", async () => {
  const database = migratedOperationsDatabase();
  const db = new D1Adapter(database);
  await ensureOperationsDemoData(db);
  const initial = await readOperationsState(db);
  assert.ok(initial.activation.queue.length > 0);
  const preview = initial.activation.queue.find((item) => item.commandId === null);
  assert.ok(preview);
  assert.equal(preview.databaseProtected, false);
  assert.equal(preview.state, "blocked");
  assert.ok(preview.blockers.some((blocker) => blocker.code === "PRODUCTION_ENVIRONMENT_REQUIRED"));
  assert.ok(preview.termsVersion);
  assert.ok(preview.fundedWageCents > 0);
  assert.ok(preview.hourSegments.length > 0);
  assert.equal(preview.evidenceValidThrough, null);

  await applyOperationsAction(db, {
    action: "evaluate_assignment_activation",
    rosterSlotId: preview.rosterSlotId,
    officerId: preview.officerId,
    expectedSlotVersion: preview.slotVersion,
  }, { email: "ops-owner@example.test" });
  const recorded = database.prepare(`SELECT environment,state,integrity_state AS integrityState
    FROM assignment_activation_commands WHERE environment='demo_synthetic'`).get();
  assert.deepEqual({ ...recorded }, {
    environment: "demo_synthetic",
    state: "blocked",
    integrityState: "synthetic_demo_only",
  });
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM roster_assignments
    WHERE environment='production'`).get().count), 0);
  database.close();
});

test("Operations keeps officer conversion private and client-funded without a PEA hard gate", async () => {
  const database = migratedOperationsDatabase();
  const db = new D1Adapter(database);
  await ensureOperationsDemoData(db);
  const initial = await readOperationsState(db);
  assert.equal(initial.conversion.clientCreditTermsDays, 0);
  assert.equal(initial.conversion.peaGatePassed, false);
  assert.equal(initial.conversion.cases.length, 1);
  assert.ok(initial.conversion.cases[0].blockers.every((blocker) => !blocker.includes("Private Employment Agency")));

  await applyOperationsAction(db, {
    action: "open_officer_conversion_case",
    clientId: "CL-001",
    officerId: "OFF-004",
    route: "private_recruitment_enquiry",
    specialistCategory: "standard",
    completedServiceMonths: 0,
    annualGuaranteedCashCents: 12_000_000,
  }, { email: "ops-owner@example.test" });
  let state = await readOperationsState(db);
  let conversion = state.conversion.cases.find((item) => item.officerId === "OFF-004");
  assert.ok(conversion);
  assert.equal(conversion.calculatedFeeCents, 1_800_000);
  assert.equal(conversion.feeStatus, "quoted");

  await applyOperationsAction(db, {
    action: "advance_officer_conversion_case",
    caseId: conversion.id,
    version: conversion.version,
    step: "record_offer_notice",
  }, { email: "ops-owner@example.test" });
  state = await readOperationsState(db);
  conversion = state.conversion.cases.find((item) => item.id === conversion.id);
  await applyOperationsAction(db, {
    action: "advance_officer_conversion_case",
    caseId: conversion.id,
    version: conversion.version,
    step: "record_offer_acceptance",
  }, { email: "ops-owner@example.test" });
  state = await readOperationsState(db);
  conversion = state.conversion.cases.find((item) => item.id === conversion.id);
  assert.equal(conversion.feeStatus, "payable_prefund_required");
  await applyOperationsAction(db, {
    action: "advance_officer_conversion_case",
    caseId: conversion.id,
    version: conversion.version,
    step: "mark_fee_paid",
  }, { email: "ops-owner@example.test" });
  state = await readOperationsState(db);
  conversion = state.conversion.cases.find((item) => item.id === conversion.id);
  assert.equal(conversion.feeStatus, "paid");
  assert.equal(state.conversion.peaGatePassed, false);
  database.close();
});

test("production work commitments do not block synthetic demo relief eligibility", async () => {
  const database = migratedOperationsDatabase();
  const db = new D1Adapter(database);
  await ensureOperationsDemoData(db);
  const slot = demoReliefSlot(database);
  const recordedAt = new Date().toISOString();
  const expiresAt = new Date(new Date(slot.endsAt).getTime() + 24 * 60 * 60_000).toISOString();
  run(database, `INSERT INTO officer_work_commitments
    (id,officer_id,source_type,source_reference,starts_at,ends_at,status,environment,integrity_state,
     evidence_reference,verified_at,expires_at,created_at)
    VALUES ('OWC-PROD-ISOLATION','OFF-004','external_employer','production:test',?,?,'declared',
     'production','verified','production:evidence',?,?,?)`,
  slot.startsAt, slot.endsAt, recordedAt, expiresAt, recordedAt);

  const eligibility = await reliefCandidateEligibility(db, "OFF-004", slot);
  assert.equal(eligibility.eligible, true, eligibility.reason);
  database.close();
});

test("production reservation provenance is excluded from synthetic demo hour and rest totals", async () => {
  const database = migratedOperationsDatabase();
  const db = new D1Adapter(database);
  await ensureOperationsDemoData(db);
  const slot = demoReliefSlot(database);
  const recordedAt = new Date().toISOString();
  const reviewDueAt = new Date(new Date(slot.endsAt).getTime() + 30 * 24 * 60 * 60_000).toISOString();
  const productionServiceDate = new Date(new Date(slot.startsAt).getTime() + 2 * 60 * 60_000).toISOString().slice(0, 10);

  run(database, `UPDATE workforce_engagements SET status='inactive',active_key=NULL,updated_at=? WHERE id='WE-OFF-004'`, recordedAt);
  run(database, `INSERT INTO workforce_employers
    (id,legal_name,employer_type,environment,psira_status,nbcpss_status,psspf_status,uif_status,coida_status,
     insurance_status,service_agreement_status,status,last_reviewed_at,review_due_at,version,created_at,updated_at)
    VALUES ('EMP-PROD-ISOLATION','Production isolation employer','partner','production','current','current',
     'current','current','current','current','current','current',?,?,1,?,?)`,
  recordedAt, reviewDueAt, recordedAt, recordedAt);
  run(database, `INSERT INTO workforce_engagements
    (id,officer_id,employer_id,model,environment,status,active_key,engagement_reference,terms_version,
     payroll_status,benefits_status,weekly_hour_cap,activated_at,review_due_at,version,created_at,updated_at)
    VALUES ('WE-PROD-ISOLATION','OFF-004','EMP-PROD-ISOLATION','direct_flex','production','active','OFF-004',
     'production:test','PROD-v1','ready','ready',24,?,?,1,?,?)`,
  recordedAt, reviewDueAt, recordedAt, recordedAt);
  run(database, `INSERT INTO clients
    (id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state)
    VALUES ('CL-PROD-ISOLATION','Production isolation client','Production contact',
      'production-isolation@example.test','approved','production','production_verified')`);
  run(database, `INSERT INTO bookings
    (id,client_id,site_name,site_area,post_name,service_type,minimum_grade,contract_months,start_date,end_date,
     shift_start,shift_end,client_price_cents,officer_rate_cents,release_cadence,environment,integrity_state)
    VALUES ('BK-PROD-ISOLATION','CL-PROD-ISOLATION','Production isolation site','Johannesburg','Gate',
      'Unarmed','Grade C',0,?,?,'08:00','20:00',160000,80000,'Weekly','production','production_verified')`,
  productionServiceDate, productionServiceDate);
  run(database, `INSERT INTO operational_sites
    (id,client_id,booking_id,name,area,address_label,latitude_e6,longitude_e6,environment,integrity_state)
    VALUES ('SITE-PROD-ISOLATION','CL-PROD-ISOLATION','BK-PROD-ISOLATION','Production isolation site',
      'Johannesburg','Production test address',-26100000,28100000,'production','production_verified')`);
  run(database, `INSERT INTO site_posts
    (id,site_id,booking_id,name,environment,integrity_state)
    VALUES ('POST-PROD-ISOLATION','SITE-PROD-ISOLATION','BK-PROD-ISOLATION','Gate',
      'production','production_verified')`);
  run(database, `INSERT INTO roster_slots
    (id,site_id,post_id,booking_id,service_date,starts_at,ends_at,arrival_due_at,check_in_due_at,
     environment,integrity_state,status,version,created_at,updated_at)
    VALUES ('SLOT-PROD-ISOLATION','SITE-PROD-ISOLATION','POST-PROD-ISOLATION','BK-PROD-ISOLATION',?,?,?,?,?,
     'production','production_verified','relief_active',1,?,?)`,
  productionServiceDate, slot.startsAt, slot.endsAt, slot.startsAt, slot.startsAt, recordedAt, recordedAt);
  run(database, `INSERT INTO relief_dispatches
    (id,roster_slot_id,site_id,replacement_officer_id,environment,integrity_state,active_key,status,
     reason_code,priority,requested_by,requested_at,response_due_at,version)
    VALUES ('REL-PROD-ISOLATION','SLOT-PROD-ISOLATION','SITE-PROD-ISOLATION','OFF-004','production',
     'production_verified','SLOT-PROD-ISOLATION','case_open','operations_contingency','P1','test',?,?,1)`,
  recordedAt, reviewDueAt);
  for (const [index, segment] of splitAcrossIsoWeeks(slot.startsAt, slot.endsAt).entries()) {
    run(database, `INSERT INTO workforce_hour_reservations
      (id,command_id,roster_assignment_id,relief_dispatch_id,officer_id,workforce_engagement_id,
       source_type,source_id,iso_week_start,iso_week_end,segment_starts_at,segment_ends_at,
       reserved_minutes,weekly_cap_minutes,status,active_key,created_at)
      VALUES (?,NULL,NULL,'REL-PROD-ISOLATION','OFF-004','WE-PROD-ISOLATION','relief','REL-PROD-ISOLATION',
       ?,?,?,?,?,1440,'active',?,?)`,
    `WHR-PROD-ISOLATION-${index + 1}`, segment.isoWeekStart, segment.isoWeekEnd,
    segment.startsAt, segment.endsAt, segment.minutes,
    `OFF-004:${segment.isoWeekStart}:REL-PROD-ISOLATION`, recordedAt);
  }
  run(database, `UPDATE workforce_engagements SET status='inactive',active_key=NULL,updated_at=?
    WHERE id='WE-PROD-ISOLATION'`, recordedAt);
  run(database, `UPDATE workforce_engagements SET status='active',active_key='OFF-004',weekly_hour_cap=18,updated_at=?
    WHERE id='WE-OFF-004'`, recordedAt);

  const eligibility = await reliefCandidateEligibility(db, "OFF-004", slot);
  assert.equal(eligibility.eligible, true, eligibility.reason);
  database.close();
});

test("Operations relief workflow reserves exact ISO-week Direct Flex hours and releases them on cancellation", async () => {
  const database = migratedOperationsDatabase();
  const db = new D1Adapter(database);
  await ensureOperationsDemoData(db);

  // Put the uncovered post across the next Johannesburg ISO-week boundary so the
  // real command path has to create, and later release, both weekly segments.
  const southAfricaOffsetMs = 2 * 60 * 60_000;
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const localNow = new Date(now.getTime() + southAfricaOffsetMs);
  const isoWeekday = localNow.getUTCDay() || 7;
  const nextMondayLocalMidnight = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate() + (8 - isoWeekday),
  );
  const weekBoundary = nextMondayLocalMidnight - southAfricaOffsetMs;
  const startsAt = new Date(weekBoundary - 60 * 60_000).toISOString();
  const endsAt = new Date(weekBoundary + 11 * 60 * 60_000).toISOString();
  const serviceDate = new Date(weekBoundary - 60 * 60_000 + southAfricaOffsetMs).toISOString().slice(0, 10);
  const expectedSegments = splitAcrossIsoWeeks(startsAt, endsAt);
  assert.equal(expectedSegments.length, 2);

  run(database, `UPDATE roster_slots SET service_date=?, starts_at=?, ends_at=?, arrival_due_at=?,
    check_in_due_at=?, updated_at=? WHERE id='SLOT-LIN-02'`,
  serviceDate, startsAt, endsAt, startsAt, startsAt, now.toISOString());
  run(database, `UPDATE officer_availability_windows SET starts_at=?, ends_at=?, rest_confirmed_at=?
    WHERE id='AVAIL-OFF-004-01'`,
  new Date(now.getTime() - 60 * 60_000).toISOString(),
  new Date(new Date(endsAt).getTime() + 60 * 60_000).toISOString(), now.toISOString());

  const slotBefore = database.prepare(`SELECT id,status,version FROM roster_slots WHERE id='SLOT-LIN-02'`).get();
  assert.deepEqual({ ...slotBefore }, { id: "SLOT-LIN-02", status: "uncovered", version: 1 });

  await applyOperationsAction(db, {
    action: "open_relief_case",
    rosterSlotId: "SLOT-LIN-02",
    replacementOfficerId: "OFF-004",
    version: 1,
    reasonCode: "operations_contingency",
  }, { email: "ops-owner@example.test" });

  const relief = database.prepare(`SELECT id,status,active_key AS activeKey,version,environment,integrity_state AS integrityState
    FROM relief_dispatches WHERE roster_slot_id='SLOT-LIN-02'`).get();
  assert.ok(relief?.id);
  assert.deepEqual({
    status: relief.status,
    activeKey: relief.activeKey,
    version: relief.version,
    environment: relief.environment,
    integrityState: relief.integrityState,
  }, {
    status: "case_open",
    activeKey: "SLOT-LIN-02",
    version: 1,
    environment: "demo",
    integrityState: "synthetic",
  });
  assert.deepEqual({ ...database.prepare(`SELECT status,version FROM roster_slots WHERE id='SLOT-LIN-02'`).get() }, {
    status: "relief_active",
    version: 2,
  });

  const reservations = database.prepare(`SELECT source_type AS sourceType,source_id AS sourceId,
    relief_dispatch_id AS reliefDispatchId,officer_id AS officerId,workforce_engagement_id AS workforceEngagementId,
    iso_week_start AS isoWeekStart,iso_week_end AS isoWeekEnd,segment_starts_at AS startsAt,
    segment_ends_at AS endsAt,reserved_minutes AS minutes,weekly_cap_minutes AS weeklyCapMinutes,
    status,active_key AS activeKey,released_at AS releasedAt,release_reason AS releaseReason
    FROM workforce_hour_reservations WHERE relief_dispatch_id=? ORDER BY segment_starts_at`).all(relief.id);
  assert.deepEqual(reservations.map((reservation) => ({
    sourceType: reservation.sourceType,
    sourceId: reservation.sourceId,
    reliefDispatchId: reservation.reliefDispatchId,
    officerId: reservation.officerId,
    workforceEngagementId: reservation.workforceEngagementId,
    isoWeekStart: reservation.isoWeekStart,
    isoWeekEnd: reservation.isoWeekEnd,
    startsAt: reservation.startsAt,
    endsAt: reservation.endsAt,
    minutes: reservation.minutes,
    weeklyCapMinutes: reservation.weeklyCapMinutes,
    status: reservation.status,
    activeKey: reservation.activeKey,
    releasedAt: reservation.releasedAt,
    releaseReason: reservation.releaseReason,
  })), expectedSegments.map((segment) => ({
    sourceType: "relief",
    sourceId: relief.id,
    reliefDispatchId: relief.id,
    officerId: "OFF-004",
    workforceEngagementId: "WE-OFF-004",
    isoWeekStart: segment.isoWeekStart,
    isoWeekEnd: segment.isoWeekEnd,
    startsAt: segment.startsAt,
    endsAt: segment.endsAt,
    minutes: segment.minutes,
    weeklyCapMinutes: 24 * 60,
    status: "active",
    activeKey: `OFF-004:${segment.isoWeekStart}:${relief.id}`,
    releasedAt: null,
    releaseReason: null,
  })));

  await applyOperationsAction(db, {
    action: "cancel_relief",
    reliefDispatchId: relief.id,
    version: 1,
  }, { email: "ops-owner@example.test" });

  const cancelled = database.prepare(`SELECT status,active_key AS activeKey,closed_at AS closedAt,version
    FROM relief_dispatches WHERE id=?`).get(relief.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.activeKey, null);
  assert.ok(cancelled.closedAt);
  assert.equal(cancelled.version, 2);
  assert.deepEqual({ ...database.prepare(`SELECT status,version FROM roster_slots WHERE id='SLOT-LIN-02'`).get() }, {
    status: "uncovered",
    version: 3,
  });

  const released = database.prepare(`SELECT status,active_key AS activeKey,released_at AS releasedAt,
    release_reason AS releaseReason FROM workforce_hour_reservations
    WHERE relief_dispatch_id=? ORDER BY segment_starts_at`).all(relief.id);
  assert.equal(released.length, expectedSegments.length);
  for (const reservation of released) {
    assert.equal(reservation.status, "released");
    assert.equal(reservation.activeKey, null);
    assert.ok(reservation.releasedAt);
    assert.equal(reservation.releaseReason, "relief_cancelled");
  }
  assert.equal(Number(database.prepare(`SELECT COUNT(*) AS count FROM workforce_hour_reservations
    WHERE relief_dispatch_id=? AND (status='active' OR active_key IS NOT NULL)`).get(relief.id).count), 0);
  assert.deepEqual({ ...database.prepare(`SELECT status,resolution_code AS resolutionCode
    FROM operational_exceptions WHERE id=(SELECT exception_id FROM relief_dispatches WHERE id=?)`).get(relief.id) }, {
    status: "resolved",
    resolutionCode: "relief_cancelled",
  });
  database.close();
});

test("a verified network profile cannot be activated without an employment route", () => {
  const decision = workforceActivationDecision({
    launchGates: completeLaunchGates(),
    siteActive: true,
    bookingFunded: true,
    postOrdersApproved: true,
    engagementStatus: null,
    model: null,
    employerStatus: null,
    employerComplianceCurrent: false,
    payrollStatus: null,
    benefitsStatus: null,
    termsVersion: null,
    passportEligible: true,
  });
  assert.equal(decision.ready, false);
  assert.ok(decision.blockers.includes("No active workforce engagement exists."));
});

test("partner supply requires the partner to confirm payroll responsibility", () => {
  const base = {
    launchGates: completeLaunchGates(),
    siteActive: true,
    bookingFunded: true,
    postOrdersApproved: true,
    engagementStatus: "active",
    model: "partner",
    employerStatus: "current",
    employerComplianceCurrent: true,
    payrollStatus: "pending",
    benefitsStatus: "pending",
    termsVersion: "PARTNER-2026-01",
    passportEligible: true,
  };
  assert.equal(workforceActivationDecision(base).ready, false);
  assert.equal(workforceActivationDecision({ ...base, payrollStatus: "partner_confirmed" }).ready, false);
  assert.equal(workforceActivationDecision({ ...base, payrollStatus: "partner_confirmed", benefitsStatus: "partner_confirmed" }).ready, true);
});
