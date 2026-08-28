import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_EMPLOYER_EVIDENCE,
  evaluateAssignmentActivation,
  splitAcrossIsoWeeks,
} from "../app/lib/assignment-activation-core.ts";
import { REQUIRED_LAUNCH_GATE_CODES } from "../app/lib/workforce-core.ts";

const start = "2026-09-06T18:00:00.000Z";
const end = "2026-09-07T06:00:00.000Z";
const verifiedAt = "2026-08-28T08:00:00.000Z";
const expiry = "2027-01-01T00:00:00.000Z";

const evidence = (id, status = "current", version = 1) => ({
  id,
  status,
  version,
  environment: "production",
  integrityState: "verified",
  evidenceReference: `evidence:${id}`,
  verifiedAt,
  validFrom: verifiedAt,
  expiresAt: expiry,
});

const gates = () => REQUIRED_LAUNCH_GATE_CODES.map((code) => ({
  code,
  status: "passed",
  hardGate: true,
  evidenceLevel: "independently_verified",
  evidenceReference: `evidence:${code}`,
  verifiedAt,
  expiresAt: expiry,
}));

function validFacts() {
  return {
    environment: "production",
    checkpoint: "activation",
    evaluatedAt: "2026-08-28T10:00:00.000Z",
    shift: { rosterSlotId: "SLOT-1", bookingId: "BK-1", siteId: "SITE-1", postId: "POST-1", officerId: "OFF-1", startsAt: start, endsAt: end, slotVersion: 1, slotStatus: "uncovered" },
    launchGates: gates(),
    funding: { reconciliationId: "FR-1", environment: "production", integrityState: "verified", provider: "bank_api", providerReference: "BANK-SETTLEMENT-1", status: "cleared_reconciled", currency: "ZAR", bookingAmountCents: 140000, expectedAmountCents: 140000, clearedAmountCents: 140000, clearedAt: verifiedAt, reconciledAt: verifiedAt, evidenceReference: "bank:FR-1", verifiedAt, expiresAt: expiry },
    client: { id: "CL-1", approvalStatus: "approved" },
    site: { id: "SITE-1", status: "active", version: 2, risk: evidence("RISK-1", "approved", "RISK-v3") },
    post: { id: "POST-1", status: "active", postOrdersVersion: "PO-v4", orders: evidence("ORDERS-1", "approved", "PO-v4") },
    induction: evidence("IND-1", "completed", "IND-v2"),
    officer: {
      id: "OFF-1",
      approvalStatus: "approved",
      gradeEligible: true,
      psiraExpiry: expiry,
      identity: evidence("ID-1"),
      psira: evidence("PSIRA-1"),
      core: evidence("CORE-1"),
      service: { ...evidence("SERVICE-1"), qualified: true, optedIn: true, qualificationExpiresAt: expiry },
      purpose: evidence("PURPOSE-1"),
      passport: evidence("PASSPORT-1", "active"),
    },
    workforce: {
      engagementId: "WE-1",
      environment: "production",
      model: "direct_flex",
      status: "active",
      termsVersion: "TERMS-v3",
      reviewDueAt: expiry,
      weeklyHourCap: 24,
      payrollStatus: "ready",
      benefitsStatus: "ready",
      terms: evidence("TERMS-1", "accepted", "TERMS-v3"),
      employer: {
        id: "EMP-1",
        legalName: "LOKD Security",
        employerType: "lokd_employer",
        environment: "production",
        status: "current",
        version: 4,
        reviewDueAt: expiry,
        evidence: REQUIRED_EMPLOYER_EVIDENCE.map((code) => evidence(`EMP-1:${code}`, "current", code)),
      },
    },
    schedule: {
      available: true,
      availability: evidence("AVAILABILITY-1", "available"),
      externalDeclarationCurrent: true,
      declaration: evidence("SCHEDULE-DECLARATION-1", "current"),
      conflicts: [],
      travel: { ...evidence("TRAVEL-1", "feasible"), feasible: true, estimatedMinutes: 35 },
      existingWeekMinutes: {},
    },
    compensation: {
      pricingVersion: "LOKD-PREMIUM-2026.09",
      authoritativePricing: true,
      rosterServiceDate: "2026-09-01",
      derivedServiceDate: "2026-09-01",
      serviceDateMatchesStart: true,
      storedCalendarCategory: "ordinary",
      calendarCategory: "ordinary",
      storedOfficerOfferCents: 80000,
      ordinaryWageCents: 80000,
      holidayPremiumCents: 0,
      statutoryCostCents: 12000,
      officerOfferCents: 80000,
      fundedOfferCents: 80000,
    },
  };
}

