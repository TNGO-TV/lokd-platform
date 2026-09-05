export type ShadowPayrollExportLine = {
  lineType: string;
  code: string;
  description: string;
  amountCents: number;
};

export type ShadowPayrollExportItem = {
  id: string;
  officerId: string;
  officerName: string;
  grossCents: number;
  employeeDeductionCents: number;
  netPayCents: number;
  employerCostCents: number;
  policyVersion: string;
  lines: ShadowPayrollExportLine[];
};

export type ShadowPayrollExportRun = {
  id: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  calculationVersion: string;
  approvedBy: string;
  secondApprovedBy: string;
  items: ShadowPayrollExportItem[];
};

const WATERMARK = "SHADOW ONLY - NOT FOR SUBMISSION OR PAYMENT";

function safeCsv(value: string | number) {
  let text = String(value).replaceAll("\r", " ").replaceAll("\n", " ");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csv(rows: Array<Array<string | number>>) {
  return `${rows.map((row) => row.map(safeCsv).join(",")).join("\r\n")}\r\n`;
}

function assertShadowRun(run: ShadowPayrollExportRun) {
  if (run.status !== "approved_for_export" || !run.approvedBy || !run.secondApprovedBy) {
    throw new Error("A shadow export requires a payroll run with both controlled approvals.");
  }
  if (!run.items.length) throw new Error("A shadow export requires at least one payroll item.");
}

export function renderShadowPayrollRegisterCsv(run: ShadowPayrollExportRun) {
  assertShadowRun(run);
  return csv([
    [WATERMARK],
    ["Payroll run", run.id, "Period", run.periodStart, run.periodEnd, "Pay date", run.payDate],
    ["Maker/checker", run.approvedBy, run.secondApprovedBy, "Engine", run.calculationVersion],
    ["Officer ID", "Officer", "Gross cents", "Employee deductions cents", "Calculated net cents", "Employer cost cents", "Policy", "Settlement instruction"],
    ...run.items.map((item) => [
      item.officerId,
      item.officerName,
      item.grossCents,
      item.employeeDeductionCents,
      item.netPayCents,
      item.employerCostCents,
      item.policyVersion,
      "NONE - SHADOW PREVIEW",
    ]),
  ]);
}

function lineTotal(run: ShadowPayrollExportRun, code: string) {
  return run.items.reduce((total, item) => total
    + item.lines.filter((line) => line.code === code).reduce((subtotal, line) => subtotal + line.amountCents, 0), 0);
}

export function renderShadowEmp201SummaryCsv(run: ShadowPayrollExportRun) {
  assertShadowRun(run);
  const grossCents = run.items.reduce((total, item) => total + item.grossCents, 0);
  const payeCents = lineTotal(run, "PAYE");
  const employeeUifCents = lineTotal(run, "UIF-EMPLOYEE");
  const employerUifCents = lineTotal(run, "UIF-EMPLOYER");
  const sdlCents = lineTotal(run, "SDL");
  return csv([
    [WATERMARK],
    ["This is a reconciliation preview, not an EMP201 return or eFiling submission file."],
    ["Payroll run", run.id, "Period", run.periodStart, run.periodEnd],
    ["Field", "Amount cents", "Control note"],
    ["Gross remuneration", grossCents, "Approved shadow payroll items"],
    ["PAYE", payeCents, "Policy-engine preview"],
    ["Employee UIF", employeeUifCents, "Itemised employee deduction"],
    ["Employer UIF", employerUifCents, "Employer contribution"],
    ["Total UIF", employeeUifCents + employerUifCents, "Employee plus employer"],
    ["SDL", sdlCents, "Employer levy preview"],
    ["Settlement instruction", 0, "Locked"],
  ]);
}

export const SHADOW_PAYROLL_EXPORT_WATERMARK = WATERMARK;
