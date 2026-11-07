import assert from "node:assert/strict";
import test from "node:test";

import {
  directFlexHoursDecision,
  launchGateDecision,
  REQUIRED_LAUNCH_GATE_CODES,
  workforceActivationDecision,
  bookingWorkforceRouteDecision,
  workforceReadinessStatuses,
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
    bookingModel: "bolt",
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

test("retired external-firm supply remains ineligible even with historical responsibility confirmations", () => {
  const base = {
    bookingModel: "bolt",
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
  assert.equal(workforceActivationDecision({ ...base, payrollStatus: "partner_confirmed", benefitsStatus: "partner_confirmed" }).ready, false);
});

test("Bolt, Flex and Fixed allow only their direct LOKD employment routes", () => {
 for(const [booking,route,allowed] of [['bolt','direct_flex',true],['bolt','managed',false],['flex','managed',true],['flex','direct_flex',false],['fixed','managed',true],['fixed','direct_flex',false],['bolt','partner',false],['flex','partner',false],['fixed','partner',false]])assert.equal(bookingWorkforceRouteDecision(booking,route).ready,allowed,booking+'/'+route);
 for(const booking of [null,undefined,'','unknown'])assert.equal(bookingWorkforceRouteDecision(booking,'managed').code,'BOOKING_MODEL_INVALID');
 assert.equal(bookingWorkforceRouteDecision('bolt',null).ready,false);
});
test("all supported employment routes require LOKD payroll and benefits", () => {
 assert.throws(()=>workforceReadinessStatuses('partner'),/LOKD employment/);
 for(const route of ['direct_flex','managed'])assert.deepEqual(workforceReadinessStatuses(route),{payrollStatus:'ready',benefitsStatus:'ready'});
});
