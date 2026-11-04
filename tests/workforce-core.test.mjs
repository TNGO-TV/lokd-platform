import assert from "node:assert/strict";
import test from "node:test";

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
  expiresAt: "2027-08-27T08:00:00.000Z",
}));

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
