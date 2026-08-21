"use client";

import { useState } from "react";

export default function ClientPortal() {
  const [signedOff, setSignedOff] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [notice, setNotice] = useState("");

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  }

  return (
    <main className="portal-shell client-shell">
      <header className="portal-header client-header">
        <a href="/" className="portal-logo"><img src="/lokd-logo.svg" alt="LOKD" /></a>
        <div className="portal-role-switch"><a href="/">Ops</a><a href="/officer">Officer</a><a className="active" href="/client">Client</a></div>
        <div className="client-account"><span><strong>Northbridge Property Services</strong><small>Client administrator</small></span><button>NP</button></div>
      </header>

      <section className="portal-page client-page">
        <div className="client-welcome"><div><p className="eyebrow">Friday · 21 August</p><h1>Your Rosebank post is active.</h1><p>Contracted coverage continues until 18:00 today.</p></div><button className="primary-button primary-button--light" onClick={() => setRequestOpen(true)}>Request coverage</button></div>
        <section className="client-status-card">
          <div className="client-status-main"><span className="coverage-active"><i /> Officer on site</span><h2>Northbridge Rosebank Offices</h2><p>Main access · Unarmed fixed-site guarding</p><div className="coverage-timeline"><span className="timeline-start">05:54<br/><small>Verified check-in</small></span><i><b /></i><span className="timeline-end">18:00<br/><small>Scheduled end</small></span></div></div>
          <div className="client-booking-price"><span>Booking BK-2081</span><strong>R1,740.00</strong><small>Your LOKD service price</small><dl><div><dt>Service date</dt><dd>21 Aug 2026</dd></div><div><dt>Approved hours</dt><dd>{signedOff ? "12 hours" : "Pending completion"}</dd></div><div><dt>Invoice state</dt><dd>{signedOff ? "Ready for invoice" : "Awaiting sign-off"}</dd></div></dl></div>
        </section>

        <section className="client-grid-main">
          <article className="client-signoff-card">
            <div className="card-title"><div><span>Shift completion</span><strong>Client sign-off</strong></div><em>{signedOff ? "Approved" : "Due after 18:00"}</em></div>
            <div className="signoff-body"><div className="signoff-icon">{signedOff ? "✓" : "→"}</div><div><h3>{signedOff ? "Shift approved" : "Review completed service"}</h3><p>{signedOff ? "Your approval has released the completed shift for LOKD settlement and invoicing." : "Confirm that the contracted shift was completed. Report a service issue before approving if anything requires review."}</p></div></div>
            <div className="signoff-evidence"><div><span>Attendance</span><strong>Geofence check-in verified</strong></div><div><span>Post checks</span><strong>3 of 3 submitted</strong></div><div><span>Incidents</span><strong>1 low · resolved</strong></div></div>
            {!signedOff ? <div className="signoff-actions"><button onClick={() => flash("Service issue form opened in demo mode.")}>Report an issue</button><button onClick={() => { setSignedOff(true); flash("Shift signed off. Invoice evidence updated."); }}>Approve completed shift</button></div> : <button className="download-record" onClick={() => flash("Signed service record prepared.")}>Download signed service record →</button>}
          </article>

          <aside className="client-side-stack">
            <article className="small-portal-card"><div className="small-card-title"><span>Next coverage</span><em>Confirmed</em></div><h3>Monday · 24 August</h3><p>06:00–18:00 · Main access</p><div className="verified-row"><span>✓</span><div><strong>Approved officer assigned</strong><small>Eligibility and site induction verified by LOKD</small></div></div><button onClick={() => flash("Change request form opened.")}>Request a change</button></article>
            <article className="small-portal-card client-support"><span>Operations support</span><strong>Need help with this site?</strong><p>Your authorised contact can reach LOKD operations from the booking record.</p><button onClick={() => flash("Support case opened in demo mode.")}>Contact operations →</button></article>
          </aside>
        </section>

        <section className="client-history-card">
          <div className="card-title"><div><span>Service history</span><strong>Recent bookings</strong></div><button>View all →</button></div>
          {[{id:"BK-2077",date:"18 Aug 2026",hours:"12 hours",price:"R1,740.00",state:"Signed off"},{id:"BK-2073",date:"14 Aug 2026",hours:"12 hours",price:"R1,740.00",state:"Invoiced"}].map((item) => <button className="client-history-row" key={item.id}><span><strong>{item.id}</strong><small>Northbridge Rosebank Offices</small></span><span><strong>{item.date}</strong><small>{item.hours}</small></span><span><strong>{item.price}</strong><small>LOKD service price</small></span><em>{item.state}</em><b>›</b></button>)}
        </section>
      </section>

      {requestOpen && <div className="drawer-backdrop" onMouseDown={() => setRequestOpen(false)}><aside className="detail-drawer request-drawer" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-topline"><span className="detail-id">NEW REQUEST</span><button onClick={() => setRequestOpen(false)}>×</button></div><p className="eyebrow">Contracted coverage</p><h2>Request a new shift</h2><p className="drawer-subtitle">LOKD confirms the booking only after an approved officer accepts the offer.</p><div className="request-fields"><label>Site<select><option>Northbridge Rosebank Offices</option></select></label><div><label>Date<input type="date" defaultValue="2026-08-28" /></label><label>Shift<select><option>06:00–18:00</option><option>18:00–06:00</option></select></label></div><label>Post<select><option>Main access</option></select></label><label>Instructions<textarea defaultValue="Standard contracted post instructions apply." /></label></div><div className="price-summary"><span>Your LOKD price</span><strong>R1,740.00</strong><p>12-hour scheduled unarmed fixed-site guarding shift</p></div><div className="drawer-actions"><button className="secondary-button" onClick={() => setRequestOpen(false)}>Cancel</button><button className="primary-button primary-button--light" onClick={() => { setRequestOpen(false); flash("Request received. Coverage awaits an accepted officer offer."); }}>Submit request</button></div></aside></div>}
      {notice && <div className="toast"><span>✓</span>{notice}</div>}
    </main>
  );
}
