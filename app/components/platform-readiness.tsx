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

type PlatformView = "Integrations" | "Service requests" | "Timesheets" | "Billing";

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
      <section className="activation-boundary"><span>NO LIVE PAYROLL</span><div><strong>Approval freezes evidence; it does not calculate or pay anyone.</strong><p>The demo uses scheduled minutes and the frozen offer value. Statutory deductions, net pay, payslips and settlement remain null until the production backend is activated.</p></div></section>
      <section className="platform-summary-grid"><article><span>Awaiting client evidence</span><strong>{pendingClient}</strong><small>Completion recorded; sign-off still due</small></article><article><span>Operations review</span><strong>{state.summary.timesheetsAwaitingReview}</strong><small>Evidence-confirmed items can be approved</small></article><article><span>Backend handoffs</span><strong>{state.summary.payrollHandoffs || approved}</strong><small>Gross-only records; no deductions or settlement</small></article></section>
      <section className="platform-finance-list">{state.timesheets.length ? state.timesheets.map((timesheet) => <article className={`platform-finance-card state-${timesheet.operationsStatus}`} key={timesheet.id}>
        <header><div><span>{timesheet.id}</span><h2>{timesheet.siteName}</h2><p>{timesheet.officerName} · {dateLabel(timesheet.serviceDate)}</p></div><em>{label(timesheet.operationsStatus)}</em></header>
        <dl><div><dt>Recorded</dt><dd>{timesheet.recordedMinutes} min</dd><small>Scheduled demo duration</small></div><div><dt>Payable</dt><dd>{timesheet.payableMinutes === null ? "Not approved" : `${timesheet.payableMinutes} min`}</dd><small>Locked by Operations</small></div><div><dt>Frozen gross value</dt><dd>{money(timesheet.grossWageCents)}</dd><small>No net-pay calculation</small></div><div><dt>Employer route</dt><dd>{timesheet.workforceModel ? label(timesheet.workforceModel) : "Missing"}</dd><small>{timesheet.employerName ?? "Employer not frozen"}</small></div></dl>
        <footer><span><b>Client evidence:</b> {label(timesheet.clientEvidenceStatus)}{timesheet.backendHandoffStatus ? ` · Handoff: ${label(timesheet.backendHandoffStatus)}` : ""}</span>{timesheet.operationsStatus === "awaiting_review" && timesheet.clientEvidenceStatus === "confirmed" ? <button disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "approve_timesheet", timesheetId: timesheet.id, version: timesheet.version }); if (result) flash("Timesheet locked and routed to the production-backend handoff queue."); }}>Approve handoff</button> : <button disabled>{timesheet.clientEvidenceStatus !== "confirmed" ? "Awaiting client" : "Handoff created"}</button>}</footer>
      </article>) : <div className="activation-empty"><span>⌁</span><strong>No submitted timesheets yet</strong><p>Accept a connected offer, complete its first shift, then confirm service in the Client workspace.</p></div>}</section>
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

  return <>
    <section className="command-heading"><div><p className="eyebrow">Backend and provider boundary</p><h1>Platform readiness</h1><p>The product workflows and operator controls are connected to the synthetic backend. Only the production runtime, iiDENTIFii and payment processor remain external activation boundaries.</p></div><div className="command-heading-actions"><button className="secondary-button" disabled={platform.busy} onClick={async () => { const result = await platform.runAction({ action: "refresh_integration_health" }); if (result) flash("The backend guard set was rechecked; disabled production connections were not contacted."); }}>Refresh health</button></div></section>
    <section className="activation-boundary"><span>PRODUCTION LOCKED</span><div><strong>Sandbox success does not authorise paid deployment.</strong><p>iiDENTIFii and the payment processor remain explicitly not connected. Regulatory evidence and the separate production backend are still hard launch gates.</p></div></section>
    <section className="platform-summary-grid"><article><span>Production connections remaining</span><strong>{state.summary.requiredIntegrations - state.summary.healthyIntegrations}</strong><small>Backend activation · iiDENTIFii · payment processor</small></article><article><span>Outbox</span><strong>{state.summary.queuedOutboxEvents}</strong><small>Durable workflow events for backend workers</small></article><article><span>Webhook exceptions</span><strong>{state.summary.pendingWebhooks}</strong><small>Unprocessed sandbox/provider events</small></article></section>
    <section className="platform-workflow-grid">{state.sections.map((section) => <article key={section.key} className={`platform-workflow state-${section.state}`}><header><span>{section.label}</span><em>{label(section.state)}</em></header><strong>{section.detail}</strong><p><b>Remaining:</b> {section.remaining}</p></article>)}</section>
    <section className="platform-connectors"><header><div><p className="eyebrow">Final activation boundary</p><h2>Three production connections</h2></div></header><div>{state.integrations.map((integration) => <article key={integration.key} className={`platform-connector state-${integration.status}`}><span>{integration.capability}</span><div><strong>{integration.provider}</strong><p>{integration.detail}</p><small>{integration.capabilities.join(" · ")}</small></div><em>{label(integration.status)}</em></article>)}</div></section>
    <div className="platform-queue-grid"><section className="platform-connectors"><header><div><p className="eyebrow">Identity cases</p><h2>iiDENTIFii projection queue</h2></div><strong>{state.identityCases.length}</strong></header><div>{state.identityCases.length ? state.identityCases.map((item) => <article className="platform-connector" key={item.id}><span>ID</span><div><strong>{item.applicantName ?? item.applicationId}</strong><p>{item.id} · {item.provider}</p><small>{item.checks.join(" · ") || "Checks not yet projected"}</small></div><em>{label(item.status)}</em></article>) : <p className="platform-empty-copy">Start a demo identity review under Applications to create a canonical case.</p>}</div></section><section className="platform-connectors"><header><div><p className="eyebrow">Payment orders</p><h2>Funding projection queue</h2></div><strong>{state.paymentOrders.length}</strong></header><div>{state.paymentOrders.length ? state.paymentOrders.map((item) => <article className="platform-connector" key={item.id}><span>R</span><div><strong>{item.bookingId} · {money(item.amountCents)}</strong><p>{item.clientName}</p><small>{item.providerReference ?? "Provider reference pending"}</small></div><em>{label(item.status)}</em></article>) : <p className="platform-empty-copy">Create a booking in the Client workspace to open a canonical payment order.</p>}</div></section></div>
    {platform.error && <p className="pilot-error" role="alert">{platform.error}</p>}
  </>;
}
