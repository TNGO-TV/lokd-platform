"use client";

import { useState } from "react";
import { usePilot } from "../lib/use-pilot";

type ServiceType = "Unarmed" | "Armed" | "VIP";
type ContractTerm = "single" | "1" | "3" | "6" | "12";

const serviceOptions: { name: ServiceType; note: string; rate: number }[] = [
  { name: "Unarmed", note: "Access, patrol and site guarding", rate: 1740 },
  { name: "Armed", note: "Firearm-qualified security coverage", rate: 2240 },
  { name: "VIP", note: "Verified close-protection officers", rate: 3200 },
];

const termLabels: Record<ContractTerm, string> = {
  single: "Single shift",
  "1": "1 month",
  "3": "3 months",
  "6": "6 months",
  "12": "12 months",
};

function cadenceFor(term: ContractTerm) {
  return term === "single" || Number(term) <= 3 ? "Weekly" : "Monthly";
}

function priceFor(service: ServiceType, term: ContractTerm) {
  const shiftRate = serviceOptions.find((item) => item.name === service)?.rate ?? 1740;
  const shiftCount = term === "single" ? 1 : Number(term) * 20;
  return shiftRate * shiftCount;
}

function money(value: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
}

export default function ClientPortal() {
  const pilot = usePilot();
  const [requestOpen, setRequestOpen] = useState(false);
  const [service, setService] = useState<ServiceType>("Unarmed");
  const [term, setTerm] = useState<ContractTerm>("1");
  const [notice, setNotice] = useState("");

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  }

  const requestedPrice = priceFor(service, term);
  const releaseCadence = cadenceFor(term);
  const serviceRecord = pilot.state?.shifts.find((shift) => shift.id === "SH-2080") ?? null;
  const recordConfirmed = serviceRecord?.clientSignoffStatus === "approved";

  async function confirmServiceRecord() {
    if (!serviceRecord) return;
    const result = await pilot.runAction({ action: "client_signoff", shiftId: serviceRecord.id });
    if (result) flash("Service record confirmed. LOKD operations will apply the normal release controls.");
  }

  if (pilot.loading || !pilot.state) {
    return <main className="portal-shell client-shell"><header className="portal-header client-header"><a href="/" className="portal-logo"><img src="/lokd-logo.svg" alt="LOKD" /></a></header><section className="portal-page client-page"><div className="officer-loading"><span className="pulse-dot" /><strong>{pilot.error || "Loading the client service record…"}</strong></div></section></main>;
  }

  return (
    <main className="portal-shell client-shell">
      <header className="portal-header client-header">
        <a href="/" className="portal-logo"><img src="/lokd-logo.svg" alt="LOKD" /></a>
        <div className="portal-role-switch"><a href="/">Ops</a><a href="/officer">Officer</a><a className="active" href="/client">Client</a></div>
        <div className="client-account"><span><strong>{pilot.state.client.organisationName}</strong><small>Client administrator</small></span><button>NP</button></div>
      </header>

      <section className="portal-page client-page">
        <div className="client-welcome"><div><p className="eyebrow">Friday · 21 August</p><h1>Your Rosebank post is active.</h1><p>Your 1-month Unarmed contract is paid in full and staffed.</p></div><button className="primary-button primary-button--light" onClick={() => setRequestOpen(true)}>Request coverage</button></div>
        <section className="client-status-card">
          <div className="client-status-main"><span className="coverage-active"><i /> Officer on site</span><h2>Northbridge Rosebank Offices</h2><p>Main access · <span className="service-badge service-unarmed">Unarmed</span></p><div className="coverage-timeline"><span className="timeline-start">05:54<br/><small>Verified check-in</small></span><i><b /></i><span className="timeline-end">18:00<br/><small>Scheduled end</small></span></div></div>
          <div className="client-booking-price"><span>Contract BK-2081 · 1 month</span><strong>R34,800.00</strong><small>Your full-term LOKD service price</small><dl><div><dt>Payment</dt><dd><span className="paid-status">✓ Paid in full</span></dd></div><div><dt>Service</dt><dd>Unarmed</dd></div><div><dt>Officer release cycle</dt><dd>Weekly</dd></div><div><dt>Confirmed hours</dt><dd>{recordConfirmed ? "12 hours" : "Awaiting confirmation"}</dd></div></dl></div>
        </section>

        <section className="contract-rule-strip"><span>✓</span><div><strong>Full-term payment received and confirmed before staffing</strong><p>LOKD released this contract to eligible officers only after receiving and confirming the complete client payment. You see the LOKD service price; officer offer terms remain private.</p></div></section>

        <section className="client-grid-main">
          <article className="client-signoff-card">
            <div className="card-title"><div><span>Shift completion</span><strong>Confirm service record</strong></div><em>{recordConfirmed ? "Confirmed" : "Ready for review"}</em></div>
            <div className="signoff-body"><div className="signoff-icon">{recordConfirmed ? "✓" : "→"}</div><div><h3>{recordConfirmed ? "Service record confirmed" : "Review completed service"}</h3><p>{recordConfirmed ? "Your confirmation is recorded in the service trail. Normal weekly release controls still apply." : "Confirm that this contracted shift was completed. Report a service issue if any part of this record requires review."}</p></div></div>
            <div className="signoff-evidence"><div><span>Attendance</span><strong>Geofence check-in verified</strong></div><div><span>Post checks</span><strong>3 of 3 submitted</strong></div><div><span>Incidents</span><strong>1 low · resolved</strong></div></div>
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

      {requestOpen && <div className="drawer-backdrop" onMouseDown={() => setRequestOpen(false)}><aside className="detail-drawer request-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-topline"><span className="detail-id">NEW REQUEST</span><button onClick={() => setRequestOpen(false)}>×</button></div><p className="eyebrow">Contracted coverage</p><h2>Request security</h2><p className="drawer-subtitle">Choose the service and term. LOKD routes offers only after the full-term payment is received and confirmed.</p>
        <div className="request-fields">
          <label>Site<select><option>Northbridge Rosebank Offices</option></select></label>
          <fieldset className="service-picker"><legend>Security service</legend>{serviceOptions.map((item) => <button type="button" key={item.name} className={service === item.name ? "selected" : ""} onClick={() => setService(item.name)}><span className={`service-badge service-${item.name.toLowerCase()}`}>{item.name}</span><small>{item.note}</small><i>{service === item.name ? "✓" : ""}</i></button>)}</fieldset>
          <div><label>Contract term<select value={term} onChange={(event) => setTerm(event.target.value as ContractTerm)}><option value="single">Single shift</option><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></label><label>Officer release<select value={releaseCadence} disabled><option>{releaseCadence}</option></select></label></div>
          <div><label>Start date<input type="date" defaultValue="2026-08-28" /></label><label>Shift<select><option>06:00–18:00</option><option>18:00–06:00</option></select></label></div>
          <label>Post<select><option>Main access</option><option>Patrol and access</option><option>Executive movement</option></select></label>
          <label>Instructions<textarea defaultValue="Standard contracted post instructions apply." /></label>
        </div>
        <div className="price-summary"><span>Your full-term LOKD price</span><strong>{money(requestedPrice)}</strong><p>{termLabels[term]} · {service} · officer earnings release {releaseCadence.toLowerCase()}</p></div>
        <div className="payment-gate"><span>i</span><p><strong>Full-term payment required.</strong> Eligible officers will not receive this offer until LOKD confirms the complete contract payment.</p></div>
        <div className="drawer-actions"><button className="secondary-button" onClick={() => setRequestOpen(false)}>Cancel</button><button className="primary-button primary-button--light" onClick={() => { setRequestOpen(false); flash("Request created. Payment is required before officer offers are released."); }}>Continue to payment</button></div></aside></div>}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}
