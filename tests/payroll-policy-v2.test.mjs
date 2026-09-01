import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPayrollPolicy,
  calculatePayrollStatement,
  earningLineAmount,
  ZA_2027_SARS_POLICY_CANDIDATE,
} from "../app/lib/payroll-engine.ts";

function monthlyStatement(overrides = {}) {
  return calculatePayrollStatement({
    serviceDate: "2026-09-01",
    earnings: [{
      code: "ORDINARY",
      description: "Monthly ordinary remuneration",
      minutes: 60,
      baseHourlyRateCents: 3_000_000,
      multiplierBasisPoints: 10_000,
    }],
    employerProjectedAnnualPayrollCents: 60_000_000,
    ...overrides,
  }, ZA_2027_SARS_POLICY_CANDIDATE);
}

test("the sourced 2027 candidate applies PAYE bands, rebates, capped UIF and SDL deterministically", () => {
  assert.doesNotThrow(() => assertPayrollPolicy(ZA_2027_SARS_POLICY_CANDIDATE));
  const result = monthlyStatement();
  assert.equal(result.grossCents, 3_000_000);
  assert.equal(result.payeCents, 468_100);
  assert.equal(result.employeeUifCents, 17_712);
  assert.equal(result.totalEmployeeDeductionsCents, 485_812);
  assert.equal(result.netPayCents, 2_514_188);
  assert.equal(result.employerUifCents, 17_712);
  assert.equal(result.skillsDevelopmentLevyCents, 30_000);
  assert.equal(result.coidaProvisionCents, 0);
  assert.equal(result.employerCostCents, 3_047_712);
});

test("age and medical inputs reduce PAYE, while the SDL exemption fails closed without employer context", () => {
  assert.equal(monthlyStatement({ ageAtTaxYearEnd: 65 }).payeCents, 386_725);
  assert.equal(monthlyStatement({ medicalSchemeMembers: 1 }).payeCents, 430_500);
  assert.equal(monthlyStatement({ employerProjectedAnnualPayrollCents: 40_000_000 }).skillsDevelopmentLevyCents, 0);
  assert.throws(() => monthlyStatement({ employerProjectedAnnualPayrollCents: undefined }), /projected annual employer payroll/i);
});

test("earning multipliers and leave accrual are integer, repeatable policy outputs", () => {
  const overtime = {
    code: "OVERTIME",
    description: "Approved overtime",
    minutes: 600,
    baseHourlyRateCents: 10_000,
    multiplierBasisPoints: 15_000,
  };
  assert.equal(earningLineAmount(overtime), 150_000);
  const result = calculatePayrollStatement({
    serviceDate: "2026-09-01",
    earnings: [overtime],
    employerProjectedAnnualPayrollCents: 40_000_000,
  }, ZA_2027_SARS_POLICY_CANDIDATE);
  assert.equal(result.leaveAccruedMinutes, 35);
  assert.equal(result.skillsDevelopmentLevyCents, 0);
});

test("COIDA cannot be enabled without a controlled classification and cap", () => {
  const invalid = structuredClone(ZA_2027_SARS_POLICY_CANDIDATE);
  invalid.coida.enabled = true;
  assert.throws(() => assertPayrollPolicy(invalid), /COIDA rule requires a classification/i);
});
