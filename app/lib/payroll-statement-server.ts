import type {
  PilotPayrollLine,
  PilotPayrollStatement,
} from "./pilot-types";

async function all<T>(statement: D1PreparedStatement) {
  const result = await statement.all<T>();
  return result.results ?? [];
}

export async function readOfficerPayrollStatements(
  db: D1Database,
  officerId: string,
): Promise<PilotPayrollStatement[]> {
  const statements = await all<Omit<PilotPayrollStatement, "lines">>(
    db
      .prepare(
        `SELECT item.id, item.payroll_run_id AS payrollRunId, officer.full_name AS officerName,
          COALESCE((SELECT booking.site_name FROM pay_item_sources source
            JOIN shift_timesheets timesheet ON timesheet.id = source.timesheet_id
            JOIN bookings booking ON booking.id = timesheet.booking_id
            WHERE source.payroll_item_id = item.id
              AND source.environment = 'demo' AND source.integrity_state = 'synthetic'
              AND timesheet.environment = 'demo' AND timesheet.integrity_state = 'synthetic'
              AND booking.environment = 'demo' AND booking.integrity_state = 'synthetic'
            ORDER BY timesheet.service_date LIMIT 1), 'Multiple sites') AS siteName,
          (SELECT COUNT(*) FROM pay_item_sources source
            WHERE source.payroll_item_id = item.id
              AND source.environment = 'demo' AND source.integrity_state = 'synthetic') AS shiftCount,
          run.period_start AS periodStart, run.period_end AS periodEnd, run.pay_date AS payDate,
          item.status, run.status AS runStatus, item.gross_wage_cents AS grossCents,
          COALESCE(item.employee_deduction_cents, 0) AS employeeDeductionCents,
          COALESCE(item.net_pay_cents, 0) AS netPayCents,
          COALESCE(item.employer_cost_cents, item.gross_wage_cents) AS employerCostCents,
          COALESCE(item.policy_version, run.policy_version, 'Policy pending') AS policyVersion,
          COALESCE(run.calculation_version, 'Calculation pending') AS calculationVersion,
          item.updated_at AS generatedAt, run.settled_at AS paidAt
        FROM payroll_items item
        JOIN payroll_runs run ON run.id = item.payroll_run_id
        JOIN officers officer ON officer.id = item.officer_id
        WHERE item.officer_id = ?
          AND item.environment = 'demo' AND item.integrity_state = 'synthetic'
          AND run.environment = 'demo' AND run.integrity_state = 'synthetic'
        ORDER BY run.period_end DESC, item.id DESC LIMIT 24`,
      )
      .bind(officerId),
  );

  const lines = await all<PilotPayrollLine & { payrollItemId: string }>(
    db
      .prepare(
        `SELECT line.id, line.payroll_item_id AS payrollItemId, line.line_type AS lineType,
          line.code, line.description, line.amount_cents AS amountCents,
          line.quantity_minutes AS quantityMinutes, line.rate_cents AS rateCents,
          line.rule_version AS ruleVersion
        FROM pay_item_lines line
        JOIN payroll_items item ON item.id = line.payroll_item_id
        WHERE item.officer_id = ?
          AND item.environment = 'demo' AND item.integrity_state = 'synthetic'
          AND line.environment = 'demo' AND line.integrity_state = 'synthetic'
        ORDER BY item.updated_at DESC,
          CASE line.line_type WHEN 'earning' THEN 1 WHEN 'deduction' THEN 2 ELSE 3 END,
          line.id LIMIT 240`,
      )
      .bind(officerId),
  );
  const linesByItem = new Map<string, PilotPayrollLine[]>();
  for (const { payrollItemId, ...line } of lines) {
    const bucket = linesByItem.get(payrollItemId) ?? [];
    bucket.push(line);
    linesByItem.set(payrollItemId, bucket);
  }
  return statements.map((statement) => ({
    ...statement,
    shiftCount: Number(statement.shiftCount),
    lines: linesByItem.get(statement.id) ?? [],
  }));
}