function factsForWorkforceModel(model) {
  const facts = validFacts();
  facts.workforce.model = model;
  if (model === "partner") {
    facts.workforce.payrollStatus = "partner_confirmed";
    facts.workforce.benefitsStatus = "partner_confirmed";
    facts.workforce.employer.employerType = "partner_company";
  }
  return facts;
}

test("a fully evidenced Direct Flex activation is ready and freezes two ISO-week segments", () => {
  const result = evaluateAssignmentActivation(validFacts());
  assert.equal(result.ready, true);
  assert.deepEqual(result.weekSegments.map((segment) => [segment.isoWeekStart, segment.minutes]), [
    ["2026-08-31", 240],
    ["2026-09-07", 480],
  ]);
  assert.equal(result.compensation.fundedOfferCents, 80000);
});

test("Johannesburg Sunday night splits at local Monday midnight", () => {
  assert.deepEqual(splitAcrossIsoWeeks(start, end).map(({ startsAt, endsAt, minutes }) => ({ startsAt, endsAt, minutes })), [
    { startsAt: "2026-09-06T18:00:00.000Z", endsAt: "2026-09-06T22:00:00.000Z", minutes: 240 },
    { startsAt: "2026-09-06T22:00:00.000Z", endsAt: "2026-09-07T06:00:00.000Z", minutes: 480 },
  ]);
});

test("fractional-minute assignment boundaries fail closed without crashing the queue", () => {
  const facts = validFacts();
  facts.shift.startsAt = "2026-09-06T18:00:15.000Z";
  const result = evaluateAssignmentActivation(facts);
  assert.equal(result.ready, false);
  assert.equal(result.weekSegments.length, 0);
  assert.equal(result.blockers.some((item) => item.code === "SHIFT_WINDOW_INVALID"), true);
});

test("missing and duplicate required launch gates fail closed", () => {
  const missing = validFacts();
  missing.launchGates = missing.launchGates.filter((gate) => gate.code !== "G2_CONTROL_ROOM_INSPECTION");
  assert.ok(evaluateAssignmentActivation(missing).blockers.some((blocker) => blocker.code === "LAUNCH_MISSING_G2_CONTROL_ROOM_INSPECTION"));
  const duplicate = validFacts();
  duplicate.launchGates.push({ ...duplicate.launchGates[0] });
  assert.ok(evaluateAssignmentActivation(duplicate).blockers.some((blocker) => blocker.code === "LAUNCH_DUPLICATE_G0_PHASE1_SCOPE"));
});

test("passed gates still require evidence current through exact shift end", () => {
  const noEvidence = validFacts();
  noEvidence.launchGates[0].evidenceReference = null;
  assert.ok(evaluateAssignmentActivation(noEvidence).blockers.some((blocker) => blocker.code === "LAUNCH_G0_PHASE1_SCOPE"));
  const expired = validFacts();
  expired.launchGates[1].expiresAt = "2026-09-07T05:59:59.999Z";
  assert.ok(evaluateAssignmentActivation(expired).blockers.some((blocker) => blocker.code === "LAUNCH_G1_PSIRA_PAPERWORK"));
  const undated = validFacts();
  undated.launchGates[1].expiresAt = null;
  assert.ok(evaluateAssignmentActivation(undated).blockers.some((blocker) => blocker.code === "LAUNCH_G1_PSIRA_PAPERWORK"));
  const futureVerified = validFacts();
  futureVerified.launchGates[1].verifiedAt = "2026-08-28T10:01:00.000Z";
  assert.ok(evaluateAssignmentActivation(futureVerified).blockers.some((blocker) => blocker.code === "LAUNCH_G1_PSIRA_PAPERWORK"));
  const boundary = validFacts();
  boundary.launchGates[1].expiresAt = end;
  assert.equal(evaluateAssignmentActivation(boundary).ready, true);
});

