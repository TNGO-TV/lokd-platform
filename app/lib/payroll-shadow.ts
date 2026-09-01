import {
  assertPayrollPolicy,
  calculatePayrollStatement,
  earningLineAmount,
  privateSecurityWageFloorDecision,
  type PayrollPolicy,
} from "./payroll-engine";

export type PayrollShadowScenario = {
  code: string;
  label: string;
  status: "passed" | "failed";
  expected: string;
  observed: string;
  detail: string;
};

export type PayrollShadowValidation = {
  engineVersion: "payroll-engine-v3-shadow";
  policyVersion: string;
  status: "passed" | "failed";
  scenarioCount: number;
  passedCount: number;
  failedCount: number;
  activationEligible: false;
  settlementLocked: true;
  scenarios: PayrollShadowScenario[];
  activationBlockers: string[];
};

function scenario(
  code: string,
  label: string,
  passed: boolean,
  expected: string,
  observed: string,
  detail: string,
): PayrollShadowScenario {
  return { code, label, status: passed ? "passed" : "failed", expected, observed, detail };
}

export function runPayrollShadowValidation(policy: PayrollPolicy): PayrollShadowValidation {
  assertPayrollPolicy(policy);
  const scenarios: PayrollShadowScenario[] = [];

  const sarsMonthly = calculatePayrollStatement({
    serviceDate: "2026-09-01",
    payPeriodsPerYear: 12,
    earnings: [{
      code: "ORDINARY",
      description: "SARS monthly remuneration example",
      minutes: 60,
      baseHourlyRateCents: 1_860_000,
      multiplierBasisPoints: 10_000,
    }],
    deductibleRetirementContributionCents: 110_000,
    medicalSchemeMembers: 2,
    employerProjectedAnnualPayrollCents: 100_000_000,
  }, policy);
  const payeVarianceCents = Math.abs(sarsMonthly.payeCents - 91_300);
  scenarios.push(scenario(
    "SARS_MONTHLY_STATUTORY_RATE",
    "Monthly PAYE statutory-rate calculation",
    payeVarianceCents <= 500,
    "R913.00 within the SARS-permitted statutory-program variance",
    `R${(sarsMonthly.payeCents / 100).toFixed(2)}`,
    "R18,600 remuneration less R1,100 deductible retirement funding, with two medical-scheme members.",
  ));

  const uifMonthly = calculatePayrollStatement({
    serviceDate: "2026-09-01",
    earnings: [{ code: "ORDINARY", description: "UIF cap check", minutes: 60, baseHourlyRateCents: 3_000_000, multiplierBasisPoints: 10_000 }],
    employerProjectedAnnualPayrollCents: 100_000_000,
  }, policy);
  scenarios.push(scenario(
    "UIF_MONTHLY_CAP",
    "Monthly UIF ceiling",
    uifMonthly.employeeUifCents === 17_712 && uifMonthly.employerUifCents === 17_712,
    "R177.12 employee and R177.12 employer",
    `R${(uifMonthly.employeeUifCents / 100).toFixed(2)} / R${(uifMonthly.employerUifCents / 100).toFixed(2)}`,
    "The 1% contribution is capped at monthly remuneration of R17,712.",
  ));

  const uifWeekly = calculatePayrollStatement({
    serviceDate: "2026-09-01",
    payPeriodsPerYear: 52,
    earnings: [{ code: "ORDINARY", description: "Weekly UIF conversion", minutes: 60, baseHourlyRateCents: 1_000_000, multiplierBasisPoints: 10_000 }],
    employerProjectedAnnualPayrollCents: 100_000_000,
  }, policy);
  scenarios.push(scenario(
    "UIF_WEEKLY_CONVERSION",
    "Weekly UIF ceiling conversion",
    uifWeekly.employeeUifCents === 4_087,
    "R40.87 employee UIF",
    `R${(uifWeekly.employeeUifCents / 100).toFixed(2)}`,
    "The monthly ceiling is annualised and divided across 52 configured pay periods.",
  ));

  const wagePass = privateSecurityWageFloorDecision({
    policy,
    serviceDate: "2026-09-01",
    area: "areas_one_and_two",
    grade: "C",
    monthlyBasicCents: 700_300,
  });
  const wageFail = privateSecurityWageFloorDecision({
    policy,
    serviceDate: "2026-09-01",
    area: "areas_one_and_two",
    grade: "C",
    monthlyBasicCents: 700_299,
  });
  scenarios.push(scenario(
    "NBCPSS_GRADE_C_FLOOR",
    "Johannesburg Grade C monthly wage floor",
    wagePass.compliant && !wageFail.compliant && wageFail.shortfallCents === 1,
    "R7,003.00 passes and R7,002.99 fails",
    `minimum R${(wagePass.minimumMonthlyCents / 100).toFixed(2)}`,
    "The NBCPSS circular states that its hourly equivalent must not replace the ordinary monthly basic salary.",
  ));

  const gradeC = calculatePayrollStatement({
    serviceDate: "2026-09-01",
    earnings: [{ code: "ORDINARY", description: "NBCPSS Grade C monthly basic", minutes: 60, baseHourlyRateCents: 700_300, multiplierBasisPoints: 10_000 }],
    employerProjectedAnnualPayrollCents: 100_000_000,
  }, policy);
  scenarios.push(scenario(
    "PSSPF_CONTRIBUTIONS",
    "Private Security Sector Provident Fund",
    gradeC.employeeProvidentFundCents === 52_523 && gradeC.employerProvidentFundCents === 52_523,
    "7.5% employee and 7.5% employer",
    `${gradeC.employeeProvidentFundCents}c / ${gradeC.employerProvidentFundCents}c`,
    "The shadow candidate records both sides separately and never treats the employer contribution as an employee deduction.",
  ));
  scenarios.push(scenario(
    "NBCPSS_EMPLOYEE_LEVY",
    "NBCPSS employee levy",
    gradeC.employeeCouncilLevyCents === 940,
    "R9.40 monthly employee levy",
    `R${(gradeC.employeeCouncilLevyCents / 100).toFixed(2)}`,
    "The levy remains an itemised deduction rather than being hidden inside net pay.",
  ));

  const multipliers = policy.wageRules;
  const ordinary = earningLineAmount({ code: "ORDINARY", description: "Ordinary", minutes: 60, baseHourlyRateCents: 10_000, multiplierBasisPoints: multipliers?.ordinaryBasisPoints ?? 10_000 });
  const overtime = earningLineAmount({ code: "OVERTIME", description: "Overtime", minutes: 60, baseHourlyRateCents: 10_000, multiplierBasisPoints: multipliers?.overtimeBasisPoints ?? 15_000 });
  const publicHoliday = earningLineAmount({ code: "PUBLIC_HOLIDAY", description: "Public holiday", minutes: 60, baseHourlyRateCents: 10_000, multiplierBasisPoints: multipliers?.publicHolidayBasisPoints ?? 20_000 });
  scenarios.push(scenario(
    "EARNING_MULTIPLIERS",
    "Ordinary, overtime and public-holiday multipliers",
    ordinary === 10_000 && overtime === 15_000 && publicHoliday === 20_000,
    "R100.00 / R150.00 / R200.00",
    `R${(ordinary / 100).toFixed(2)} / R${(overtime / 100).toFixed(2)} / R${(publicHoliday / 100).toFixed(2)}`,
    "Each category remains a separate pay line for the officer and payslip record.",
  ));

  let deductionEvidenceBlocked = false;
  try {
    calculatePayrollStatement({
      serviceDate: "2026-09-01",
      earnings: [{ code: "ORDINARY", description: "Deduction evidence check", minutes: 60, baseHourlyRateCents: 700_300, multiplierBasisPoints: 10_000 }],
      employeeHealthCoverCents: 10_000,
      employerProjectedAnnualPayrollCents: 100_000_000,
    }, policy);
  } catch (cause) {
    deductionEvidenceBlocked = cause instanceof Error && /lawful deduction evidence/i.test(cause.message);
  }
  scenarios.push(scenario(
    "LAWFUL_DEDUCTION_EVIDENCE",
    "Health-cover and discretionary deduction evidence",
    deductionEvidenceBlocked,
    "Calculation blocked without evidence",
    deductionEvidenceBlocked ? "Blocked" : "Not blocked",
    "No unsigned, informal or unexplained deduction may reduce officer net pay.",
  ));

  const failedCount = scenarios.filter((item) => item.status === "failed").length;
  const activationBlockers = [
    "COIDA classification, assessment rate and earnings cap require approved employer evidence.",
    "NBCPSS health-cover treatment requires a written ruling or verified operative schedule.",
    "The candidate policy still requires distinct maker, payroll reviewer and finance approval.",
    "Two complete payroll cycles of cash reserve must be evidenced before settlement activation.",
    "Production settlement remains locked until a separately authorised controlled pilot.",
  ];
  return {
    engineVersion: "payroll-engine-v3-shadow",
    policyVersion: policy.version,
    status: failedCount === 0 ? "passed" : "failed",
    scenarioCount: scenarios.length,
    passedCount: scenarios.length - failedCount,
    failedCount,
    activationEligible: false,
    settlementLocked: true,
    scenarios,
    activationBlockers,
  };
}
