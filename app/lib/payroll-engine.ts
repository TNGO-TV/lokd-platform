export type PayrollTaxBracket = {
  upToAnnualCents: number | null;
  rateBasisPoints: number;
};

export type PayrollPolicy = {
  version: string;
  jurisdiction: "ZA";
  currency: "ZAR";
  effectiveFrom: string;
  effectiveTo: string | null;
  payPeriodsPerYear: number;
  incomeTax: {
    brackets: PayrollTaxBracket[];
    annualPrimaryRebateCents: number;
  };
  uif: {
    employeeRateBasisPoints: number;
    employerRateBasisPoints: number;
    earningsCapPerPeriodCents: number;
  };
  skillsDevelopmentLevy: {
    enabled: boolean;
    employerRateBasisPoints: number;
  };
};

export type PayrollCalculation = {
  policyVersion: string;
  grossCents: number;
  payeCents: number;
  employeeUifCents: number;
  totalEmployeeDeductionsCents: number;
  netPayCents: number;
  employerUifCents: number;
  skillsDevelopmentLevyCents: number;
  employerCostCents: number;
};

function isIsoDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function integerInRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function assertPayrollPolicy(policy: PayrollPolicy) {
  if (!policy.version.trim() || policy.version.length > 120) throw new Error("A bounded payroll policy version is required.");
  if (policy.jurisdiction !== "ZA" || policy.currency !== "ZAR") throw new Error("This engine accepts South African rand policies only.");
  if (!isIsoDate(policy.effectiveFrom) || !isIsoDate(policy.effectiveTo)) throw new Error("Payroll policy dates must use YYYY-MM-DD.");
  if (policy.effectiveTo && policy.effectiveTo < policy.effectiveFrom) throw new Error("The payroll policy end date precedes its start date.");
  if (!integerInRange(policy.payPeriodsPerYear, 1, 366)) throw new Error("The payroll period count is invalid.");
  if (!Array.isArray(policy.incomeTax.brackets) || policy.incomeTax.brackets.length < 1 || policy.incomeTax.brackets.length > 20) {
    throw new Error("The payroll policy requires one to twenty ordered income-tax brackets.");
  }
  let previousThreshold = 0;
  for (const [index, bracket] of policy.incomeTax.brackets.entries()) {
    if (!integerInRange(bracket.rateBasisPoints, 0, 10_000)) throw new Error("An income-tax rate is outside the permitted range.");
    const last = index === policy.incomeTax.brackets.length - 1;
    if (bracket.upToAnnualCents === null) {
      if (!last) throw new Error("Only the final income-tax bracket may be unbounded.");
      continue;
    }
    if (!Number.isSafeInteger(bracket.upToAnnualCents) || bracket.upToAnnualCents <= previousThreshold) {
      throw new Error("Income-tax bracket thresholds must be positive and strictly increasing.");
    }
    previousThreshold = bracket.upToAnnualCents;
    if (last) throw new Error("The final income-tax bracket must be unbounded.");
  }
  const nonNegativeSafeIntegers = [
    policy.incomeTax.annualPrimaryRebateCents,
    policy.uif.earningsCapPerPeriodCents,
  ];
  if (nonNegativeSafeIntegers.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("Payroll policy amounts must be non-negative safe integers.");
  }
  const rates = [
    policy.uif.employeeRateBasisPoints,
    policy.uif.employerRateBasisPoints,
    policy.skillsDevelopmentLevy.employerRateBasisPoints,
  ];
  if (rates.some((value) => !integerInRange(value, 0, 10_000))) throw new Error("A payroll contribution rate is outside the permitted range.");
}

function basisPoints(amountCents: number, rateBasisPoints: number) {
  return Math.round((amountCents * rateBasisPoints) / 10_000);
}

export function calculatePayrollItem(grossCents: number, serviceDate: string, policy: PayrollPolicy): PayrollCalculation {
  assertPayrollPolicy(policy);
  if (!Number.isSafeInteger(grossCents) || grossCents < 0) throw new Error("Gross pay must be a non-negative safe integer.");
  if (!isIsoDate(serviceDate)) throw new Error("The service date must use YYYY-MM-DD.");
  if (serviceDate < policy.effectiveFrom || (policy.effectiveTo && serviceDate > policy.effectiveTo)) {
    throw new Error("No approved payroll policy covers this service date.");
  }

  const annualGrossCents = grossCents * policy.payPeriodsPerYear;
  if (!Number.isSafeInteger(annualGrossCents)) throw new Error("Annualised gross pay exceeds the safe calculation range.");
  let lowerBound = 0;
  let annualTaxCents = 0;
  for (const bracket of policy.incomeTax.brackets) {
    const upperBound = bracket.upToAnnualCents ?? annualGrossCents;
    const taxableInBracket = Math.max(0, Math.min(annualGrossCents, upperBound) - lowerBound);
    annualTaxCents += basisPoints(taxableInBracket, bracket.rateBasisPoints);
    if (annualGrossCents <= upperBound) break;
    lowerBound = upperBound;
  }
  annualTaxCents = Math.max(0, annualTaxCents - policy.incomeTax.annualPrimaryRebateCents);
  const payeCents = Math.round(annualTaxCents / policy.payPeriodsPerYear);
  const uifBaseCents = Math.min(grossCents, policy.uif.earningsCapPerPeriodCents);
  const employeeUifCents = basisPoints(uifBaseCents, policy.uif.employeeRateBasisPoints);
  const employerUifCents = basisPoints(uifBaseCents, policy.uif.employerRateBasisPoints);
  const skillsDevelopmentLevyCents = policy.skillsDevelopmentLevy.enabled
    ? basisPoints(grossCents, policy.skillsDevelopmentLevy.employerRateBasisPoints)
    : 0;
  const totalEmployeeDeductionsCents = payeCents + employeeUifCents;
  return {
    policyVersion: policy.version,
    grossCents,
    payeCents,
    employeeUifCents,
    totalEmployeeDeductionsCents,
    netPayCents: Math.max(0, grossCents - totalEmployeeDeductionsCents),
    employerUifCents,
    skillsDevelopmentLevyCents,
    employerCostCents: grossCents + employerUifCents + skillsDevelopmentLevyCents,
  };
}

export const SYNTHETIC_ENGINE_TEST_POLICY: PayrollPolicy = {
  version: "synthetic-engine-test-v1",
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
};