test("a funding status string cannot replace cleared reconciliation evidence", () => {
  const facts = validFacts();
  facts.funding = { ...facts.funding, reconciliationId: null, status: "paid_in_full", provider: "demo_manual" };
  assert.ok(evaluateAssignmentActivation(facts).blockers.some((blocker) => blocker.code === "FUNDING_NOT_CLEARED_RECONCILED"));
  const wrongAmount = validFacts();
  wrongAmount.funding.expectedAmountCents = 100000;
  assert.ok(evaluateAssignmentActivation(wrongAmount).blockers.some((blocker) => blocker.code === "FUNDING_NOT_CLEARED_RECONCILED"));
});

test("non-ZAR funding fails the authoritative reconciliation gate", () => {
  const facts = validFacts();
  facts.funding.currency = "USD";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["FUNDING_NOT_CLEARED_RECONCILED"]);
});

test("funding evidence without a validity end fails closed", () => {
  const facts = validFacts();
  facts.funding.expiresAt = null;
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["FUNDING_NOT_CLEARED_RECONCILED"]);
});

test("client, site, post orders, risk and induction are independent blockers", () => {
  const facts = validFacts();
  facts.client.approvalStatus = "pending";
  facts.site.status = "suspended";
  facts.site.risk.status = "draft";
  facts.post.status = "pending";
  facts.post.orders.version = "PO-old";
  facts.induction.status = "pending";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  for (const code of ["CLIENT_NOT_APPROVED", "SITE_NOT_ACTIVE", "SITE_RISK_NOT_APPROVED", "POST_NOT_ACTIVE", "POST_ORDERS_NOT_APPROVED", "OFFICER_INDUCTION_NOT_APPROVED"]) assert.ok(codes.includes(code), code);
});

test("a risk assessment effective after shift start is not activation-ready", () => {
  const facts = validFacts();
  facts.site.risk.validFrom = "2026-09-06T18:00:00.001Z";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["SITE_RISK_NOT_EFFECTIVE"]);
});

test("post orders effective after shift start are not activation-ready", () => {
  const facts = validFacts();
  facts.post.orders.validFrom = "2026-09-06T18:00:00.001Z";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["POST_ORDERS_NOT_EFFECTIVE"]);
});

test("identity, PSiRA, grade, service, purpose and Passport remain valid through shift end", () => {
  const facts = validFacts();
  facts.officer.identity.expiresAt = "2026-09-07T05:59:00.000Z";
  facts.officer.psira.status = "expired";
  facts.officer.gradeEligible = false;
  facts.officer.service.optedIn = false;
  facts.officer.purpose.expiresAt = "2026-09-01T00:00:00.000Z";
  facts.officer.passport.status = "suspended";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  for (const code of ["IDENTITY_NOT_CURRENT", "PSIRA_NOT_CURRENT", "GRADE_INSUFFICIENT", "SERVICE_QUALIFICATION_NOT_CURRENT", "PURPOSE_ENDORSEMENT_NOT_CURRENT", "PASSPORT_NOT_CURRENT"]) assert.ok(codes.includes(code), code);
});

test("a missing officer PSiRA expiry fails closed", () => {
  const facts = validFacts();
  facts.officer.psiraExpiry = null;
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["PSIRA_NOT_CURRENT"]);
});

test("a missing service-qualification expiry fails closed", () => {
  const facts = validFacts();
  facts.officer.service.qualificationExpiresAt = null;
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["SERVICE_QUALIFICATION_NOT_CURRENT"]);
});

test("service-qualification and purpose-endorsement expiries block independently", () => {
  const expiredService = validFacts();
  expiredService.officer.service.qualificationExpiresAt = "2026-09-07T05:59:59.999Z";
  let codes = evaluateAssignmentActivation(expiredService).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["SERVICE_QUALIFICATION_NOT_CURRENT"]);

  const expiredPurpose = validFacts();
  expiredPurpose.officer.purpose.expiresAt = "2026-09-07T05:59:59.999Z";
  codes = evaluateAssignmentActivation(expiredPurpose).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["PURPOSE_ENDORSEMENT_NOT_CURRENT"]);
});

test("Verified Network membership without an employment route cannot receive paid work", () => {
  const facts = validFacts();
  facts.workforce.engagementId = null;
  facts.workforce.model = null;
  facts.workforce.status = null;
  assert.ok(evaluateAssignmentActivation(facts).blockers.some((blocker) => blocker.code === "WORKFORCE_ROUTE_MISSING"));
});

