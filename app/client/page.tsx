"use client";

import { useState } from "react";
import type { ServiceType } from "../lib/pilot-types";
import {
  assessRisk,
  defaultRiskInput,
  engagementModels,
  noticePriceBook,
  purposePriceBook,
  quoteBooking,
  rosterPatterns,
  servicePriceBook,
  serviceMeetsRecommendation,
  termLabels,
  type ContractTerm,
  type EngagementModel,
  type RiskInput,
  type RosterPattern,
} from "../lib/pilot-pricing";
import { usePilot } from "../lib/use-pilot";

const serviceOptions = (Object.keys(servicePriceBook) as ServiceType[]).map((name) => ({ name, ...servicePriceBook[name] }));

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 5);
  return date.toISOString().slice(0, 10);
}

export default function ClientPortal() {
  const pilot = usePilot();
  const [requestOpen, setRequestOpen] = useState(false);
  const [service, setService] = useState<ServiceType>("Unarmed");
  const [engagementModel, setEngagementModel] = useState<EngagementModel>("fixed");
  const [term, setTerm] = useState<ContractTerm>("1");
  const [rosterPattern, setRosterPattern] = useState<RosterPattern>("monday_saturday");
  const [purposeCode, setPurposeCode] = useState("commercial_access");
  const [riskInput, setRiskInput] = useState<RiskInput>(defaultRiskInput);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [shift, setShift] = useState<"day" | "night">("day");
  const [postName, setPostName] = useState("Main access");
  const [instructions, setInstructions] = useState("Standard contracted post instructions apply.");
  const [notice, setNotice] = useState("");

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  }

  const risk = assessRisk(purposeCode, riskInput);
  const effectiveService = serviceMeetsRecommendation(service, risk.recommendedService) ? service : risk.recommendedService;
  const quote = quoteBooking({ serviceType: effectiveService, engagementModel, term: engagementModel === "flex" ? "single" : term, purposeCode, startDate, shift, rosterPattern, riskInput });
  const calendarSummary = Object.entries(quote.calendarBreakdown).filter(([, count]) => count > 0).map(([category, count]) => `${count} ${category.replaceAll("_", " ")}`).join(" · ");
  const purposeLabel = purposePriceBook.find((item) => item.code === purposeCode)?.label ?? "Commercial access";
  const demoBookings = pilot.state?.bookings.filter((booking) => booking.id.startsWith("BK-DEMO-")) ?? [];
  const serviceRecord = pilot.state?.shifts.find((shift) => shift.id === "SH-2080") ?? null;
  const recordConfirmed = serviceRecord?.clientSignoffStatus === "approved";
  const passportPath = `${pilot.state?.officer.passport.verificationPath ?? ""}&booking=BK-2081&shift=SH-2081`;
  const todayLabel = "Monday, 24 August";
  const primaryBooking = pilot.state?.bookings.find((booking) => booking.id === "BK-2081");

  function updateRisk<K extends keyof RiskInput>(key: K, value: RiskInput[K]) {
    setRiskInput((current) => ({ ...current, [key]: value }));
  }

  async function confirmServiceRecord() {
    if (!serviceRecord) return;
    const result = await pilot.runAction({ action: "client_signoff", shiftId: serviceRecord.id });
    if (result) flash("Service record confirmed. LOKD operations will apply the normal release controls.");
  }

  async function createBooking() {
    const result = await pilot.runAction({
      action: "create_booking",
      serviceType: effectiveService,
      engagementModel,
      term: engagementModel === "flex" ? "single" : term,
      rosterPattern,
      purposeCode,
      riskInput,
      startDate,
      shift,
      postName,
      instructions,
    });
    if (!result) return;
    setRequestOpen(false);
    flash(quote.manualReview ? "Request saved for LOKD Operations risk review." : "Request saved. It is awaiting simulated payment confirmation in Operations.");
  }

  if (pilot.loading || !pilot.state) {
    return <main className="portal-shell client-shell"><header className="portal-header client-header"><a href="/" className="portal-logo"><img src="/lokd-logo.svg" alt="LOKD" /></a></header><section className="portal-page client-page"><div className="officer-loading"><span className="pulse-dot" /><strong>{pilot.error || "Loading the client service record…"}</strong></div></section></main>;
  }

  return (
    <main className="portal-shell client-shell">
      <header className="portal-header client-header">
        <a href="/" className="portal-logo"><img src="/lokd-logo.svg" alt="LOKD" /></a>
        <div className="portal-role-switch"><a href="/ops">Ops</a><a href="/officer">Officer</a><a className="active" href="/client">Client</a></div>
        <div className="client-account"><span><strong>{pilot.state.client.organisationName}</strong><small>Client administrator</small></span><button>NP</button></div>
      </header>

      <section className="portal-page client-page">
        <div className="client-welcome"><div><p className="eyebrow">{todayLabel}</p><h1>Your Rosebank post is active.</h1><p>Your 1-month Unarmed contract is paid in full and staffed.</p></div><button className="primary-button primary-button--light" onClick={() => setRequestOpen(true)}>Request coverage</button></div>
        <section className="client-status-card">
          <div className="client-status-main"><span className="coverage-active"><i /> Officer on site</span><h2>Northbridge Rosebank Offices</h2><p>Main access · <span className="service-badge service-unarmed">Unarmed</span> · Commercial access trained</p><div className="coverage-timeline"><span className="timeline-start">05:54<br/><small>Passport-verified check-in</small></span><i><b /></i><span className="timeline-end">18:00<br/><small>Scheduled end</small></span></div></div>
          <div className="client-booking-price"><span>Contract BK-2081 · LOKD Fixed</span><strong>{money(primaryBooking?.clientPriceCents ?? 3_640_000)}</strong><small>One-month Monday–Saturday premium service estimate</small><dl><div><dt>Payment</dt><dd><span className="paid-status">✓ Paid in full</span></dd></div><div><dt>Service</dt><dd>Purpose-trained Unarmed</dd></div><div><dt>Risk plan</dt><dd>{primaryBooking?.riskBand ?? "Standard"} · assessed</dd></div><div><dt>Confirmed hours</dt><dd>{recordConfirmed ? "12 hours" : "Awaiting confirmation"}</dd></div></dl></div>
        </section>

        <section className="client-passport-card"><div className="client-passport-person"><span>{pilot.state.officer.initials}</span><div><small>ASSIGNED SECURITY PROFESSIONAL</small><h2>{pilot.state.officer.fullName}</h2><p>{pilot.state.officer.passport.passportNumber} · {pilot.state.officer.psiraGrade}</p></div></div><div className="client-passport-status"><i>✓</i><span><strong>LOKD Passport current</strong><small>Core readiness · Unarmed · Commercial access</small></span></div><img src="/lokd-shift-passport-qr.svg" alt="Scan to verify the assigned officer's LOKD Passport" /><a href={passportPath} target="_blank" rel="noreferrer">Open live verification</a></section>

        <section className="contract-rule-strip"><span>✓</span><div><strong>Full-term payment received and confirmed before staffing</strong><p>LOKD released this contract to eligible officers only after receiving and confirming the complete client payment. You see the LOKD service price; officer offer terms remain private.</p></div></section>

        <section className="client-request-pipeline">
          <div className="card-title"><div><span>Connected booking pipeline</span><strong>Your new coverage requests</strong></div><a href="/ops">Open Operations →</a></div>
          {demoBookings.length ? demoBookings.map((booking) => <article key={booking.id}>
            <span><strong>{booking.id} · {booking.engagementModel === "flex" ? "LOKD Flex" : "LOKD Fixed"}</strong><small>{booking.serviceType} · {booking.purposeLabel} · {booking.riskBand} risk · {booking.shiftCount} shift{booking.shiftCount === 1 ? "" : "s"} · starts {booking.startDate}</small></span>
            <span><strong>{money(booking.clientPriceCents)}</strong><small>Full-term premium price</small></span>
            <span><em className={`pill ${booking.fundingStatus === "paid_in_full" ? "tone-green" : "tone-amber"}`}>{booking.status === "risk_review" ? "Risk review" : booking.fundingStatus === "paid_in_full" ? "Payment confirmed" : "Awaiting payment"}</em><small>{booking.status === "offered" ? "Offer released" : booking.status === "staffed" ? "Officer assigned" : booking.status === "matching" ? "Matching controls" : booking.status === "risk_review" ? "Specialist plan approval required" : "No offers released"}</small></span>
          </article>) : <div className="client-pipeline-empty"><span>＋</span><div><strong>Create the first live demo request</strong><p>The request will persist here, then move to Operations for simulated payment confirmation and controlled matching.</p></div></div>}
        </section>

        <section className="client-grid-main">
          <article className="client-signoff-card">
            <div className="card-title"><div><span>Shift completion</span><strong>Confirm service record</strong></div><em>{recordConfirmed ? "Confirmed" : "Ready for review"}</em></div>
            <div className="signoff-body"><div className="signoff-icon">{recordConfirmed ? "✓" : "→"}</div><div><h3>{recordConfirmed ? "Service record confirmed" : "Review completed service"}</h3><p>{recordConfirmed ? "Your confirmation is recorded in the service trail. Normal weekly release controls still apply." : "Confirm that this contracted shift was completed. Report a service issue if any part of this record requires review."}</p></div></div>
            <div className="signoff-evidence"><div><span>Attendance</span><strong>Passport QR verified</strong></div><div><span>Readiness</span><strong>Purpose endorsement current</strong></div><div><span>Incidents</span><strong>1 low · resolved</strong></div></div>
            {!recordConfirmed ? <><div className="service-record-note">Your confirmation is evidence for the service record; it is not a manual pay switch. A missing response cannot hold undisputed officer earnings indefinitely.</div><div className="signoff-actions"><button onClick={() => flash("Service issue form opened in pilot mode.")}>Report an issue</button><button disabled={pilot.busy || !serviceRecord} onClick={() => void confirmServiceRecord()}>{pilot.busy ? "Confirming…" : "Confirm completed service"}</button></div></> : <button className="download-record" onClick={() => flash("Confirmed service record prepared.")}>Download service record →</button>}
            {pilot.error && <p className="pilot-error" role="alert">{pilot.error}</p>}
          </article>

          <aside className="client-side-stack">
            <article className="small-portal-card"><div className="small-card-title"><span>Next coverage</span><em>Confirmed</em></div><h3>Monday · 24 August</h3><p>06:00–18:00 · Main access</p><div className="verified-row"><span>✓</span><div><strong>Matched officer assigned</strong><small>Grade C minimum · Unarmed qualified · officer opted in</small></div></div><button onClick={() => flash("Change request form opened.")}>Request a change</button></article>
            <article className="small-portal-card client-support"><span>Operations support</span><strong>Need help with this site?</strong><p>Your authorised contact can reach LOKD operations from the contract record.</p><button onClick={() => flash("Support case opened in demo mode.")}>Contact operations →</button></article>
          </aside>
        </section>

        <section className="client-history-card">
          <div className="card-title"><div><span>Service history</span><strong>Recent contract shifts</strong></div><button>View all →</button></div>
          {[{id:"BK-2077",date:"18 Aug 2026",hours:"12 hours",price:"Included in term",state:"Confirmed"},{id:"BK-2073",date:"14 Aug 2026",hours:"12 hours",price:"Included in term",state:"Verified"}].map((item) => <button className="client-history-row" key={item.id}><span><strong>{item.id}</strong><small>Northbridge Rosebank · Unarmed</small></span><span><strong>{item.date}</strong><small>{item.hours}</small></span><span><strong>{item.price}</strong><small>Full contract paid</small></span><em>{item.state}</em><b>›</b></button>)}
        </section>
      </section>

      {requestOpen && <div className="drawer-backdrop" onMouseDown={() => setRequestOpen(false)}><aside className="detail-drawer request-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-topline"><span className="detail-id">NEW REQUEST</span><button onClick={() => setRequestOpen(false)}>×</button></div><p className="eyebrow">Risk-matched coverage</p><h2>Request security</h2><p className="drawer-subtitle">Tell LOKD what you need. Our assisted assessment recommends the minimum suitable cover before the request reaches Operations.</p>
        <div className="request-fields">
          <label>Site<select><option>Northbridge Rosebank Offices</option></select></label>
          <fieldset className="engagement-picker"><legend>Choose the coverage model</legend>{(Object.keys(engagementModels) as EngagementModel[]).map((model) => <button type="button" key={model} className={engagementModel === model ? "selected" : ""} onClick={() => setEngagementModel(model)}><strong>{engagementModels[model].label}</strong><small>{engagementModels[model].note}</small><i>{engagementModel === model ? "✓" : ""}</i></button>)}</fieldset>
          <div><label>Site purpose<select value={purposeCode} onChange={(event) => setPurposeCode(event.target.value)}>{purposePriceBook.map((item) => <option value={item.code} key={item.code}>{item.label}</option>)}</select></label><label>Start date<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label></div>
          <div><label>Shift<select value={shift} onChange={(event) => { const nextShift = event.target.value as "day" | "night"; setShift(nextShift); updateRisk("nightOperation", nextShift === "night"); }}><option value="day">06:00–18:00</option><option value="night">18:00–06:00</option></select></label>{engagementModel === "fixed" ? <label>Coverage days<select value={rosterPattern} onChange={(event) => setRosterPattern(event.target.value as RosterPattern)}>{(Object.keys(rosterPatterns) as RosterPattern[]).map((pattern) => <option value={pattern} key={pattern}>{rosterPatterns[pattern].label}</option>)}</select></label> : <label>Dispatch window<input value={noticePriceBook[quote.noticeWindow].label} disabled /></label>}</div>
          {engagementModel === "fixed" && <label>Contract term<select value={term} onChange={(event) => setTerm(event.target.value as ContractTerm)}><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></label>}

          <fieldset className="risk-assessment"><legend>LOKD assisted risk assessment</legend><p>Rules-based Phase 1 recommendation · reviewed by Operations for High or Critical requests.</p><div className="risk-input-grid">
            <label>Cash / asset exposure<select value={riskInput.assetExposure} onChange={(event) => updateRisk("assetExposure", event.target.value as RiskInput["assetExposure"])}><option value="standard">Standard property</option><option value="valuable">Valuable cash / stock / equipment</option><option value="high_value">High-value target</option></select></label>
            <label>Public access<select value={riskInput.publicAccess} onChange={(event) => updateRisk("publicAccess", event.target.value as RiskInput["publicAccess"])}><option value="controlled">Controlled access</option><option value="moderate">Regular visitors</option><option value="open">Open / heavy footfall</option></select></label>
            <label>Incident history<select value={riskInput.incidentHistory} onChange={(event) => updateRisk("incidentHistory", event.target.value as RiskInput["incidentHistory"])}><option value="none">No recent incidents</option><option value="isolated">One recent incident / threat</option><option value="repeated">Repeated incidents / active threat</option></select></label>
            <label>Existing controls<select value={riskInput.existingControls} onChange={(event) => updateRisk("existingControls", event.target.value as RiskInput["existingControls"])}><option value="strong">CCTV, alarms and controlled access</option><option value="partial">Some controls</option><option value="limited">Limited controls</option></select></label>
          </div><label className="risk-check"><input type="checkbox" checked={riskInput.vulnerablePeople} onChange={(event) => updateRisk("vulnerablePeople", event.target.checked)} />Vulnerable people or a safeguarding duty are present</label></fieldset>

          <article className={`risk-result risk-${risk.band.toLowerCase()}`}><div><span>LOKD RECOMMENDATION · {risk.band.toUpperCase()} {risk.score}</span><h3>{risk.recommendedService} · {risk.minimumGrade} or higher · {risk.headcount} officer{risk.headcount === 1 ? "" : "s"}</h3><p>{risk.reasons[0]}</p></div><ul>{risk.requiredEndorsements.map((item) => <li key={item}>{item}</li>)}</ul>{risk.manualReview && <strong>Operations review required before payment and matching.</strong>}</article>

          <fieldset className="service-picker"><legend>Security service · the assessed minimum cannot be reduced</legend>{serviceOptions.map((item) => { const allowed = serviceMeetsRecommendation(item.name, risk.recommendedService); return <button type="button" key={item.name} disabled={!allowed} className={`${effectiveService === item.name ? "selected" : ""} ${allowed ? "" : "blocked"}`} onClick={() => setService(item.name)}><span className={`service-badge service-${item.name.toLowerCase()}`}>{item.name}</span><small>{allowed ? item.note : `Below the ${risk.recommendedService} minimum`}</small><i>{effectiveService === item.name ? "✓" : allowed ? "" : "×"}</i></button>; })}</fieldset>
          <label>Post<select value={postName} onChange={(event) => setPostName(event.target.value)}><option>Main access</option><option>Patrol and access</option><option>Executive movement</option></select></label>
          <label>Instructions<textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} /></label>
        </div>
        <div className="price-summary"><span>{engagementModel === "fixed" ? "Full-term LOKD estimate" : "LOKD Flex shift estimate"}</span><strong>{money(quote.clientPriceCents)}</strong><p>{engagementModel === "fixed" ? `${termLabels[term]} · ${quote.rosterLabel}` : quote.noticeLabel} · {effectiveService} · {purposeLabel} · {quote.shiftCount} shift{quote.shiftCount === 1 ? "" : "s"}</p><dl className="price-breakdown"><div><dt>Base protection</dt><dd>{money(quote.baseClientCents)}</dd></div><div><dt>Calendar premium</dt><dd>{money(quote.calendarPremiumCents)}</dd></div><div><dt>Short-notice dispatch</dt><dd>{money(quote.dispatchPremiumCents)}</dd></div><div><dt>Risk / specialist adjustment</dt><dd>{money(quote.riskPremiumCents)}</dd></div></dl><small>{calendarSummary || quote.firstCalendarLabel} · Pilot estimate; VAT treatment is not yet applied.</small></div>
        <div className="payment-gate"><span>i</span><p><strong>{quote.manualReview ? "Risk plan first, payment second." : engagementModel === "fixed" ? "Full-term payment required." : "Shift payment required."}</strong> No officer offer is released until the plan is approved where required and LOKD records payment as received.</p></div>
        <div className="drawer-actions"><button className="secondary-button" onClick={() => setRequestOpen(false)}>Cancel</button><button className="primary-button primary-button--light" disabled={pilot.busy} onClick={() => void createBooking()}>{pilot.busy ? "Saving…" : quote.manualReview ? "Send for risk review" : "Save request & continue"}</button></div>{pilot.error && <p className="pilot-error" role="alert">{pilot.error}</p>}</aside></div>}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
