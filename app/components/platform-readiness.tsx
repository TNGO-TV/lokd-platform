"use client";

import { useState } from "react";
import { usePlatform } from "../lib/use-platform";

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value.slice(0, 10)}T10:00:00+02:00`));
}

type PlatformView = "Integrations" | "Service requests" | "Timesheets" | "Payroll" | "Billing" | "Operator controls";

export function PlatformReadiness({ view, flash }: { view: PlatformView; flash: (message: string) => void }) {
  const platform = usePlatform();
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const state = platform.state;

  if (platform.loading && !state) return <div className="command-loading"><span className="pulse-dot" /><strong>Loading the connected platform spine…</strong><small>Providers · identity · funding · service work</small></div>;
  if (!state) return <div className="command-error" role="alert"><strong>Platform readiness unavailable</strong><p>{platform.error || "The readiness register could not be loaded."}</p><button onClick={() => void platform.refresh()}>Try again</button></div>;

  if (view === "Service requests") {
    return <>
      <section className="command-heading"><div><p className="eyebrow">Persistent client and officer support</p><h1>Service request queue</h1><p>Requests raised in Client and Officer workspaces now land in one owned Operations queue.</p></div><div className="command-heading-actions"><button className="secondary-button" onClick={() => void platform.refresh()}>Refresh</button></div></section>
      <section className="platform-summary-grid"><article><span>Open</span><strong>{state.serviceRequests.filter((item) => item.status === "open").length}</strong><small>Awaiting ownership</small></article><article><span>Triaged</span><strong>{state.serviceRequests.filter((item) => item.status === "triaged").length}</strong><small>Owned by Operations</small></article><article><span>Resolved</span><strong>{state.serviceRequests.filter((item) => item.status === "resolved").length}</strong><small>Resolution recorded</small></article></section>
      <section className="platform-request-list">{state.serviceRequests.length ? state.serviceRequests.map((request) => <article className={`platform-request state-${request.status}`} key={request.id}>
        <header><div><span>{request.id}</span><h2>{request.summary}</h2><p>{label(request.category)} · {request.requestedByRole} · {request.priority}</p></div><em>{label(request.status)}</em></header>
        <p>{request.detail}</p>
        <dl><div><dt>Client</dt><dd>{request.clientId ?? "—"}</dd></div><div><dt>Officer</dt><dd>{request.officerId ?? "—"}</dd></div><div><dt>Booking / shift</dt><dd>{request.bookingId ?? request.shiftId ?? "General"}</dd></div><div><dt>Owner</dt><dd>{request.ownerId ?? "Unassigned"}</dd></div></dl>
        {request.status !== "resolved" && <footer>{request.status === "open" && <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "triage_service_request", requestId: request.id, version: request.version }); if (result) flash("Service request triaged and assigned to Operations."); }}>Triage</button>}<input aria-label={`Resolution for ${request.id}`} placeholder="Resolution note" value={resolution[request.id] ?? ""} onChange={(event) => setResolution((current) => ({ ...current, [request.id]: event.target.value }))} /><button disabled={platform.busy || (resolution[request.id] ?? "").trim().length < 3} onClick={async () => { const result = await platform.runAction({ action: "resolve_service_request", requestId: request.id, version: request.version, resolution: resolution[request.id] ?? "" }); if (result) flash("Service request resolved with an auditable note."); }}>Resolve</button></footer>}
      </article>) : <div className="activation-empty"><span>✓</span><strong>No service requests</strong><p>Client and officer requests will appear here as soon as they are submitted.</p></div>}</section>
      {platform.error && <p className="pilot-error" role="alert">{platform.error}</p>}
    </>;
  }

  if (view === "Timesheets") {
    const pendingClient = state.timesheets.filter((item) => item.clientEvidenceStatus !== "confirmed").length;
    const approved = state.timesheets.filter((item) => item.operationsStatus === "approved_for_backend").length;
    return <>
      <section className="command-heading"><div><p className="eyebrow">Service evidence to finance</p><h1>Timesheet approval</h1><p>Completion creates a canonical timesheet. Client evidence must be confirmed before Operations can lock payable minutes and create the backend handoff.</p></div><div className="command-heading-actions"><button className="secondary-button" onClick={() => void platform.refresh()}>Refresh</button></div></section>
      <section className="activation-boundary"><span>NO LIVE PAYOUTS</span><div><strong>The policy engine is operable; settlement remains locked.</strong><p>The demo can calculate a clearly labelled synthetic gross-to-net result after Operations approval. Live statutory policy values, payslip issue and money movement remain separately gated.</p></div></section>
      <section className="platform-summary-grid"><article><span>Awaiting client evidence</span><strong>{pendingClient}</strong><small>Completion recorded; sign-off still due</small></article><article><span>Operations review</span><strong>{state.summary.timesheetsAwaitingReview}</strong><small>Evidence-confirmed items can be approved</small></article><article><span>Backend handoffs</span><strong>{state.summary.payrollHandoffs || approved}</strong><small>Policy-controlled records; settlement remains locked</small></article></section>
      <section className="platform-finance-list">{state.timesheets.length ? state.timesheets.map((timesheet) => <article className={`platform-finance-card state-${timesheet.operationsStatus}`} key={timesheet.id}>
        <header><div><span>{timesheet.id}</span><h2>{timesheet.siteName}</h2><p>{timesheet.officerName} · {dateLabel(timesheet.serviceDate)}</p></div><em>{label(timesheet.operationsStatus)}</em></header>
        <dl><div><dt>Recorded</dt><dd>{timesheet.recordedMinutes} min</dd><small>Scheduled demo duration</small></div><div><dt>Payable</dt><dd>{timesheet.payableMinutes === null ? "Not approved" : `${timesheet.payableMinutes} min`}</dd><small>Locked by Operations</small></div><div><dt>{timesheet.netPayCents === null ? "Frozen gross value" : "Synthetic net value"}</dt><dd>{money(timesheet.netPayCents ?? timesheet.grossWageCents)}</dd><small>{timesheet.employeeDeductionCents === null ? "Awaiting policy calculation" : `${money(timesheet.employeeDeductionCents)} synthetic deductions`}</small></div><div><dt>Employer route</dt><dd>{timesheet.workforceModel ? label(timesheet.workforceModel) : "Missing"}</dd><small>{timesheet.policyVersion ?? timesheet.employerName ?? "Employer not frozen"}</small></div></dl>
        <footer><span><b>Client evidence:</b> {label(timesheet.clientEvidenceStatus)}{timesheet.backendHandoffStatus ? ` · Handoff: ${label(timesheet.backendHandoffStatus)}` : ""}</span>{timesheet.operationsStatus === "awaiting_review" && timesheet.clientEvidenceStatus === "confirmed" ? <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "approve_timesheet", timesheetId: timesheet.id, version: timesheet.version }); if (result) flash("Timesheet locked and routed to the payroll policy engine."); }}>Approve handoff</button> : timesheet.payrollRunId && timesheet.backendHandoffStatus === "awaiting_backend_calculation" ? <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "calculate_payroll_run", payrollRunId: timesheet.payrollRunId! }); if (result) flash("Synthetic gross-to-net calculation completed for Operations review."); }}>Run demo calculation</button> : <button disabled>{timesheet.clientEvidenceStatus !== "confirmed" ? "Awaiting client" : timesheet.backendHandoffStatus === "calculated_for_review" ? "Calculated for review" : "Handoff created"}</button>}</footer>
      </article>) : <div className="activation-empty"><span>⌁</span><strong>No submitted timesheets yet</strong><p>Accept a connected offer, complete its first shift, then confirm service in the Client workspace.</p></div>}</section>
      {platform.error && <p className="pilot-error" role="alert">{platform.error}</p>}
    </>;
  }

  if (view === "Payroll") {
    const roles = new Set(state.operatorControls.currentActorRoles);
    return <>
      <section className="command-heading"><div><p className="eyebrow">Versioned policy to controlled approval</p><h1>Payroll policy engine</h1><p>Approved shift value is calculated under a hash-verified policy, then held behind distinct maker, payroll reviewer and finance approver controls.</p></div><div className="command-heading-actions"><button className="secondary-button" onClick={() => void platform.refresh()}>Refresh</button></div></section>
      <section className="activation-boundary"><span>NO LIVE SETTLEMENT</span><div><strong>Calculation and approvals are modelled; export, payslip issue and money movement are locked.</strong><p>The active policy is synthetic. The sourced 2027 South African candidate cannot activate until sector wages, COIDA classification and three-person approval are complete.</p></div></section>
      <section className="platform-summary-grid"><article><span>Engine</span><strong>v2</strong><small>Hash-verified policy selection</small></article><article><span>Awaiting approval</span><strong>{state.summary.payrollRunsAwaitingApproval}</strong><small>Maker/checker queue</small></article><article><span>Two-cycle reserve</span><strong>{money(state.payroll.requiredReserveCents)}</strong><small>{state.payroll.reserveVerified ? "Verified" : "Not verified · launch blocker"}</small></article></section>
      <section className="platform-finance-list payroll-policy-list">{state.payroll.policies.map((policy) => <article className={`platform-finance-card state-${policy.status}`} key={policy.id}>
        <header><div><span>{policy.id}</span><h2>{policy.version}</h2><p>{dateLabel(policy.effectiveFrom)}–{policy.effectiveTo ? dateLabel(policy.effectiveTo) : "open ended"}</p></div><em>{label(policy.status)}</em></header>
        <dl><div><dt>PAYE bands</dt><dd>{policy.ruleSummary.taxBrackets}</dd><small>Versioned annual table</small></div><div><dt>UIF</dt><dd>{policy.ruleSummary.uifEmployeeRateBasisPoints / 100}% + {policy.ruleSummary.uifEmployerRateBasisPoints / 100}%</dd><small>Employee and employer</small></div><div><dt>SDL / COIDA</dt><dd>{policy.ruleSummary.sdlEmployerRateBasisPoints / 100}% / {policy.ruleSummary.coidaConfigured ? "Configured" : "Blocked"}</dd><small>Employer costs</small></div><div><dt>Leave divisor</dt><dd>{policy.ruleSummary.leaveDivisor ? `1 / ${policy.ruleSummary.leaveDivisor}` : "Unset"}</dd><small>Hours-worked method</small></div></dl>
        <div className="payroll-source-links" aria-label={`Sources for ${policy.version}`}>{policy.sourceReferences.map((source, index) => <a key={source} href={source} target="_blank" rel="noreferrer">Source {index + 1}</a>)}</div>
        <footer><span><b>Hash:</b> {policy.policyHash.slice(0, 16)}… · <b>Blockers:</b> {policy.blockers.join(" · ")}</span><button disabled>{policy.status === "active" ? "Demo policy active" : "Activation locked"}</button></footer>
      </article>)}</section>
      <section className="platform-finance-list">{state.payroll.runs.length ? state.payroll.runs.map((run) => {
        const canCalculate = run.status === "awaiting_backend_calculation" && roles.has("payroll_preparer");
        const canFirstApprove = run.status === "calculated_for_review" && roles.has("payroll_reviewer") && run.createdBy !== state.operatorControls.currentActorId;
        const canSecondApprove = run.status === "first_approved" && roles.has("finance_approver")
          && run.createdBy !== state.operatorControls.currentActorId && run.approvedBy !== state.operatorControls.currentActorId;
        return <article className={`platform-finance-card state-${run.status}`} key={run.id}>
          <header><div><span>{run.id}</span><h2>{dateLabel(run.periodStart)} payroll</h2><p>{run.itemCount} item(s) · pay date {dateLabel(run.payDate)}</p></div><em>{label(run.status)}</em></header>
          <dl><div><dt>Gross</dt><dd>{money(run.grossCents)}</dd><small>Approved earnings</small></div><div><dt>Deductions</dt><dd>{run.employeeDeductionCents === null ? "Pending" : money(run.employeeDeductionCents)}</dd><small>PAYE and employee UIF</small></div><div><dt>Net</dt><dd>{run.netPayCents === null ? "Pending" : money(run.netPayCents)}</dd><small>No payment instruction</small></div><div><dt>Employer cost</dt><dd>{run.employerCostCents === null ? "Pending" : money(run.employerCostCents)}</dd><small>{run.policyVersion ?? "Policy pending"}</small></div></dl>
          <footer><span><b>Maker:</b> {run.createdBy} · <b>Approvals:</b> {run.approvedBy ?? "pending"} / {run.secondApprovedBy ?? "pending"}<br />{run.approvalBlockers.join(" ")}</span>{canCalculate ? <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "calculate_payroll_run", payrollRunId: run.id }); if (result) flash("Payroll engine v2 completed the synthetic policy calculation."); }}>Calculate</button> : canFirstApprove ? <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "approve_payroll_run", payrollRunId: run.id, version: run.version }); if (result) flash("First payroll approval recorded under maker/checker controls."); }}>First approve</button> : canSecondApprove ? <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "second_approve_payroll_run", payrollRunId: run.id, version: run.version }); if (result) flash("Distinct finance approval recorded; export remains locked."); }}>Finance approve</button> : <button disabled>{run.status === "approved_for_export" ? "Export locked" : run.createdBy === state.operatorControls.currentActorId && run.status === "calculated_for_review" ? "Maker cannot approve" : "Controlled action"}</button>}</footer>
        </article>;
      }) : <div className="activation-empty"><span>⌁</span><strong>No payroll runs yet</strong><p>Approve an eligible employee timesheet to create a controlled calculation record.</p></div>}</section>
      {platform.error && <p className="pilot-error" role="alert">{platform.error}</p>}
    </>;
  }

  if (view === "Operator controls") {
    const pending = state.operatorControls.approvals.filter((approval) => approval.status.startsWith("pending_"));
    return <>
      <section className="command-heading"><div><p className="eyebrow">Least privilege and four-eyes review</p><h1>Operator controls</h1><p>High-risk commands are bounded by role, approval limit, recent MFA and maker/checker separation. Database guards independently reject invalid payroll approvals.</p></div><div className="command-heading-actions"><button className="secondary-button" onClick={() => void platform.refresh()}>Refresh</button></div></section>
      <section className="activation-boundary"><span>0 CREDIT DAYS</span><div><strong>Advance-only funding is enforced before officer offers can be released.</strong><p>Bookings must remain fully funded and reconciled. LOKD does not provide credit terms; payroll settlement is a separate, locked command.</p></div></section>
      <section className="platform-summary-grid"><article><span>Current operator</span><strong>{state.operatorControls.currentActorMfaStatus === "verified" ? "MFA ✓" : "MFA blocked"}</strong><small>{state.operatorControls.currentActorId}</small></article><article><span>Assigned roles</span><strong>{state.operatorControls.currentActorRoles.length}</strong><small>{state.operatorControls.currentActorRoles.map(label).join(" · ")}</small></article><article><span>Pending approvals</span><strong>{pending.length}</strong><small>Expiry and separation enforced</small></article></section>
      <div className="platform-queue-grid"><section className="platform-connectors"><header><div><p className="eyebrow">People and authority</p><h2>Operator directory</h2></div><strong>{state.operatorControls.accounts.length}</strong></header><div>{state.operatorControls.accounts.map((account) => <article className={`platform-connector state-${account.status}`} key={account.id}><span>{account.mfaStatus === "verified" ? "MFA" : "!"}</span><div><strong>{account.displayName}</strong><p>{account.email}</p><small>{account.roles.map(label).join(" · ") || "No active role"} · limit {money(account.approvalLimitCents)}</small></div><em>{label(account.mfaStatus)}</em></article>)}</div></section>
      <section className="platform-connectors"><header><div><p className="eyebrow">Command matrix</p><h2>Action policies</h2></div><strong>{state.operatorControls.policies.length}</strong></header><div>{state.operatorControls.policies.map((policy) => <article className={`platform-connector state-${policy.status}`} key={policy.actionCode}><span>{policy.secondApprovalRequired ? "2×" : "1×"}</span><div><strong>{policy.label}</strong><p>{label(policy.requiredRole)} · MFA ≤ {policy.mfaMaxAgeMinutes} min</p><small>{policy.maxAmountCents === null ? "No configured ceiling" : `Ceiling ${money(policy.maxAmountCents)}`}</small></div><em>{label(policy.status)}</em></article>)}</div></section></div>
      <section className="platform-finance-list">{state.operatorControls.approvals.length ? state.operatorControls.approvals.map((approval) => <article className={`platform-finance-card state-${approval.status}`} key={approval.id}><header><div><span>{approval.id}</span><h2>{label(approval.actionCode)}</h2><p>{approval.aggregateType} · {approval.aggregateId}</p></div><em>{label(approval.status)}</em></header><dl><div><dt>Controlled amount</dt><dd>{money(approval.amountCents)}</dd><small>Policy ceiling applies</small></div><div><dt>Maker</dt><dd>{approval.requestedBy}</dd><small>Cannot approve own command</small></div><div><dt>First approver</dt><dd>{approval.firstApprovedBy ?? "Pending"}</dd><small>Payroll reviewer</small></div><div><dt>Finance approver</dt><dd>{approval.secondApprovedBy ?? "Pending"}</dd><small>Must be distinct</small></div></dl><footer><span>Expires {dateLabel(approval.expiresAt)} · version {approval.version}</span><button disabled>Managed in Payroll</button></footer></article>) : <div className="activation-empty"><span>✓</span><strong>No approval commands queued</strong><p>Calculated payroll runs will open a time-bounded approval request here.</p></div>}</section>
      {platform.error && <p className="pilot-error" role="alert">{platform.error}</p>}
    </>;
  }

  if (view === "Billing") {
    const funded = state.invoices.filter((item) => item.fundingStatus === "fully_allocated_sandbox").length;
    const ready = state.invoices.filter((item) => item.status === "ready_for_backend").length;
    return <>
      <section className="command-heading"><div><p className="eyebrow">Booking funding to invoice issue</p><h1>Billing control</h1><p>Pricing, payment orders, cleared funding and invoice allocations stay on one booking chain. Operations reviews the handoff before production tax and document processing.</p></div><div className="command-heading-actions"><button className="secondary-button" onClick={() => void platform.refresh()}>Refresh</button></div></section>
      <section className="activation-boundary"><span>NOT A TAX INVOICE</span><div><strong>These are synthetic billing control records.</strong><p>Invoice numbers, VAT treatment, issued documents and receipts are deliberately unset until an authorised production billing profile and backend worker exist.</p></div></section>
      <section className="platform-summary-grid"><article><span>Billing records</span><strong>{state.invoices.length}</strong><small>Created with connected bookings</small></article><article><span>Funding allocated</span><strong>{funded}</strong><small>Sandbox receipt evidence only</small></article><article><span>Ready for backend</span><strong>{ready}</strong><small>Reviewed; tax and issue still locked</small></article></section>
      <section className="platform-finance-list">{state.invoices.length ? state.invoices.map((invoice) => <article className={`platform-finance-card state-${invoice.status}`} key={invoice.id}>
        <header><div><span>{invoice.id}</span><h2>{invoice.clientName}</h2><p>{invoice.siteName} · {dateLabel(invoice.servicePeriodStart)}–{dateLabel(invoice.servicePeriodEnd)}</p></div><em>{label(invoice.status)}</em></header>
        <dl><div><dt>Booking value</dt><dd>{money(invoice.subtotalCents)}</dd><small>Frozen pricing version</small></div><div><dt>Allocated funding</dt><dd>{money(invoice.allocatedCents)}</dd><small>{label(invoice.fundingStatus)}</small></div><div><dt>Tax</dt><dd>{invoice.taxCents === null ? "Pending config" : money(invoice.taxCents)}</dd><small>{label(invoice.taxTreatment)}</small></div><div><dt>Total / balance</dt><dd>{invoice.totalCents === null ? "Not issued" : money(invoice.totalCents)}</dd><small>No tax document generated</small></div></dl>
        <footer><span><b>Payment reference:</b> {invoice.paymentReference ?? "Awaiting reconciliation"}</span>{invoice.status === "draft" && invoice.fundingStatus === "fully_allocated_sandbox" ? <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "review_invoice", invoiceId: invoice.id, version: invoice.version }); if (result) flash("Billing record reviewed and queued for the production backend."); }}>Review handoff</button> : <button disabled>{invoice.status === "ready_for_backend" ? "Handoff reviewed" : "Awaiting funding"}</button>}</footer>
      </article>) : <div className="activation-empty"><span>⌁</span><strong>No billing records yet</strong><p>Create a booking in the Client workspace to generate its canonical billing and funding chain.</p></div>}</section>
      {platform.error && <p className="pilot-error" role="alert">{platform.error}</p>}
    </>;
  }

  const externalIntegrations = state.integrations.filter((item) => item.capability === "identity" || item.capability === "payments");
  const internalIntegrations = state.integrations.filter((item) => item.capability !== "identity" && item.capability !== "payments");
  const controlsVerified = state.summary.requiredControls > 0
    && state.summary.readyControls === state.summary.requiredControls;

  return <>
    <section className="command-heading">
      <div>
        <p className="eyebrow">Internal platform and provider boundary</p>
        <h1>Platform readiness</h1>
        <p>The backend is now treated as owned product code. The only provider integrations left in the software plan are iiDENTIFii and the selected payment processor.</p>
      </div>
      <div className="command-heading-actions">
        <button className="secondary-button" disabled={platform.busy} onClick={async () => {
          const result = await platform.runAction({ action: "run_platform_maintenance" });
          if (result) flash("Internal schema, jobs, evidence binding, outbox and payroll engine were checked.");
        }}>{platform.busy ? "Checking…" : "Run full check"}</button>
      </div>
    </section>
    <section className="activation-boundary">
      <span>{controlsVerified ? "INTEGRATION READY" : "CHECK REQUIRED"}</span>
      <div>
        <strong>{controlsVerified ? "Internal software controls passed their runtime checks." : "Run the control check before treating this build as integration-ready."}</strong>
        <p>Paid deployment is still locked: provider credentials, signed webhooks, sourced live payroll policy, regulatory evidence and explicit launch approval are not implied by a green software check.</p>
      </div>
    </section>
    <section className="platform-summary-grid">
      <article><span>External providers remaining</span><strong>{state.summary.externalIntegrationsRemaining}</strong><small>iiDENTIFii · payment processor</small></article>
      <article><span>Internal controls ready</span><strong>{state.summary.readyControls}/{state.summary.requiredControls || "—"}</strong><small>Database · access · jobs · payroll · maps · evidence</small></article>
      <article><span>Operations inbox</span><strong>{state.summary.unreadOperatorNotifications}</strong><small>{state.summary.queuedOutboxEvents} event(s) still queued</small></article>
    </section>
    <section className="platform-workflow-grid">{state.sections.map((section) => <article key={section.key} className={`platform-workflow state-${section.state}`}><header><span>{section.label}</span><em>{label(section.state)}</em></header><strong>{section.detail}</strong><p><b>Remaining:</b> {section.remaining}</p></article>)}</section>
    <div className="platform-queue-grid">
      <section className="platform-connectors">
        <header><div><p className="eyebrow">Owned runtime</p><h2>Internal capabilities</h2></div><strong>{internalIntegrations.length}</strong></header>
        <div>{internalIntegrations.map((integration) => <article key={integration.key} className={`platform-connector state-${integration.status}`}><span>{integration.capability}</span><div><strong>{integration.provider}</strong><p>{integration.detail}</p><small>{integration.capabilities.join(" · ")}</small></div><em>{label(integration.status)}</em></article>)}</div>
      </section>
      <section className="platform-connectors">
        <header><div><p className="eyebrow">Provider activation</p><h2>Two connections remaining</h2></div><strong>{externalIntegrations.length}</strong></header>
        <div>{externalIntegrations.map((integration) => <article key={integration.key} className={`platform-connector state-${integration.status}`}><span>{integration.capability}</span><div><strong>{integration.provider}</strong><p>{integration.detail}</p><small>{integration.capabilities.join(" · ")}</small></div><em>{label(integration.status)}</em></article>)}</div>
      </section>
    </div>
    <div className="platform-queue-grid">
      <section className="platform-connectors">
        <header><div><p className="eyebrow">Runtime evidence</p><h2>Control register</h2></div><strong>{state.readinessControls.length}</strong></header>
        <div>{state.readinessControls.length ? state.readinessControls.map((control) => <article className={`platform-connector state-${control.status}`} key={control.code}><span>{control.category}</span><div><strong>{control.label}</strong><p>{control.detail}</p><small>{control.evidenceReference ?? "Evidence pending"} · {control.checkedBy}</small></div><em>{label(control.status)}</em></article>) : <p className="platform-empty-copy">Run the full check to create the evidence-backed readiness register.</p>}</div>
      </section>
      <section className="platform-connectors">
        <header><div><p className="eyebrow">Background processing</p><h2>Job and notification trail</h2></div><strong>{state.jobRuns.length}</strong></header>
        <div>{state.jobRuns.slice(0, 4).map((job) => <article className={`platform-connector state-${job.status}`} key={job.id}><span>{job.trigger}</span><div><strong>{label(job.jobKey)}</strong><p>{job.detail}</p><small>{job.processedCount} processed · {dateLabel(job.startedAt)}</small></div><em>{label(job.status)}</em></article>)}{!state.jobRuns.length && <p className="platform-empty-copy">No maintenance run has been recorded yet.</p>}</div>
      </section>
    </div>
    <div className="platform-queue-grid"><section className="platform-connectors"><header><div><p className="eyebrow">Identity cases</p><h2>iiDENTIFii projection queue</h2></div><strong>{state.identityCases.length}</strong></header><div>{state.identityCases.length ? state.identityCases.map((item) => <article className="platform-connector" key={item.id}><span>ID</span><div><strong>{item.applicantName ?? item.applicationId}</strong><p>{item.id} · {item.provider}</p><small>{item.checks.join(" · ") || "Checks not yet projected"}</small></div><em>{label(item.status)}</em></article>) : <p className="platform-empty-copy">Start a demo identity review under Applications to create a canonical case.</p>}</div></section><section className="platform-connectors"><header><div><p className="eyebrow">Payment orders</p><h2>Funding projection queue</h2></div><strong>{state.paymentOrders.length}</strong></header><div>{state.paymentOrders.length ? state.paymentOrders.map((item) => <article className="platform-connector" key={item.id}><span>R</span><div><strong>{item.bookingId} · {money(item.amountCents)}</strong><p>{item.clientName}</p><small>{item.providerReference ?? "Provider reference pending"}</small></div><em>{label(item.status)}</em></article>) : <p className="platform-empty-copy">Create a booking in the Client workspace to open a canonical payment order.</p>}</div></section></div>
    {platform.error && <p className="pilot-error" role="alert">{platform.error}</p>}
  </>;
}