test("an unsupported workforce model cannot become a paid-work route", () => {
  const facts = validFacts();
  facts.workforce.model = "verified_network";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("WORKFORCE_ROUTE_MISSING"));
});

test("a required launch gate cannot be downgraded from hard-gate enforcement", () => {
  const facts = validFacts();
  const gate = facts.launchGates.find((item) => item.code === "G1_PSIRA_PAPERWORK");
  assert.ok(gate);
  gate.hardGate = false;
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("LAUNCH_G1_PSIRA_PAPERWORK"));
});

test("activation rejects roster slots outside scheduled or uncovered states", () => {
  const facts = validFacts();
  facts.shift.slotStatus = "cancelled";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["ROSTER_SLOT_NOT_ACTIVATABLE"]);
});

test("primary activation fails closed at and after the scheduled start", () => {
  const facts = validFacts();
  facts.evaluatedAt = start;
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["SHIFT_ALREADY_STARTED"]);
});

test("revalidation fails after shift end and evidence must still be current at evaluation time", () => {
  const facts = validFacts();
  facts.checkpoint = "t_minus_24";
  facts.shift.slotStatus = "scheduled";
  facts.evaluatedAt = "2026-09-07T06:00:00.001Z";
  facts.officer.identity.expiresAt = end;
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("SHIFT_ALREADY_ENDED"));
  assert.ok(codes.includes("IDENTITY_NOT_CURRENT"));
});

test("check-in fails closed after the roster check-in deadline", () => {
  const facts = validFacts();
  facts.checkpoint = "check_in";
  facts.shift.slotStatus = "scheduled";
  facts.shift.checkInDueAt = "2026-09-06T17:50:00.000Z";
  facts.evaluatedAt = "2026-09-06T17:50:00.001Z";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.deepEqual(codes, ["CHECK_IN_WINDOW_CLOSED"]);
});

test("Direct Flex and Managed require LOKD payroll and benefits readiness", () => {
  for (const model of ["direct_flex", "managed"]) {
    const facts = validFacts();
    facts.workforce.model = model;
    facts.workforce.payrollStatus = "pending";
    facts.workforce.benefitsStatus = "pending";
    const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
    assert.ok(codes.includes("PAYROLL_ROUTE_NOT_READY"), model);
    assert.ok(codes.includes("STATUTORY_BENEFITS_NOT_READY"), model);
  }
});

test("partner supply separately confirms payroll and statutory-benefit responsibility", () => {
  const facts = validFacts();
  facts.workforce.model = "partner";
  facts.workforce.weeklyHourCap = null;
  facts.workforce.payrollStatus = "pending";
  facts.workforce.benefitsStatus = "pending";
  let codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("PARTNER_PAYROLL_NOT_CONFIRMED"));
  assert.ok(codes.includes("PARTNER_BENEFITS_NOT_CONFIRMED"));
  facts.workforce.payrollStatus = "partner_confirmed";
  facts.workforce.benefitsStatus = "partner_confirmed";
  codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(!codes.includes("PARTNER_PAYROLL_NOT_CONFIRMED"));
  assert.ok(!codes.includes("PARTNER_BENEFITS_NOT_CONFIRMED"));
});

test("Direct Flex, Managed and Partner routes reject missing accepted terms", () => {
  for (const model of ["direct_flex", "managed", "partner"]) {
    const facts = factsForWorkforceModel(model);
    facts.workforce.terms.id = null;
    facts.workforce.terms.evidenceReference = null;
    const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
    assert.deepEqual(codes, ["TERMS_NOT_ACCEPTED"], model);
  }
});

test("Direct Flex, Managed and Partner routes reject terms expiring before shift end", () => {
  for (const model of ["direct_flex", "managed", "partner"]) {
    const facts = factsForWorkforceModel(model);
    facts.workforce.terms.expiresAt = "2026-09-07T05:59:59.999Z";
    const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
    assert.deepEqual(codes, ["TERMS_NOT_ACCEPTED"], model);
  }
});

test("Direct Flex, Managed and Partner routes reject a terms version that differs from the engagement", () => {
  for (const model of ["direct_flex", "managed", "partner"]) {
    const facts = factsForWorkforceModel(model);
    facts.workforce.terms.version = "TERMS-v2";
    const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
    assert.deepEqual(codes, ["TERMS_NOT_ACCEPTED"], model);
  }
});

