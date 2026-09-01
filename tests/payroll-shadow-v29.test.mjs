import assert from "node:assert/strict";
import test from "node:test";

import {
  renderShadowEmp201SummaryCsv,
  renderShadowPayrollRegisterCsv,
  SHADOW_PAYROLL_EXPORT_WATERMARK,
} from "../app/lib/payroll-export-preview.ts";
import { ZA_2027_SARS_POLICY_CANDIDATE } from "../app/lib/payroll-engine.ts";
import { runPayrollShadowValidation } from "../app/lib/payroll-shadow.ts";

function approvedRun() {
  return {
    id: "PR-SHADOW",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    payDate: "2026-10-01",
    status: "approved_for_export",
    calculationVersion: "payroll-engine-v3-shadow",
    approvedBy: "reviewer@example.test",
    secondApprovedBy: "finance@example.test",
    items: [{
      id: "PI-SHADOW",
      officerId: "=FORMULA-MUST-BE-NEUTRALISED",
      officerName: "Shadow Officer",
      grossCents: 700_300,
      employeeDeductionCents: 80_175,
      netPayCents: 620_125,
      employerCostCents: 770_353,
      policyVersion: ZA_2027_SARS_POLICY_CANDIDATE.version,
      lines: [
        { lineType: "deduction", code: "PAYE", description: "PAYE", amountCents: 0 },
        { lineType: "deduction", code: "UIF-EMPLOYEE", description: "Employee UIF", amountCents: 7_003 },
        { lineType: "employer", code: "UIF-EMPLOYER", description: "Employer UIF", amountCents: 7_003 },
        { lineType: "employer", code: "SDL", description: "SDL", amountCents: 7_003 },
      ],
    }],
  };
}

test("the Version 29 shadow suite passes but can never authorise settlement", () => {
  const result = runPayrollShadowValidation(ZA_2027_SARS_POLICY_CANDIDATE);
  assert.equal(result.engineVersion, "payroll-engine-v3-shadow");
  assert.equal(result.status, "passed");
  assert.equal(result.scenarioCount, 8);
  assert.equal(result.passedCount, 8);
  assert.equal(result.failedCount, 0);
  assert.equal(result.activationEligible, false);
  assert.equal(result.settlementLocked, true);
  assert.ok(result.activationBlockers.some((item) => /COIDA/i.test(item)));
  assert.ok(result.activationBlockers.some((item) => /controlled pilot/i.test(item)));
});

test("shadow exports are watermarked, contain no payment instruction and neutralise CSV formulas", () => {
  const register = renderShadowPayrollRegisterCsv(approvedRun());
  const emp201 = renderShadowEmp201SummaryCsv(approvedRun());
  assert.match(register, new RegExp(SHADOW_PAYROLL_EXPORT_WATERMARK));
  assert.match(register, /NONE - SHADOW PREVIEW/);
  assert.match(register, /'=FORMULA-MUST-BE-NEUTRALISED/);
  assert.match(emp201, /not an EMP201 return or eFiling submission file/);
  assert.match(emp201, /Settlement instruction","0","Locked/);
});

test("shadow exports fail closed without both approvals", () => {
  assert.throws(() => renderShadowPayrollRegisterCsv({
    ...approvedRun(),
    secondApprovedBy: "",
  }), /both controlled approvals/i);
});
