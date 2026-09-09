import { env } from "cloudflare:workers";
import {
  ensureDemoOperator,
  ensureIntegrationDemoData,
  PlatformWorkflowError,
  requireOperatorControl,
} from "../../../lib/integration-server";
import {
  renderShadowEmp201SummaryCsv,
  renderShadowPayrollRegisterCsv,
  type ShadowPayrollExportItem,
  type ShadowPayrollExportLine,
  type ShadowPayrollExportRun,
} from "../../../lib/payroll-export-preview";
import { PilotAccessError, pilotStage, requirePilotApiRole } from "../../../lib/pilot-runtime";

export const dynamic = "force-dynamic";

function getDb() {
  if (!env.DB) throw new PlatformWorkflowError("The platform backend is unavailable.", 503);
  return env.DB;
}

function errorResponse(cause: unknown) {
  const error = cause instanceof PlatformWorkflowError || cause instanceof PilotAccessError
    ? cause
    : new PlatformWorkflowError("The shadow payroll export could not be generated.", 500);
  return Response.json({ error: error.message }, {
    status: error.status,
    headers: { "cache-control": "no-store, private", "x-content-type-options": "nosniff" },
  });
}

function actorId(value: string) {
  return value.trim().toLowerCase();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, "0")).join("");
}

async function loadRun(db: D1Database, payrollRunId: string): Promise<ShadowPayrollExportRun> {
  const run = await db.prepare(`SELECT id, period_start AS periodStart, period_end AS periodEnd,
    pay_date AS payDate, status, calculation_version AS calculationVersion,
    approved_by AS approvedBy, second_approved_by AS secondApprovedBy
    FROM payroll_runs WHERE id = ? AND environment = 'demo' AND integrity_state = 'synthetic'`)
    .bind(payrollRunId).first<Omit<ShadowPayrollExportRun, "items">>();
  if (!run) throw new PlatformWorkflowError("That shadow payroll run could not be found.", 404);
  if (run.status !== "approved_for_export" || !run.approvedBy || !run.secondApprovedBy) {
    throw new PlatformWorkflowError("Both controlled approvals are required before a shadow export preview.", 409);
  }
  const itemRows = await db.prepare(`SELECT item.id, item.officer_id AS officerId,
    officer.full_name AS officerName, item.gross_wage_cents AS grossCents,
    COALESCE(item.employee_deduction_cents, 0) AS employeeDeductionCents,
    COALESCE(item.net_pay_cents, 0) AS netPayCents,
    COALESCE(item.employer_cost_cents, item.gross_wage_cents) AS employerCostCents,
    COALESCE(item.policy_version, 'policy-pending') AS policyVersion
    FROM payroll_items item JOIN officers officer ON officer.id = item.officer_id
    WHERE item.payroll_run_id = ? AND item.environment = 'demo' AND item.integrity_state = 'synthetic'
    ORDER BY item.id`).bind(payrollRunId).all<Omit<ShadowPayrollExportItem, "lines">>();
  const lineRows = await db.prepare(`SELECT line.payroll_item_id AS payrollItemId,
    line.line_type AS lineType, line.code, line.description, line.amount_cents AS amountCents
    FROM pay_item_lines line JOIN payroll_items item ON item.id = line.payroll_item_id
    WHERE item.payroll_run_id = ? AND item.environment = 'demo' AND item.integrity_state = 'synthetic'
      AND line.environment = 'demo' AND line.integrity_state = 'synthetic'
    ORDER BY line.payroll_item_id, line.id`).bind(payrollRunId)
    .all<ShadowPayrollExportLine & { payrollItemId: string }>();
  const linesByItem = new Map<string, ShadowPayrollExportLine[]>();
  for (const { payrollItemId, ...line } of lineRows.results ?? []) {
    linesByItem.set(payrollItemId, [...(linesByItem.get(payrollItemId) ?? []), line]);
  }
  return {
    ...run,
    calculationVersion: run.calculationVersion ?? "calculation-pending",
    items: (itemRows.results ?? []).map((item) => ({ ...item, lines: linesByItem.get(item.id) ?? [] })),
  };
}

export async function GET(request: Request) {
  try {
    const actor = requirePilotApiRole(request, "operations");
    if (pilotStage() !== "demo") throw new PlatformWorkflowError("Shadow exports are disabled outside the controlled test environment.", 423);
    const url = new URL(request.url);
    const payrollRunId = url.searchParams.get("run")?.trim() ?? "";
    const exportType = url.searchParams.get("type")?.trim() ?? "";
    if (!/^PR-[A-Z0-9-]{1,100}$/.test(payrollRunId)) throw new PlatformWorkflowError("Choose a valid payroll run.");
    if (!new Set(["payroll_register", "emp201_summary"]).has(exportType)) {
      throw new PlatformWorkflowError("Choose a supported shadow export preview.");
    }
    const db = getDb();
    await ensureIntegrationDemoData(db);
    await ensureDemoOperator(db, actor.email);
    const run = await loadRun(db, payrollRunId);
    const totalCents = run.items.reduce((total, item) => total + item.netPayCents, 0);
    await requireOperatorControl(db, {
      actorId: actor.email,
      actionCode: "payroll.export",
      amountCents: totalCents,
      makerId: run.approvedBy,
      firstApproverId: run.secondApprovedBy,
    });
    const content = exportType === "payroll_register"
      ? renderShadowPayrollRegisterCsv(run)
      : renderShadowEmp201SummaryCsv(run);
    const contentHash = await sha256(content);
    const fileName = `LOKD-shadow-${exportType.replaceAll("_", "-")}-${run.id}.csv`;
    const createdAt = new Date().toISOString();
    await db.prepare(`INSERT OR IGNORE INTO payroll_export_previews
      (id, payroll_run_id, export_type, mime_type, content_hash, file_name, row_count, status,
       watermark, created_by, created_at, environment, integrity_state, version)
      VALUES (?, ?, ?, 'text/csv', ?, ?, ?, 'shadow_generated',
       'SHADOW ONLY - NOT FOR SUBMISSION OR PAYMENT', ?, ?, 'demo', 'synthetic', 1)`)
      .bind(`PEX-${run.id}-${exportType}`, run.id, exportType, contentHash, fileName,
        Math.max(1, run.items.length), actorId(actor.email), createdAt).run();
    return new Response(content, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store, private",
        "x-content-type-options": "nosniff",
        "x-lokd-payroll-mode": "shadow-settlement-locked",
        "referrer-policy": "no-referrer",
        vary: "x-lokd-verified-email",
      },
    });
  } catch (cause) {
    return errorResponse(cause);
  }
}