test("Direct Flex, Managed and Partner routes reject terms from the wrong environment", () => {
  for (const model of ["direct_flex", "managed", "partner"]) {
    const facts = factsForWorkforceModel(model);
    facts.workforce.terms.environment = "demo";
    const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
    assert.deepEqual(codes, ["TERMS_NOT_ACCEPTED"], model);
  }
});

test("employer evidence and review dates are checked independently", () => {
  const facts = validFacts();
  facts.workforce.employer.evidence = facts.workforce.employer.evidence.filter((item) => item.version !== "coida");
  facts.workforce.employer.reviewDueAt = "2026-09-07T05:00:00.000Z";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("EMPLOYER_COIDA_INVALID"));
  assert.ok(codes.includes("EMPLOYER_REVIEW_EXPIRES"));
});

test("availability, existing work, rest and travel must all pass", () => {
  const facts = validFacts();
  facts.schedule.available = false;
  facts.schedule.externalDeclarationCurrent = false;
  facts.schedule.conflicts.push({ id: "EXT-1", startsAt: "2026-09-06T10:00:00.000Z", endsAt: "2026-09-06T17:00:00.000Z", kind: "external work" });
  facts.schedule.travel.feasible = false;
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  for (const code of ["AVAILABILITY_NOT_CONFIRMED", "EXTERNAL_WORK_DECLARATION_MISSING", "WORK_OR_REST_CONFLICT", "TRAVEL_NOT_FEASIBLE"]) assert.ok(codes.includes(code), code);
});

test("availability and work-rest declarations require their own current evidence", () => {
  const facts = validFacts();
  facts.schedule.availability.evidenceReference = null;
  facts.schedule.declaration.status = "revoked";
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("AVAILABILITY_NOT_CONFIRMED"));
  assert.ok(codes.includes("EXTERNAL_WORK_DECLARATION_MISSING"));
});

test("relief and assignment minutes share the Direct Flex weekly ceiling", () => {
  const facts = validFacts();
  facts.schedule.existingWeekMinutes = { "2026-08-31": 1_300, "2026-09-07": 1_000 };
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("WEEKLY_HOUR_CAP_2026-08-31"));
  assert.ok(codes.includes("WEEKLY_HOUR_CAP_2026-09-07"));
});

test("urgency never changes the frozen officer offer and incomplete economics block", () => {
  const facts = validFacts();
  facts.compensation = { ...facts.compensation, ordinaryWageCents: 80000, holidayPremiumCents: 0, officerOfferCents: 80000, fundedOfferCents: 90000 };
  assert.ok(evaluateAssignmentActivation(facts).blockers.some((blocker) => blocker.code === "COMPENSATION_NOT_FROZEN"));
});

test("stored calendar and officer-offer mismatches fail closed", () => {
  const facts = validFacts();
  facts.compensation = {
    ...facts.compensation,
    storedCalendarCategory: "ordinary",
    calendarCategory: "christmas",
    storedOfficerOfferCents: 80000,
    ordinaryWageCents: 80000,
    holidayPremiumCents: 120000,
    officerOfferCents: 200000,
    fundedOfferCents: 200000,
    rosterServiceDate: "2026-12-25",
    derivedServiceDate: "2026-12-25",
  };
  const codes = evaluateAssignmentActivation(facts).blockers.map((blocker) => blocker.code);
  assert.ok(codes.includes("CALENDAR_CATEGORY_MISMATCH"));
  assert.ok(codes.includes("STORED_OFFICER_OFFER_MISMATCH"));
});

test("roster service date must equal the Johannesburg shift-start date", () => {
  const facts = validFacts();
  facts.compensation.serviceDateMatchesStart = false;
  facts.compensation.derivedServiceDate = "2026-09-02";
  assert.ok(evaluateAssignmentActivation(facts).blockers.some((blocker) => blocker.code === "ROSTER_SERVICE_DATE_MISMATCH"));
});

test("synthetic demo facts can never authorise production activation", () => {
  const facts = validFacts();
  facts.environment = "demo_synthetic";
  assert.ok(evaluateAssignmentActivation(facts).blockers.some((blocker) => blocker.code === "PRODUCTION_ENVIRONMENT_REQUIRED"));
});
