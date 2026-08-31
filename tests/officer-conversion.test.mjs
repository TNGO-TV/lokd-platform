import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateOfficerConversionFee,
  conversionTenurePercent,
  OFFICER_CONVERSION_POLICY,
  officerConversionReadiness,
} from "../app/lib/officer-conversion-core.ts";

test("assigned-officer conversion fees apply the approved grade and tenure schedule", () => {
  assert.deepEqual(calculateOfficerConversionFee({
    route: "assigned_officer_conversion",
    officerGrade: "Grade C",
    specialistCategory: "standard",
    completedServiceMonths: 2,
  }), {
    minimumFeeCents: 1_250_000,
    tenurePercent: 100,
    percentageFeeCents: null,
    calculatedFeeCents: 1_250_000,
  });
  assert.equal(calculateOfficerConversionFee({
    route: "assigned_officer_conversion",
    officerGrade: "Grade B",
    specialistCategory: "standard",
    completedServiceMonths: 8,
  }).calculatedFeeCents, 700_000);
  assert.equal(calculateOfficerConversionFee({
    route: "assigned_officer_conversion",
    officerGrade: "Grade A",
    specialistCategory: "armed",
    completedServiceMonths: 14,
  }).calculatedFeeCents, 500_000);
  assert.equal(calculateOfficerConversionFee({
    route: "assigned_officer_conversion",
    officerGrade: "Grade A",
    specialistCategory: "vip_tactical",
    completedServiceMonths: 5,
  }).calculatedFeeCents, 1_875_000);
});

test("tenure reductions use the approved month boundaries", () => {
  assert.deepEqual([0, 3, 4, 6, 7, 12, 13].map(conversionTenurePercent), [100, 100, 75, 75, 50, 50, 25]);
});

test("private recruitment uses 15 percent of first-year guaranteed cash subject to the minimum", () => {
  assert.equal(calculateOfficerConversionFee({
    route: "private_recruitment_enquiry",
    officerGrade: "Grade C",
    specialistCategory: "standard",
    completedServiceMonths: 0,
    annualGuaranteedCashCents: 6_000_000,
  }).calculatedFeeCents, 1_250_000);
  assert.equal(calculateOfficerConversionFee({
    route: "private_recruitment_enquiry",
    officerGrade: "Grade B",
    specialistCategory: "standard",
    completedServiceMonths: 0,
    annualGuaranteedCashCents: 12_000_000,
  }).calculatedFeeCents, 1_800_000);
});

test("handover fails closed on PEA, clause, employer, close-out, transfer and cleared-funds controls", () => {
  const blocked = officerConversionReadiness({
    status: "offer_accepted",
    clauseAcknowledged: true,
    peaGatePassed: false,
    offerAccepted: true,
    clientEmployerPackReady: true,
    lokdPayrollCloseoutReady: true,
    psiraTransferReady: true,
    feePaid: false,
  });
  assert.equal(blocked.ready, false);
  assert.match(blocked.blockers.join(" "), /Private Employment Agency/);
  assert.match(blocked.blockers.join(" "), /fee has not been cleared/);
  assert.equal(officerConversionReadiness({
    status: "offer_accepted",
    clauseAcknowledged: true,
    peaGatePassed: true,
    offerAccepted: true,
    clientEmployerPackReady: true,
    lokdPayrollCloseoutReady: true,
    psiraTransferReady: true,
    feePaid: true,
  }).ready, true);
  assert.equal(OFFICER_CONVERSION_POLICY.clientCreditTermsDays, 0);
  assert.equal(OFFICER_CONVERSION_POLICY.officerPaysFee, false);
});