function ascii(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/[\\()]/g, (match) => `\\${match}`)
    .slice(0, 100);
}

function zar(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

function pdfLine(
  value: string,
  y: number,
  options: { bold?: boolean; size?: number; x?: number } = {},
) {
  const font = options.bold ? "F2" : "F1";
  return `BT /${font} ${options.size ?? 10} Tf 1 0 0 1 ${options.x ?? 52} ${y} Tm (${ascii(value)}) Tj ET`;
}

export function renderPayrollCalculationPdf(statement: PilotPayrollStatement) {
  const commands: string[] = [
    "0.12 0.14 0.13 rg 0 772 595 70 re f",
    "0.72 0.86 0.22 rg 0 766 595 6 re f",
    "1 1 1 rg",
    pdfLine("LOKD PAY CALCULATION", 808, { bold: true, size: 20 }),
    pdfLine("SYNTHETIC DEMO - NOT A PAYSLIP OR PROOF OF PAYMENT", 788, { size: 8 }),
    "0.12 0.14 0.13 rg",
    pdfLine(statement.officerName, 735, { bold: true, size: 16 }),
    pdfLine(`Period: ${statement.periodStart} to ${statement.periodEnd}`, 715),
    pdfLine(`Pay date: ${statement.payDate}`, 699),
    pdfLine(`Site: ${statement.siteName} | Source shifts: ${statement.shiftCount}`, 683),
    pdfLine(`Status: ${statement.status.replaceAll("_", " ")}`, 667),
    "0.88 0.90 0.89 RG 52 647 491 0.8 re S",
    pdfLine("CALCULATION", 625, { bold: true, size: 11 }),
  ];
  let y = 603;
  const visibleLines = statement.lines.filter((line) => line.lineType !== "employer_cost");
  for (const line of visibleLines.slice(0, 14)) {
    const prefix = line.lineType === "deduction" ? "Deduction" : "Earning";
    commands.push(pdfLine(`${prefix} - ${line.description}`, y));
    commands.push(pdfLine(zar(line.amountCents), y, { bold: true, x: 450 }));
    y -= 19;
  }
  y -= 3;
  commands.push("0.88 0.90 0.89 RG 52 " + (y + 12) + " 491 0.8 re S");
  commands.push(pdfLine("Gross remuneration", y - 8, { bold: true, size: 11 }));
  commands.push(pdfLine(zar(statement.grossCents), y - 8, { bold: true, size: 11, x: 450 }));
  commands.push(pdfLine("Employee deductions", y - 30));
  commands.push(pdfLine(`- ${zar(statement.employeeDeductionCents)}`, y - 30, { x: 450 }));
  commands.push("0.72 0.86 0.22 rg 48 " + (y - 72) + " 499 34 re f");
  commands.push("0.12 0.14 0.13 rg");
  commands.push(pdfLine("NET PAY", y - 61, { bold: true, size: 13 }));
  commands.push(pdfLine(zar(statement.netPayCents), y - 61, { bold: true, size: 13, x: 450 }));
  const noteY = Math.max(112, y - 112);
  commands.push(pdfLine(`Policy: ${statement.policyVersion}`, noteY, { size: 8 }));
  commands.push(pdfLine(`Engine: ${statement.calculationVersion}`, noteY - 14, { size: 8 }));
  commands.push(pdfLine(`Reference: ${statement.id} / ${statement.payrollRunId}`, noteY - 28, { size: 8 }));
  commands.push(pdfLine("Employer contributions are recorded separately and are not deducted from net pay.", 72, { size: 8 }));
  commands.push(pdfLine("This downloadable document demonstrates the officer calculation view only.", 58, { size: 8 }));

  const content = commands.join("\n") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n%LOKD\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = encoder.encode(pdf).length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}

export function renderShadowPayslipPdf(statement: PilotPayrollStatement) {
  if (statement.runStatus !== "approved_for_export") {
    throw new Error("The shadow payslip preview requires both controlled payroll approvals.");
  }
  const commands: string[] = [
    "0.12 0.14 0.13 rg 0 752 595 90 re f",
    "0.72 0.86 0.22 rg 0 746 595 6 re f",
    "1 1 1 rg",
    pdfLine("SHADOW PAYSLIP PREVIEW", 805, { bold: true, size: 20 }),
    pdfLine("NOT ISSUED - NOT PROOF OF PAYMENT - NO SETTLEMENT INSTRUCTION", 783, { size: 8 }),
    "0.12 0.14 0.13 rg",
    pdfLine("Employer: LOKD Security - legal identity pending production configuration", 722, { size: 8 }),
    pdfLine("Employer address: NOT CONFIGURED - PRODUCTION ISSUE BLOCKED", 707, { size: 8 }),
    pdfLine(`Worker: ${statement.officerName} | Occupation: Security officer`, 682, { bold: true, size: 11 }),
    pdfLine(`Pay period: ${statement.periodStart} to ${statement.periodEnd} | Scheduled pay date: ${statement.payDate}`, 663, { size: 9 }),
    pdfLine(`Source site: ${statement.siteName} | Approved shifts: ${statement.shiftCount}`, 647, { size: 9 }),
    "0.88 0.90 0.89 RG 52 630 491 0.8 re S",
    pdfLine("PAY DETAILS", 609, { bold: true, size: 11 }),
  ];
  let y = 587;
  const visibleLines = statement.lines.filter((line) => line.lineType === "earning" || line.lineType === "deduction");
  for (const line of visibleLines.slice(0, 12)) {
    const hours = line.quantityMinutes === null ? "" : ` | ${(line.quantityMinutes / 60).toFixed(2)} hours`;
    commands.push(pdfLine(`${line.lineType === "deduction" ? "Deduction" : "Earning"}: ${line.description}${hours}`, y, { size: 9 }));
    commands.push(pdfLine(`${line.lineType === "deduction" ? "- " : ""}${zar(line.amountCents)}`, y, { bold: true, size: 9, x: 448 }));
    y -= 18;
  }
  y -= 4;
  commands.push("0.88 0.90 0.89 RG 52 " + (y + 12) + " 491 0.8 re S");
  commands.push(pdfLine("Gross remuneration", y - 8, { bold: true }));
  commands.push(pdfLine(zar(statement.grossCents), y - 8, { bold: true, x: 448 }));
  commands.push(pdfLine("Total employee deductions", y - 28));
  commands.push(pdfLine(`- ${zar(statement.employeeDeductionCents)}`, y - 28, { x: 448 }));
  commands.push("0.72 0.86 0.22 rg 48 " + (y - 70) + " 499 34 re f");
  commands.push("0.12 0.14 0.13 rg");
  commands.push(pdfLine("CALCULATED NET PAY", y - 59, { bold: true, size: 12 }));
  commands.push(pdfLine(zar(statement.netPayCents), y - 59, { bold: true, size: 12, x: 448 }));
  const footerY = Math.max(92, y - 102);
  commands.push(pdfLine("Actual amount paid: R 0.00 - shadow workflow only", footerY, { bold: true, size: 9 }));
  commands.push(pdfLine(`Policy: ${statement.policyVersion}`, footerY - 16, { size: 8 }));
  commands.push(pdfLine(`Engine: ${statement.calculationVersion} | Reference: ${statement.id}`, footerY - 30, { size: 8 }));
  commands.push(pdfLine("Employer contributions are recorded separately and never deducted from calculated net pay.", 56, { size: 8 }));

  const content = commands.join("\n") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const encoder = new TextEncoder();
  let pdf = "%PDF-1.4\n%LOKD-SHADOW\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets[index + 1] = encoder.encode(pdf).length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = encoder.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return encoder.encode(pdf);
}
