// Fictional payroll rules for engine tests only. Not a statutory policy.
export const FIXTURE_ENGINE_POLICY = {
  version: "synthetic-engine-test-v2",
  jurisdiction: "ZA",
  currency: "ZAR",
  effectiveFrom: "2000-01-01",
  effectiveTo: "2099-12-31",
  payPeriodsPerYear: 12,
  incomeTax: {
    brackets: [
      { upToAnnualCents: 1_200_000, rateBasisPoints: 1_000 },
      { upToAnnualCents: null, rateBasisPoints: 2_000 },
    ],
    annualPrimaryRebateCents: 12_000,
    annualSecondaryRebateCents: 0,
    annualTertiaryRebateCents: 0,
  },
  uif: {
    employeeRateBasisPoints: 100,
    employerRateBasisPoints: 100,
    earningsCapPerPeriodCents: 100_000,
  },
  skillsDevelopmentLevy: {
    enabled: true,
    employerRateBasisPoints: 100,
  },
  coida: {
    enabled: true,
    employerRateBasisPoints: 50,
    earningsCapPerPeriodCents: 100_000,
    classificationCode: "SYNTHETIC-DEMO",
    classificationReviewStatus: "approved",
  },
  leave: { hoursWorkedDivisor: 17 },
  wageRules: {
    ordinaryBasisPoints: 10_000,
    overtimeBasisPoints: 15_000,
    sundayOrdinaryBasisPoints: 15_000,
    sundayOccasionalBasisPoints: 20_000,
    publicHolidayBasisPoints: 20_000,
  },
  sourceReferences: ["https://example.invalid/synthetic-payroll-policy"],
};
