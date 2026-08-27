import assert from "node:assert/strict";
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

const launchEvidenceAt = "2026-08-27T08:00:00.000Z";
const completeLaunchGates = () => REQUIRED_LAUNCH_GATE_CODES.map((code) => ({
  code,
  status: "passed",
  hardGate: true,
  evidenceLevel: "independently_verified",
  evidenceReference: `evidence:${code}`,
  verifiedAt: launchEvidenceAt,
  expiresAt: null,
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
