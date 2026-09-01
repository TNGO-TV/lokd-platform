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
    annualSecondaryRebateCents?: number;
    annualTertiaryRebateCents?: number;
    medicalSchemeCreditsPerPeriod?: {
      mainMemberCents: number;
      firstDependantCents: number;
      additionalDependantCents: number;
    };
    medicalSchemeCreditsMonthly?: {
      mainMemberCents: number;
      firstDependantCents: number;
      additionalDependantCents: number;
    };
  };
  uif: {
    employeeRateBasisPoints: number;
    employerRateBasisPoints: number;
    earningsCapPerPeriodCents: number;
    monthlyEarningsCapCents?: number;
  };
  skillsDevelopmentLevy: {
    enabled: boolean;
    employerRateBasisPoints: number;
    annualPayrollExemptionCents?: number;
  };
  coida?: {
    enabled: boolean;
    employerRateBasisPoints: number;
    earningsCapPerPeriodCents: number;
    classificationCode: string | null;
  };
  leave?: {
    hoursWorkedDivisor: number;
  };
  wageRules?: {
    ordinaryBasisPoints: number;
    overtimeBasisPoints: number;
    sundayOrdinaryBasisPoints: number;
    sundayOccasionalBasisPoints: number;
    publicHolidayBasisPoints: number;
  };
  privateSecuritySector?: {
    council: "NBCPSS";
    effectiveFrom: string;
    effectiveTo: string;
    monthlyMinimumWagesCents: {
      areasOneAndTwo: { gradeA: number; gradeB: number; gradeCDE: number };
      areaThree: { gradeA: number; gradeB: number; gradeCDE: number };
    };
    providentFund: {
      employeeRateBasisPoints: number;
      employerRateBasisPoints: number;
      treatmentStatus: "source_verified" | "pending_ruling";
    };
    councilLevy: {
      employeeMonthlyCents: number;
      employerMonthlyCents: number;
      treatmentStatus: "source_verified" | "pending_ruling";
    };
    healthCoverTreatmentStatus: "source_verified" | "pending_ruling";
  };
  sourceReferences?: string[];
};

export type PayrollEarningInput = {
  code: "ORDINARY" | "OVERTIME" | "SUNDAY" | "PUBLIC_HOLIDAY" | "NIGHT" | "ALLOWANCE" | string;
  description: string;
  minutes: number;
  baseHourlyRateCents: number;
  multiplierBasisPoints: number;
};

export type PayrollEarningLine = PayrollEarningInput & {
  amountCents: number;
};

export type PayrollCalculationInput = {
  serviceDate: string;
  earnings: PayrollEarningInput[];
  payPeriodsPerYear?: number;
  taxableAllowanceCents?: number;
  nonTaxableReimbursementCents?: number;
  employerProjectedAnnualPayrollCents?: number;
  ageAtTaxYearEnd?: number;
  medicalSchemeMembers?: number;
  deductibleRetirementContributionCents?: number;
  employeeHealthCoverCents?: number;
  otherLawfulDeductionCents?: number;
  lawfulDeductionEvidenceConfirmed?: boolean;
};

export type PayrollCalculation = {
  policyVersion: string;
  payPeriodsPerYear: number;
  grossCents: number;
  taxableRemunerationCents: number;
  payeCents: number;
  employeeUifCents: number;
  employeeProvidentFundCents: number;
  employeeCouncilLevyCents: number;
  employeeHealthCoverCents: number;
  otherLawfulDeductionCents: number;
  totalEmployeeDeductionsCents: number;
  netPayCents: number;
  employerUifCents: number;
  employerProvidentFundCents: number;
  employerCouncilLevyCents: number;
  skillsDevelopmentLevyCents: number;
  coidaProvisionCents: number;
  employerCostCents: number;
  leaveAccruedMinutes: number;
  earnings: PayrollEarningLine[];
};

function isIsoDate(value: string | null) {
  return value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function integerInRange(value: number, minimum: number, maximum: number) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function safeNonNegativeInteger(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer.`);
}

function perPeriodFromMonthly(monthlyCents: number, payPeriodsPerYear: number) {
  return Math.round((monthlyCents * 12) / payPeriodsPerYear);
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
  [
    policy.incomeTax.annualPrimaryRebateCents,
    policy.incomeTax.annualSecondaryRebateCents ?? 0,
    policy.incomeTax.annualTertiaryRebateCents ?? 0,
    policy.uif.earningsCapPerPeriodCents,
    policy.skillsDevelopmentLevy.annualPayrollExemptionCents ?? 0,
    policy.coida?.earningsCapPerPeriodCents ?? 0,
  ].forEach((value) => safeNonNegativeInteger(value, "Payroll policy amount"));
  const medical = policy.incomeTax.medicalSchemeCreditsMonthly
    ?? policy.incomeTax.medicalSchemeCreditsPerPeriod;
  if (medical) {
    [medical.mainMemberCents, medical.firstDependantCents, medical.additionalDependantCents]
      .forEach((value) => safeNonNegativeInteger(value, "Medical scheme credit"));
  }
  const rates = [
    policy.uif.employeeRateBasisPoints,
    policy.uif.employerRateBasisPoints,
    policy.skillsDevelopmentLevy.employerRateBasisPoints,
    policy.coida?.employerRateBasisPoints ?? 0,
    policy.wageRules?.ordinaryBasisPoints ?? 10_000,
    policy.wageRules?.overtimeBasisPoints ?? 10_000,
    policy.wageRules?.sundayOrdinaryBasisPoints ?? 10_000,
    policy.wageRules?.sundayOccasionalBasisPoints ?? 10_000,
    policy.wageRules?.publicHolidayBasisPoints ?? 10_000,
  ];
  if (rates.some((value) => !integerInRange(value, 0, 100_000))) throw new Error("A payroll rate is outside the permitted range.");
  if (policy.leave && (!Number.isInteger(policy.leave.hoursWorkedDivisor) || policy.leave.hoursWorkedDivisor < 1 || policy.leave.hoursWorkedDivisor > 366)) {
    throw new Error("The leave accrual divisor is invalid.");
  }
  if (policy.coida?.enabled && (!policy.coida.classificationCode?.trim() || policy.coida.earningsCapPerPeriodCents < 1)) {
    throw new Error("An enabled COIDA rule requires a classification and positive earnings cap.");
  }
  if (policy.sourceReferences && (policy.sourceReferences.length > 20 || policy.sourceReferences.some((value) => !/^https:\/\//.test(value)))) {
    throw new Error("Payroll policy source references must be bounded HTTPS URLs.");
  }
  if (policy.uif.monthlyEarningsCapCents !== undefined) {
    safeNonNegativeInteger(policy.uif.monthlyEarningsCapCents, "Monthly UIF earnings cap");
  }
  const sector = policy.privateSecuritySector;
  if (sector) {
    if (sector.council !== "NBCPSS" || !isIsoDate(sector.effectiveFrom) || !isIsoDate(sector.effectiveTo)
      || sector.effectiveTo < sector.effectiveFrom) {
      throw new Error("The private-security sector policy period is invalid.");
    }
    const wages = [
      sector.monthlyMinimumWagesCents.areasOneAndTwo.gradeA,
      sector.monthlyMinimumWagesCents.areasOneAndTwo.gradeB,
      sector.monthlyMinimumWagesCents.areasOneAndTwo.gradeCDE,
      sector.monthlyMinimumWagesCents.areaThree.gradeA,
      sector.monthlyMinimumWagesCents.areaThree.gradeB,
      sector.monthlyMinimumWagesCents.areaThree.gradeCDE,
    ];
    wages.forEach((value) => safeNonNegativeInteger(value, "Sector minimum wage"));
    if (wages.some((value) => value < 1)) throw new Error("Sector minimum wages must be positive.");
    [sector.providentFund.employeeRateBasisPoints, sector.providentFund.employerRateBasisPoints]
      .forEach((value) => {
        if (!integerInRange(value, 0, 10_000)) throw new Error("A provident-fund rate is outside the permitted range.");
      });
    [sector.councilLevy.employeeMonthlyCents, sector.councilLevy.employerMonthlyCents]
      .forEach((value) => safeNonNegativeInteger(value, "Council levy"));
  }
}

function basisPoints(amountCents: number, rateBasisPoints: number) {
  const result = Math.round((amountCents * rateBasisPoints) / 10_000);
  if (!Number.isSafeInteger(result)) throw new Error("The payroll rate calculation exceeds the safe range.");
  return result;
}

function payeForPeriod(taxableRemunerationCents: number, input: PayrollCalculationInput, policy: PayrollPolicy, payPeriodsPerYear: number) {
  const annualGrossCents = taxableRemunerationCents * payPeriodsPerYear;
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
  const age = input.ageAtTaxYearEnd ?? 0;
  let annualRebatesCents = policy.incomeTax.annualPrimaryRebateCents;
  if (age >= 65) annualRebatesCents += policy.incomeTax.annualSecondaryRebateCents ?? 0;
  if (age >= 75) annualRebatesCents += policy.incomeTax.annualTertiaryRebateCents ?? 0;
  const members = input.medicalSchemeMembers ?? 0;
  const monthlyMedical = policy.incomeTax.medicalSchemeCreditsMonthly;
  const legacyPeriodMedical = policy.incomeTax.medicalSchemeCreditsPerPeriod;
  const medicalCreditForConfiguredPeriod = (medical: NonNullable<typeof monthlyMedical>) =>
    medical.mainMemberCents
      + (members > 1 ? medical.firstDependantCents : 0)
      + Math.max(0, members - 2) * medical.additionalDependantCents;
  const periodMedicalCreditCents = members < 1 ? 0
    : monthlyMedical
      ? Math.round((medicalCreditForConfiguredPeriod(monthlyMedical) * 12) / payPeriodsPerYear)
      : legacyPeriodMedical
        ? Math.round((medicalCreditForConfiguredPeriod(legacyPeriodMedical) * policy.payPeriodsPerYear) / payPeriodsPerYear)
        : 0;
  annualTaxCents = Math.max(0, annualTaxCents - annualRebatesCents - periodMedicalCreditCents * payPeriodsPerYear);
  return Math.round(annualTaxCents / payPeriodsPerYear);
}

export function earningLineAmount(input: PayrollEarningInput) {
  if (!input.code.trim() || input.code.length > 50 || !input.description.trim() || input.description.length > 160) {
    throw new Error("Each earning line requires a bounded code and description.");
  }
  safeNonNegativeInteger(input.minutes, "Earning minutes");
  safeNonNegativeInteger(input.baseHourlyRateCents, "Hourly rate");
  if (!integerInRange(input.multiplierBasisPoints, 0, 100_000)) throw new Error("The earning multiplier is outside the permitted range.");
  const numerator = input.baseHourlyRateCents * input.minutes * input.multiplierBasisPoints;
  if (!Number.isSafeInteger(numerator)) throw new Error("The earning line exceeds the safe calculation range.");
  return Math.round(numerator / (60 * 10_000));
}

export function calculatePayrollStatement(input: PayrollCalculationInput, policy: PayrollPolicy): PayrollCalculation {
  assertPayrollPolicy(policy);
  if (!isIsoDate(input.serviceDate)) throw new Error("The service date must use YYYY-MM-DD.");
  if (input.serviceDate < policy.effectiveFrom || (policy.effectiveTo && input.serviceDate > policy.effectiveTo)) {
    throw new Error("No approved payroll policy covers this service date.");
  }
  if (!Array.isArray(input.earnings) || input.earnings.length < 1 || input.earnings.length > 100) {
    throw new Error("A payroll calculation requires one to one hundred earning lines.");
  }
  if (!integerInRange(input.ageAtTaxYearEnd ?? 0, 0, 130)) throw new Error("The employee age input is invalid.");
  if (!integerInRange(input.medicalSchemeMembers ?? 0, 0, 100)) throw new Error("The medical scheme member count is invalid.");
  const payPeriodsPerYear = input.payPeriodsPerYear ?? policy.payPeriodsPerYear;
  if (!integerInRange(payPeriodsPerYear, 1, 366)) throw new Error("The payroll period count is invalid.");
  safeNonNegativeInteger(input.taxableAllowanceCents ?? 0, "Taxable allowance");
  safeNonNegativeInteger(input.nonTaxableReimbursementCents ?? 0, "Non-taxable reimbursement");
  safeNonNegativeInteger(input.deductibleRetirementContributionCents ?? 0, "Deductible retirement contribution");
  safeNonNegativeInteger(input.employeeHealthCoverCents ?? 0, "Employee health-cover deduction");
  safeNonNegativeInteger(input.otherLawfulDeductionCents ?? 0, "Other lawful deduction");
  if (((input.employeeHealthCoverCents ?? 0) > 0 || (input.otherLawfulDeductionCents ?? 0) > 0)
    && !input.lawfulDeductionEvidenceConfirmed) {
    throw new Error("Health-cover and other deductions require confirmed lawful deduction evidence.");
  }
  if (input.employerProjectedAnnualPayrollCents !== undefined) {
    safeNonNegativeInteger(input.employerProjectedAnnualPayrollCents, "Projected annual employer payroll");
  }

  const earnings = input.earnings.map((line) => ({ ...line, amountCents: earningLineAmount(line) }));
  const grossCents = earnings.reduce((total, line) => total + line.amountCents, input.taxableAllowanceCents ?? 0);
  safeNonNegativeInteger(grossCents, "Gross pay");
  const deductibleRetirementContributionCents = input.deductibleRetirementContributionCents ?? 0;
  if (deductibleRetirementContributionCents > grossCents) {
    throw new Error("The deductible retirement contribution exceeds gross remuneration.");
  }
  const taxableRemunerationCents = grossCents - deductibleRetirementContributionCents;
  const payeCents = payeForPeriod(taxableRemunerationCents, input, policy, payPeriodsPerYear);
  const uifCapCents = policy.uif.monthlyEarningsCapCents === undefined
    ? policy.uif.earningsCapPerPeriodCents
    : perPeriodFromMonthly(policy.uif.monthlyEarningsCapCents, payPeriodsPerYear);
  const uifBaseCents = Math.min(grossCents, uifCapCents);
  const employeeUifCents = basisPoints(uifBaseCents, policy.uif.employeeRateBasisPoints);
  const employerUifCents = basisPoints(uifBaseCents, policy.uif.employerRateBasisPoints);
  const sector = policy.privateSecuritySector;
  const employeeProvidentFundCents = sector
    ? basisPoints(grossCents, sector.providentFund.employeeRateBasisPoints)
    : 0;
  const employerProvidentFundCents = sector
    ? basisPoints(grossCents, sector.providentFund.employerRateBasisPoints)
    : 0;
  const employeeCouncilLevyCents = sector
    ? perPeriodFromMonthly(sector.councilLevy.employeeMonthlyCents, payPeriodsPerYear)
    : 0;
  const employerCouncilLevyCents = sector
    ? perPeriodFromMonthly(sector.councilLevy.employerMonthlyCents, payPeriodsPerYear)
    : 0;
  const employeeHealthCoverCents = input.employeeHealthCoverCents ?? 0;
  const otherLawfulDeductionCents = input.otherLawfulDeductionCents ?? 0;
  const sdlExemptionCents = policy.skillsDevelopmentLevy.annualPayrollExemptionCents;
  if (policy.skillsDevelopmentLevy.enabled && sdlExemptionCents !== undefined
    && input.employerProjectedAnnualPayrollCents === undefined) {
    throw new Error("The SDL policy requires projected annual employer payroll.");
  }
  const skillsDevelopmentLevyCents = policy.skillsDevelopmentLevy.enabled
    && (sdlExemptionCents === undefined || (input.employerProjectedAnnualPayrollCents ?? 0) > sdlExemptionCents)
    ? basisPoints(grossCents, policy.skillsDevelopmentLevy.employerRateBasisPoints)
    : 0;
  const coidaBaseCents = Math.min(grossCents, policy.coida?.earningsCapPerPeriodCents ?? grossCents);
  const coidaProvisionCents = policy.coida?.enabled
    ? basisPoints(coidaBaseCents, policy.coida.employerRateBasisPoints)
    : 0;
  const totalEmployeeDeductionsCents = payeCents + employeeUifCents + employeeProvidentFundCents
    + employeeCouncilLevyCents + employeeHealthCoverCents + otherLawfulDeductionCents;
  const cashBeforeDeductionsCents = grossCents + (input.nonTaxableReimbursementCents ?? 0);
  if (totalEmployeeDeductionsCents > cashBeforeDeductionsCents) {
    throw new Error("Employee deductions exceed the cash remuneration available for the period.");
  }
  const leaveAccruedMinutes = policy.leave
    ? Math.round(earnings.reduce((total, line) => total + line.minutes, 0) / policy.leave.hoursWorkedDivisor)
    : 0;
  return {
    policyVersion: policy.version,
    payPeriodsPerYear,
    grossCents,
    taxableRemunerationCents,
    payeCents,
    employeeUifCents,
    employeeProvidentFundCents,
    employeeCouncilLevyCents,
    employeeHealthCoverCents,
    otherLawfulDeductionCents,
    totalEmployeeDeductionsCents,
    netPayCents: cashBeforeDeductionsCents - totalEmployeeDeductionsCents,
    employerUifCents,
    employerProvidentFundCents,
    employerCouncilLevyCents,
    skillsDevelopmentLevyCents,
    coidaProvisionCents,
    employerCostCents: grossCents + employerUifCents + employerProvidentFundCents
      + employerCouncilLevyCents + skillsDevelopmentLevyCents + coidaProvisionCents,
    leaveAccruedMinutes,
    earnings,
  };
}

export function calculatePayrollItem(grossCents: number, serviceDate: string, policy: PayrollPolicy): PayrollCalculation {
  safeNonNegativeInteger(grossCents, "Gross pay");
  return calculatePayrollStatement({
    serviceDate,
    earnings: [{
      code: "GROSS",
      description: "Approved gross remuneration",
      minutes: 60,
      baseHourlyRateCents: grossCents,
      multiplierBasisPoints: 10_000,
    }],
  }, policy);
}

export const SYNTHETIC_ENGINE_TEST_POLICY: PayrollPolicy = {
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

export const ZA_2027_SARS_POLICY_CANDIDATE: PayrollPolicy = {
  version: "ZA-SARS-NBCPSS-2027-CANDIDATE-2026-09-01",
  jurisdiction: "ZA",
  currency: "ZAR",
  effectiveFrom: "2026-03-01",
  effectiveTo: "2027-02-28",
  payPeriodsPerYear: 12,
  incomeTax: {
    brackets: [
      { upToAnnualCents: 24_510_000, rateBasisPoints: 1_800 },
      { upToAnnualCents: 38_310_000, rateBasisPoints: 2_600 },
      { upToAnnualCents: 53_020_000, rateBasisPoints: 3_100 },
      { upToAnnualCents: 69_580_000, rateBasisPoints: 3_600 },
      { upToAnnualCents: 88_700_000, rateBasisPoints: 3_900 },
      { upToAnnualCents: 187_860_000, rateBasisPoints: 4_100 },
      { upToAnnualCents: null, rateBasisPoints: 4_500 },
    ],
    annualPrimaryRebateCents: 1_782_000,
    annualSecondaryRebateCents: 976_500,
    annualTertiaryRebateCents: 324_900,
    medicalSchemeCreditsMonthly: {
      mainMemberCents: 37_600,
      firstDependantCents: 37_600,
      additionalDependantCents: 25_400,
    },
  },
  uif: {
    employeeRateBasisPoints: 100,
    employerRateBasisPoints: 100,
    earningsCapPerPeriodCents: 1_771_200,
    monthlyEarningsCapCents: 1_771_200,
  },
  skillsDevelopmentLevy: {
    enabled: true,
    employerRateBasisPoints: 100,
    annualPayrollExemptionCents: 50_000_000,
  },
  coida: {
    enabled: false,
    employerRateBasisPoints: 0,
    earningsCapPerPeriodCents: 0,
    classificationCode: null,
  },
  leave: { hoursWorkedDivisor: 17 },
  wageRules: {
    ordinaryBasisPoints: 10_000,
    overtimeBasisPoints: 15_000,
    sundayOrdinaryBasisPoints: 15_000,
    sundayOccasionalBasisPoints: 20_000,
    publicHolidayBasisPoints: 20_000,
  },
  privateSecuritySector: {
    council: "NBCPSS",
    effectiveFrom: "2026-03-01",
    effectiveTo: "2027-02-28",
    monthlyMinimumWagesCents: {
      areasOneAndTwo: { gradeA: 818_400, gradeB: 760_700, gradeCDE: 700_300 },
      areaThree: { gradeA: 714_200, gradeB: 672_600, gradeCDE: 672_600 },
    },
    providentFund: {
      employeeRateBasisPoints: 750,
      employerRateBasisPoints: 750,
      treatmentStatus: "source_verified",
    },
    councilLevy: {
      employeeMonthlyCents: 940,
      employerMonthlyCents: 0,
      treatmentStatus: "source_verified",
    },
    healthCoverTreatmentStatus: "pending_ruling",
  },
  sourceReferences: [
    "https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/",
    "https://www.sars.gov.za/guide-for-employers-in-respect-of-employees-tax-2027/",
    "https://www.sars.gov.za/types-of-tax/unemployment-insurance-fund/",
    "https://www.labour.gov.za/DocumentCenter/Pages/Basic-Guide-to-Pay-Slips.aspx",
    "https://www.labour.gov.za/DocumentCenter/Pages/Basic-Guide-to-Annual-Leave.aspx",
    "https://nbcpss.org.za/wp-content/uploads/2026/02/CIRCULAR-MINIMUM-WAGE-INCREASE-2026-2027.pdf",
    "https://nbcpss.org.za/2026/01/30/nbcpss-reminder-circular-levy-increase/",
  ],
};

export type PrivateSecurityWageArea = "areas_one_and_two" | "area_three";
export type PrivateSecurityGrade = "A" | "B" | "C" | "D" | "E";

export function privateSecurityMinimumWage(
  policy: PayrollPolicy,
  area: PrivateSecurityWageArea,
  grade: PrivateSecurityGrade,
) {
  const sector = policy.privateSecuritySector;
  if (!sector) throw new Error("The payroll policy has no private-security wage schedule.");
  const schedule = area === "areas_one_and_two"
    ? sector.monthlyMinimumWagesCents.areasOneAndTwo
    : sector.monthlyMinimumWagesCents.areaThree;
  return grade === "A" ? schedule.gradeA : grade === "B" ? schedule.gradeB : schedule.gradeCDE;
}

export function privateSecurityWageFloorDecision(input: {
  policy: PayrollPolicy;
  serviceDate: string;
  area: PrivateSecurityWageArea;
  grade: PrivateSecurityGrade;
  monthlyBasicCents: number;
}) {
  safeNonNegativeInteger(input.monthlyBasicCents, "Monthly basic remuneration");
  const sector = input.policy.privateSecuritySector;
  if (!sector) return { compliant: false, minimumMonthlyCents: 0, shortfallCents: 0, blockers: ["The policy has no NBCPSS wage schedule."] };
  const blockers: string[] = [];
  if (input.serviceDate < sector.effectiveFrom || input.serviceDate > sector.effectiveTo) {
    blockers.push("The NBCPSS wage schedule does not cover the service date.");
  }
  const minimumMonthlyCents = privateSecurityMinimumWage(input.policy, input.area, input.grade);
  const shortfallCents = Math.max(0, minimumMonthlyCents - input.monthlyBasicCents);
  if (shortfallCents > 0) blockers.push("The monthly basic remuneration is below the applicable NBCPSS minimum.");
  return { compliant: blockers.length === 0, minimumMonthlyCents, shortfallCents, blockers };
}
