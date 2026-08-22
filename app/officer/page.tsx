"use client";

import { useState } from "react";
import type { PilotOffer, PilotShift, PilotState, ServiceType } from "../lib/pilot-types";
import { usePilot } from "../lib/use-pilot";

type OfficerTab = "Home" | "Work" | "Earnings" | "Profile";
type WorkView = "Offers" | "My shifts";

const officerTabs: Array<{ name: OfficerTab; icon: string }> = [
  { name: "Home", icon: "⌂" },
  { name: "Work", icon: "▣" },
  { name: "Earnings", icon: "R" },
  { name: "Profile", icon: "●" },
];

function money(cents: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(cents / 100);
}

function dateLabel(value: string) {
  const date = new Date(`${value}T12:00:00+02:00`);
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short" }).format(date);
}

function timeLabel(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }).format(new Date(value));
}

export default function OfficerApp() {
  const [mode, setMode] = useState<"approved" | "applicant">("approved");
  const [notice, setNotice] = useState("");
  const pilot = usePilot();

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3600);
  }

  return (
    <main className="portal-shell officer-shell officer-v2">
      <header className="portal-header officer-header-v2">
        <a href="/" className="portal-logo"><img src="/lokd-logo.svg" alt="LOKD" /></a>
        <div className="portal-role-switch pilot-role-switch" aria-label="Pilot role preview"><a href="/ops">Ops</a><a className="active" href="/officer">Officer</a><a href="/client">Client</a></div>
        <button className="portal-profile" aria-label="Open officer profile">{pilot.state?.officer.initials ?? "LK"}</button>
      </header>

      <section className="portal-page officer-page officer-page-v2">
        <div className="demo-switch officer-demo-switch"><span>Private pilot</span><button className={mode === "approved" ? "active" : ""} onClick={() => setMode("approved")}>Approved officer</button><button className={mode === "applicant" ? "active" : ""} onClick={() => setMode("applicant")}>Registration flow</button></div>
        {mode === "applicant" ? <Applicant flash={flash} /> : (
          pilot.loading ? <OfficerLoading /> : pilot.error || !pilot.state ? <OfficerError message={pilot.error} retry={pilot.refresh} /> : (
            <ApprovedOfficer pilot={pilot} state={pilot.state} flash={flash} />
          )
        )}
      </section>
      {notice && <div className="toast officer-toast" role="status"><span>✓</span>{notice}</div>}
    </main>
  );
}

function OfficerLoading() {
  return <section className="officer-loading" aria-live="polite"><span className="loading-mark" /><strong>Loading your LOKD work…</strong><small>Checking offers, shifts and earnings.</small></section>;
}

function OfficerError({ message, retry }: { message: string; retry: () => Promise<void> }) {
  return <section className="officer-error" role="alert"><span>!</span><h1>We could not load your work.</h1><p>{message || "Please check your connection and try again."}</p><button onClick={() => void retry()}>Try again</button></section>;
}

function Applicant({ flash }: { flash: (text: string) => void }) {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const steps = ["Your details", "PSiRA & work", "Areas & availability", "Review & submit"];

  if (submitted) {
    return <section className="application-status-card"><span>✓</span><p className="eyebrow">Application received</p><h1>LOKD is checking your information.</h1><p>You will see any correction request here. Work offers stay off until your identity, PSiRA grade and service qualifications are approved.</p><div><strong>Submitted</strong><i /><strong>Verification</strong><i /><span>Approval</span></div><button onClick={() => { setSubmitted(false); setStep(1); }}>Return to pilot form</button></section>;
  }

  return (
    <div className="application-layout application-v2">
      <aside className="application-progress">
        <p className="eyebrow">Officer registration</p>
        <h1>Join the approved LOKD network.</h1>
        <p>Complete your information once. Save-and-resume and mobile OTP will be connected before the external pilot.</p>
        <div className="mobile-progress" aria-label={`Step ${step} of ${steps.length}`}><span style={{ width: `${(step / steps.length) * 100}%` }} /></div>
        <div className="application-steps">{steps.map((item, index) => <button key={item} className={step === index + 1 ? "current" : step > index + 1 ? "done" : ""} onClick={() => setStep(index + 1)}><i>{step > index + 1 ? "✓" : index + 1}</i><span><strong>{item}</strong><small>{step > index + 1 ? "Complete" : step === index + 1 ? "In progress" : "Not started"}</small></span></button>)}</div>
        <div className="application-note"><strong>Approval comes first</strong><p>Your grade never automatically makes you eligible for Armed or VIP work. Those capabilities are verified separately.</p></div>
      </aside>
      <section className="application-form">
        <div className="form-heading"><span>Step {step} of 4</span><h2>{steps[step - 1]}</h2><p>Required fields and document checks will be validated before submission.</p></div>
        {step === 1 && <div className="field-grid"><label>First name<input defaultValue="Lerato" autoComplete="given-name" /></label><label>Last name<input defaultValue="Khumalo" autoComplete="family-name" /></label><label>Mobile number<input defaultValue="+27 82 555 0184" inputMode="tel" autoComplete="tel" /></label><label>Email address<input defaultValue="lerato@example.co.za" inputMode="email" autoComplete="email" /></label><label className="field-wide">Residential area<input defaultValue="Johannesburg North" autoComplete="address-level2" /></label></div>}
        {step === 2 && <><div className="field-grid"><label>PSiRA number<input placeholder="Enter registration number" /></label><label>Current grade<select defaultValue="B"><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option><option value="D">Grade D</option><option value="E">Grade E</option></select></label><label>Expiry date<input type="date" /></label><label>Identity document<select><option>South African ID</option><option>Lawful work document</option></select></label><button type="button" className="upload-field field-wide" onClick={() => flash("Secure document capture is the next connected build item.")}><span>＋</span><strong>Photograph or upload PSiRA proof</strong><small>PDF, JPG or PNG · upload status will appear here</small></button></div><div className="qualification-box"><div><span>Work capabilities</span><strong>Choose only work you are qualified to perform</strong><p>LOKD verifies each capability before matching offers.</p></div><label><input type="checkbox" defaultChecked /> Unarmed</label><label><input type="checkbox" /> Armed · competency proof required</label><label><input type="checkbox" /> VIP · close-protection proof required</label></div></>}
        {step === 3 && <div className="selection-grid"><p>Select areas where you can reliably arrive for work.</p>{["Rosebank / Sandton", "Midrand", "Linbro Park", "Randburg", "Centurion"].map((area, index) => <label key={area}><input type="checkbox" defaultChecked={index < 3} />{area}</label>)}<label className="field-wide">Typical availability<select><option>Weekday day and night shifts</option><option>Weekends only</option><option>Night shifts only</option></select></label></div>}
        {step === 4 && <div className="application-review"><div><span>Personal details</span><strong>Lerato Khumalo</strong><small>Mobile and email ready for verification</small></div><div><span>PSiRA</span><strong>Grade B</strong><small>Proof must be checked by LOKD</small></div><div><span>Offer choices</span><strong>Unarmed</strong><small>Armed and VIP stay off until separately verified</small></div><label className="consent"><input type="checkbox" /> I confirm the information is accurate and consent to the stated verification checks.</label><p>Verified payout details will be requested before paid work begins. They are not required to submit this first application.</p></div>}
        <div className="form-actions"><button className="secondary-button" disabled={step === 1} onClick={() => setStep(Math.max(1, step - 1))}>Back</button><button className="primary-button primary-button--light" onClick={() => step < 4 ? setStep(step + 1) : setSubmitted(true)}>{step < 4 ? "Save and continue" : "Submit application"}</button></div>
      </section>
    </div>
  );
}

function ApprovedOfficer({ pilot, state, flash }: { pilot: ReturnType<typeof usePilot>; state: PilotState; flash: (text: string) => void }) {
  const [tab, setTab] = useState<OfficerTab>("Home");
  const [workView, setWorkView] = useState<WorkView>("Offers");
  const [selectedShift, setSelectedShift] = useState<PilotShift | null>(null);
  const [confirmOffer, setConfirmOffer] = useState<PilotOffer | null>(null);
  const [helpShift, setHelpShift] = useState<PilotShift | null>(null);
  const [issueCategory, setIssueCategory] = useState("Safety concern");

  const openOffers = state.offers.filter((offer) => offer.status === "open");
  const activeShift = state.shifts.find((shift) => shift.status === "on_post") ?? null;
  const upcomingShift = state.shifts.filter((shift) => shift.status === "confirmed").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate))[0] ?? null;

  function choose(next: OfficerTab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function acceptOffer(offer: PilotOffer) {
    const result = await pilot.runAction({ action: "accept_offer", offerId: offer.id });
    if (result) {
      setConfirmOffer(null);
      setWorkView("My shifts");
      flash("Offer accepted. Your assignment is now under My shifts.");
    }
  }

  async function reportIssue() {
    if (!helpShift) return;
    const result = await pilot.runAction({ action: "report_issue", shiftId: helpShift.id, category: issueCategory });
    if (result) {
      setHelpShift(null);
      flash("Issue recorded for Operations follow-up.");
    }
  }

  return <>
    <section className="officer-welcome officer-welcome-v2"><div><p className="eyebrow">Friday · 21 August</p><h1>Good afternoon, {state.officer.fullName.split(" ")[0]}.</h1><p>Your next action is shown first.</p></div><div className={`approved-chip passport-chip passport-${state.officer.passport.status}`}><i /> <span><strong>LOKD Passport · {state.officer.passport.status}</strong><small>Next review {state.officer.passport.nextReviewAt?.slice(0,10) ?? "not scheduled"}</small></span></div></section>
    {pilot.error && <div className="officer-inline-error" role="alert">{pilot.error}</div>}
    <nav className="officer-tabbar officer-tabbar-v2" aria-label="Officer app">{officerTabs.map((item) => <button key={item.name} aria-current={tab === item.name ? "page" : undefined} className={tab === item.name ? "active" : ""} onClick={() => choose(item.name)}><i aria-hidden="true">{item.icon}</i><span>{item.name}</span>{item.name === "Work" && openOffers.length > 0 && <em>{openOffers.length}</em>}</button>)}</nav>

    {tab === "Home" && <OfficerHome state={state} activeShift={activeShift} upcomingShift={upcomingShift} openOffer={openOffers[0] ?? null} choose={choose} setWorkView={setWorkView} setSelectedShift={setSelectedShift} setHelpShift={setHelpShift} flash={flash} />}
    {tab === "Work" && <OfficerWork state={state} workView={workView} setWorkView={setWorkView} selectedShift={selectedShift} setSelectedShift={setSelectedShift} setConfirmOffer={setConfirmOffer} setHelpShift={setHelpShift} pilot={pilot} flash={flash} />}
    {tab === "Earnings" && <OfficerEarnings state={state} pilot={pilot} flash={flash} />}
    {tab === "Profile" && <OfficerProfile state={state} pilot={pilot} flash={flash} />}

    <nav className="mobile-bottom-nav officer-mobile-nav" aria-label="Officer app mobile navigation">{officerTabs.map((item) => <button key={item.name} aria-current={tab === item.name ? "page" : undefined} className={tab === item.name ? "active" : ""} onClick={() => choose(item.name)}><i aria-hidden="true">{item.icon}</i><span>{item.name}</span>{item.name === "Work" && openOffers.length > 0 && <em>{openOffers.length}</em>}</button>)}</nav>

    {confirmOffer && <div className="drawer-backdrop officer-modal-backdrop" onMouseDown={() => setConfirmOffer(null)}><section className="officer-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-offer-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={() => setConfirmOffer(null)}>×</button><p className="eyebrow">Confirm contract</p><h2 id="confirm-offer-title">Accept {money(confirmOffer.amountCents)} per completed shift?</h2><p>{confirmOffer.siteName} · {confirmOffer.shiftStart}–{confirmOffer.shiftEnd} · {confirmOffer.contractMonths}-month contract</p><dl><div><dt>Estimated shifts</dt><dd>20</dd></div><div><dt>Estimated contract earnings</dt><dd>{money(confirmOffer.amountCents * 20)}</dd></div><div><dt>Release cycle</dt><dd>{confirmOffer.releaseCadence}</dd></div></dl><div className="offer-confirm-note"><span>✓</span><p>Client payment is recorded as received and confirmed for the full service term. Your offer amount and release cadence are fixed for this assignment.</p></div><div className="modal-actions"><button onClick={() => setConfirmOffer(null)}>Not now</button><button disabled={pilot.busy} onClick={() => void acceptOffer(confirmOffer)}>{pilot.busy ? "Accepting…" : "Accept contract"}</button></div></section></div>}

    {helpShift && <div className="drawer-backdrop officer-modal-backdrop" onMouseDown={() => setHelpShift(null)}><section className="officer-help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" aria-label="Close" onClick={() => setHelpShift(null)}>×</button><p className="eyebrow eyebrow--amber">Shift help</p><h2 id="help-title">What do you need help with?</h2><p>{helpShift.siteName} · {helpShift.id}</p><div className="help-warning"><strong>Immediate danger?</strong><p>Use your site emergency procedure and call the configured emergency contact. The live control-room call path is not activated in this private pilot.</p></div><fieldset className="issue-options"><legend>Report a non-emergency issue</legend>{["Safety concern", "Medical issue", "Access problem", "Late relief", "Equipment problem", "Client dispute"].map((item) => <label key={item}><input type="radio" name="issue" checked={issueCategory === item} onChange={() => setIssueCategory(item)} />{item}</label>)}</fieldset><button className="report-issue-button" disabled={pilot.busy} onClick={() => void reportIssue()}>{pilot.busy ? "Recording…" : "Send to LOKD Operations"}</button></section></div>}
  </>;
}

function OfficerHome({ state, activeShift, upcomingShift, openOffer, choose, setWorkView, setSelectedShift, setHelpShift, flash }: {
  state: PilotState; activeShift: PilotShift | null; upcomingShift: PilotShift | null; openOffer: PilotOffer | null;
  choose: (tab: OfficerTab) => void; setWorkView: (view: WorkView) => void; setSelectedShift: (shift: PilotShift | null) => void;
  setHelpShift: (shift: PilotShift | null) => void; flash: (text: string) => void;
}) {
  const focusShift = activeShift ?? upcomingShift;
  return <>
    <section className="officer-action-grid"><article className={`officer-primary-action ${activeShift ? "is-live" : ""}`}><div className="action-status"><span><i />{activeShift ? "On shift now" : focusShift ? "Next shift" : "No shift scheduled"}</span>{focusShift && <em>{focusShift.shiftStart}–{focusShift.shiftEnd}</em>}</div>{focusShift ? <><h2>{focusShift.siteName}</h2><p>{focusShift.postName} · {focusShift.serviceType}</p><dl><div><dt>Date</dt><dd>{dateLabel(focusShift.scheduledDate)}</dd></div><div><dt>Earnings</dt><dd>{money(focusShift.earningsCents)}</dd></div><div><dt>Status</dt><dd>{activeShift ? `Checked in ${timeLabel(activeShift.checkInAt)}` : "Confirmed"}</dd></div></dl><div className="primary-action-buttons"><button onClick={() => { setSelectedShift(focusShift); setWorkView("My shifts"); choose("Work"); }}>{activeShift ? "Open shift" : "View briefing"}</button>{activeShift && <button className="help-button" onClick={() => setHelpShift(activeShift)}>HELP</button>}</div></> : <><h2>You are clear.</h2><p>New eligible work will appear under Work.</p><button onClick={() => choose("Work")}>Open Work</button></>}</article><div className="officer-glance-grid"><button onClick={() => { setWorkView("Offers"); choose("Work"); }}><span>Offers</span><strong>{openOffer ? "1 new offer" : "No new offers"}</strong><small>{openOffer ? `${money(openOffer.amountCents)} per completed shift` : "We will notify you when a match opens"}</small><b>›</b></button><button onClick={() => choose("Earnings")}><span>Ready for payout</span><strong>{money(state.wallet.availableCents)}</strong><small>{state.wallet.pendingCents ? `${money(state.wallet.pendingCents)} awaiting verification or release` : "No pending earnings"}</small><b>›</b></button><button onClick={() => flash("Post check recorded in the pilot activity trail.")}><span>Quick action</span><strong>Post check</strong><small>Confirm that everything is in order</small><b>›</b></button></div></section>
    <section className="officer-next-steps"><div><span>1</span><p><strong>Complete your shift</strong>Your attendance and handover create the earnings record.</p></div><i /><div><span>2</span><p><strong>Service is verified</strong>Client confirmation or LOKD review moves it toward release.</p></div><i /><div><span>3</span><p><strong>Request payout</strong>Thursday batches are expected to settle Friday; bank timing may vary.</p></div></section>
  </>;
}

function OfficerWork({ state, workView, setWorkView, selectedShift, setSelectedShift, setConfirmOffer, setHelpShift, pilot, flash }: {
  state: PilotState; workView: WorkView; setWorkView: (view: WorkView) => void; selectedShift: PilotShift | null;
  setSelectedShift: (shift: PilotShift | null) => void; setConfirmOffer: (offer: PilotOffer | null) => void;
  setHelpShift: (shift: PilotShift | null) => void; pilot: ReturnType<typeof usePilot>; flash: (text: string) => void;
}) {
  return <section className="officer-work-shell"><header className="officer-section-heading"><div><p className="eyebrow">Your work</p><h2>Offers and shifts</h2><p>Only eligible work matching your choices appears here.</p></div><div className="work-segment">{(["Offers", "My shifts"] as WorkView[]).map((view) => <button className={workView === view ? "active" : ""} key={view} onClick={() => { setWorkView(view); setSelectedShift(null); }}>{view}{view === "Offers" && state.offers.filter((offer) => offer.status === "open").length > 0 && <em>{state.offers.filter((offer) => offer.status === "open").length}</em>}</button>)}</div></header>{workView === "Offers" ? <OfferList offers={state.offers} pilot={pilot} setConfirmOffer={setConfirmOffer} flash={flash} /> : <ShiftList shifts={state.shifts} selectedShift={selectedShift} setSelectedShift={setSelectedShift} setHelpShift={setHelpShift} pilot={pilot} flash={flash} />}</section>;
}

function OfferList({ offers, pilot, setConfirmOffer, flash }: { offers: PilotOffer[]; pilot: ReturnType<typeof usePilot>; setConfirmOffer: (offer: PilotOffer | null) => void; flash: (text: string) => void }) {
  if (!offers.length) return <div className="officer-empty-state"><span>✓</span><h3>No offers to review.</h3><p>LOKD will alert you when eligible work matches your choices.</p></div>;
  return <div className="officer-offer-list">{offers.map((offer) => <article className={`officer-offer-card state-${offer.status}`} key={offer.id}><div className="offer-card-status"><span className={`service-badge service-${offer.serviceType.toLowerCase()}`}>{offer.serviceType}</span><em>{offer.status === "open" ? "Closes today · 18:00" : offer.status}</em></div><h3>{offer.siteName}</h3><p>{offer.postName} · {offer.siteArea}</p><div className="offer-pay"><strong>{money(offer.amountCents)}</strong><span>per completed 12-hour shift</span></div><dl><div><dt>Contract</dt><dd>{offer.contractMonths} month</dd></div><div><dt>First shift</dt><dd>{dateLabel("2026-08-22")}</dd></div><div><dt>Hours</dt><dd>{offer.shiftStart}–{offer.shiftEnd}</dd></div><div><dt>Release</dt><dd>{offer.releaseCadence}</dd></div></dl><div className="eligibility-note"><span>✓</span><p><strong>You match this offer.</strong>LOKD minimum: verified {offer.minimumGrade}. Your grade and Unarmed choice match.</p></div><div className="offer-rule"><span>i</span><p>Client payment is recorded as received and confirmed for the full service term. Estimated 20 shifts: <strong>{money(offer.amountCents * 20)}</strong>. Transport to the site is the officer’s responsibility unless the final contract says otherwise.</p></div>{offer.status === "open" ? <div className="offer-actions"><button disabled={pilot.busy} onClick={async () => { const result = await pilot.runAction({ action: "decline_offer", offerId: offer.id }); if (result) flash("Offer declined. No penalty was applied."); }}>Decline</button><button disabled={pilot.busy} onClick={() => setConfirmOffer(offer)}>Review and accept</button></div> : <div className={`offer-outcome ${offer.status}`}><strong>{offer.status === "accepted" ? "Contract accepted" : "Offer declined"}</strong><p>{offer.status === "accepted" ? "The assignment is under My shifts." : "This offer returned to the eligible queue."}</p></div>}</article>)}</div>;
}

function ShiftList({ shifts, selectedShift, setSelectedShift, setHelpShift, pilot, flash }: { shifts: PilotShift[]; selectedShift: PilotShift | null; setSelectedShift: (shift: PilotShift | null) => void; setHelpShift: (shift: PilotShift | null) => void; pilot: ReturnType<typeof usePilot>; flash: (text: string) => void }) {
  if (selectedShift) return <ShiftDetail shift={selectedShift} passportPath={pilot.state?.officer.passport.verificationPath ?? ""} setSelectedShift={setSelectedShift} setHelpShift={setHelpShift} pilot={pilot} flash={flash} />;
  return <div className="officer-shift-list">{shifts.map((shift) => <button key={shift.id} onClick={() => setSelectedShift(shift)}><time><strong>{dateLabel(shift.scheduledDate).split(" ")[0]}</strong><span>{dateLabel(shift.scheduledDate).split(" ").slice(1).join(" ")}</span></time><div><strong>{shift.siteName}</strong><small>{shift.shiftStart}–{shift.shiftEnd} · {shift.serviceType}</small><em>{money(shift.earningsCents)} · {shift.releaseCadence}</em></div><span className={`shift-state state-${shift.status}`}>{shift.status.replaceAll("_", " ")}</span><b>›</b></button>)}</div>;
}

function ShiftDetail({ shift, passportPath, setSelectedShift, setHelpShift, pilot, flash }: { shift: PilotShift; passportPath: string; setSelectedShift: (shift: PilotShift | null) => void; setHelpShift: (shift: PilotShift | null) => void; pilot: ReturnType<typeof usePilot>; flash: (text: string) => void }) {
  async function shiftAction(action: "check_in" | "complete_shift") {
    const result = await pilot.runAction({ action, shiftId: shift.id });
    if (result) {
      setSelectedShift(result.shifts.find((item) => item.id === shift.id) ?? null);
      flash(action === "check_in" ? "Check-in recorded using server time." : "Shift completed and sent for service verification.");
    }
  }
  const shiftPassportPath = `${passportPath}&booking=${encodeURIComponent(shift.bookingId)}&shift=${encodeURIComponent(shift.id)}`;
  return <article className="shift-detail-v2"><button className="back-link" onClick={() => setSelectedShift(null)}>← All shifts</button><div className="shift-detail-top"><div><span className={`shift-state state-${shift.status}`}>{shift.status.replaceAll("_", " ")}</span><h3>{shift.siteName}</h3><p>{shift.postName} · {shift.serviceType} · {shift.purposeLabel}</p></div><strong>{money(shift.earningsCents)}</strong></div><dl><div><dt>Date</dt><dd>{dateLabel(shift.scheduledDate)}</dd></div><div><dt>Shift</dt><dd>{shift.shiftStart}–{shift.shiftEnd}</dd></div><div><dt>Passport scan</dt><dd>{shift.passportVerificationStatus === "green" ? `Verified ${timeLabel(shift.passportVerifiedAt)}` : "Client scan required"}</dd></div><div><dt>Service record</dt><dd>{shift.clientSignoffStatus.replaceAll("_", " ")}</dd></div></dl><section className="briefing-card"><span>Site briefing</span><h4>{shift.purposeLabel}</h4><ul><li>Arrive in approved uniform with LOKD identification.</li><li>Ask the authorised client contact to scan your shift Passport QR.</li><li>Record access or safety exceptions immediately.</li></ul><button onClick={() => flash("Directions will open in the officer’s preferred maps application.")}>Open directions ↗</button></section>{(shift.status === "confirmed" || shift.status === "on_post") && <section className="shift-passport-card"><img src="/lokd-shift-passport-qr.svg" alt="Booking-specific LOKD Passport QR" /><div><span>CLIENT ARRIVAL CHECK</span><h4>Show this QR to the client</h4><p>The live page confirms your Passport, purpose endorsement and this exact assignment.</p><a href={shiftPassportPath} target="_blank" rel="noreferrer">Open verification page ↗</a></div></section>}<div className="shift-action-row">{shift.status === "confirmed" && <button disabled={pilot.busy || shift.passportVerificationStatus !== "green"} onClick={() => void shiftAction("check_in")}>{pilot.busy ? "Checking in…" : shift.passportVerificationStatus === "green" ? "Check in" : "Waiting for client scan"}</button>}{shift.status === "on_post" && <button disabled={pilot.busy} onClick={() => void shiftAction("complete_shift")}>{pilot.busy ? "Completing…" : "End shift and hand over"}</button>}{(shift.status === "confirmed" || shift.status === "on_post") && <button className="help-button" onClick={() => setHelpShift(shift)}>HELP</button>}</div><p className="pilot-control-note">The server rechecks your LOKD Passport, service readiness and purpose endorsement before attendance is accepted.</p></article>;
}

function OfficerEarnings({ state, pilot, flash }: { state: PilotState; pilot: ReturnType<typeof usePilot>; flash: (text: string) => void }) {
  async function requestPayout() {
    const result = await pilot.runAction({ action: "request_payout" });
    if (result) flash("Payout request queued for Thursday processing.");
  }
  const stateCopy: Record<string, { label: string; note: string; tone: string }> = {
    available: { label: "Ready for payout", note: "Released and available for the Thursday batch", tone: "green" },
    pending_signoff: { label: "Awaiting service verification", note: "Client confirmation or LOKD fallback review is still required", tone: "amber" },
    pending_release: { label: "Scheduled for release", note: "Verified work waiting for its weekly or monthly release", tone: "blue" },
    withdrawal_queued: { label: "Payout processing", note: "Submitted in the Thursday payout batch; bank settlement timing may vary", tone: "blue" },
    paid: { label: "Paid", note: "Settlement completed", tone: "green" },
    held: { label: "Held for review", note: "Only this contested earning is affected", tone: "red" },
  };
  return <section className="wallet-v2"><article className="wallet-balance-v2"><div><span>LOKD Earnings & Payouts</span><strong>{money(state.wallet.availableCents)}</strong><p>Ready for payout</p></div><dl><div><dt>Awaiting verification or release</dt><dd>{money(state.wallet.pendingCents)}</dd></div><div><dt>Payout processing</dt><dd>{money(state.wallet.withdrawalQueuedCents)}</dd></div><div><dt>Payout destination</dt><dd>Verified partner token · •••• 1842</dd></div></dl><div className="wallet-withdrawal"><span>Next processing window</span><strong>Thursday · expected Friday clearance</strong><button disabled={pilot.busy || state.wallet.availableCents === 0} onClick={() => void requestPayout()}>{pilot.busy ? "Queuing…" : state.wallet.availableCents ? `Request ${money(state.wallet.availableCents)} payout` : "Nothing ready yet"}</button></div><p className="earnings-disclaimer">Amounts shown are records of work and payout status. LOKD does not provide a bank account or stored-value wallet in this pilot.</p></article><section className="officer-section-card wallet-activity-v2"><div className="officer-section-heading"><div><p className="eyebrow">Earnings activity</p><h2>Where every amount stands</h2></div></div>{state.ledger.map((entry) => { const copy = stateCopy[entry.state] ?? stateCopy.pending_release; return <article className="earning-row-v2" key={entry.id}><div><strong>{entry.siteName}</strong><small>{entry.bookingId} · {entry.releaseCadence} release</small><p>{copy.note}</p></div><span><b>{money(entry.amountCents)}</b><em className={`pill tone-${copy.tone}`}>{copy.label}</em></span></article>; })}</section><section className="lokd-card-preview card-preview-v2"><div className="mini-payment-card"><img src="/lokd-logo.svg" alt="" /><span>OFFICER</span><b>•••• 2081</b></div><div><p className="eyebrow">Card concept · interest register</p><h2>LOKD Card</h2><p>An optional card remains under partner discussion. It will not affect officer approval, ranking, rates or access to ordinary EFT payouts.</p><small>No bank account, card or money movement is live in this private pilot.</small></div></section></section>;
}

function OfficerProfile({ state, pilot, flash }: { state: PilotState; pilot: ReturnType<typeof usePilot>; flash: (text: string) => void }) {
  async function toggle(serviceType: ServiceType, optedIn: boolean) {
    const result = await pilot.runAction({ action: "update_service_preference", serviceType, optedIn });
    if (result) flash(`${serviceType} offer notifications switched ${optedIn ? "on" : "off"}.`);
  }
  const passport = state.officer.passport;
  return <section className="profile-v2"><article className={`officer-section-card passport-owner-card passport-${passport.status}`}><div className="passport-owner-top"><div className="profile-person"><span>{state.officer.initials}</span><div><p className="eyebrow">LOKD Passport</p><h2>{passport.readinessLabel}</h2><p>{passport.passportNumber} · {passport.status}</p></div></div><img src="/lokd-passport-qr.svg" alt="Permanent LOKD Passport verification QR" /></div><p className="passport-gate-message">{passport.gateMessage}</p><div className="passport-owner-dates"><span><small>Last reviewed</small><strong>{passport.lastReviewedAt?.slice(0,10) ?? "—"}</strong></span><span><small>Next review</small><strong>{passport.nextReviewAt?.slice(0,10) ?? "—"}</strong></span></div><div className="passport-badges">{passport.endorsements.filter((item) => item.status === "current").map((item) => <span key={item.id}>{item.label}</span>)}</div><div className="passport-owner-actions"><a href={passport.verificationPath} target="_blank" rel="noreferrer">Open live Passport ↗</a><button onClick={() => flash("Assessment booking will connect to the LOKD Academy calendar next.")}>Book assessment</button></div></article><article className="officer-section-card profile-identity-v2"><div className="profile-person"><span>{state.officer.initials}</span><div><p className="eyebrow">Approved officer</p><h2>{state.officer.fullName}</h2><p>{state.officer.id} · {state.officer.city}</p></div></div><dl><div><dt>PSiRA grade</dt><dd>{state.officer.psiraGrade} · Verified</dd></div><div><dt>PSiRA number</dt><dd>{state.officer.psiraNumber}</dd></div><div><dt>PSiRA expiry</dt><dd>{state.officer.psiraExpiry}</dd></div><div><dt>Payout setup</dt><dd>{state.officer.bankingStatus}</dd></div></dl></article><article className="officer-section-card"><div className="officer-section-heading"><div><p className="eyebrow">Offer choices</p><h2>Work I want to hear about</h2><p>Qualification decides eligibility. You decide which eligible offers notify you.</p></div></div>{state.officer.services.map((service) => <div className={`preference-row preference-row-v2 ${service.qualified ? "" : "disabled"}`} key={service.serviceType}><span className={`service-badge service-${service.serviceType.toLowerCase()}`}>{service.serviceType}</span><div><strong>{service.qualified ? "Profile checks passed" : "Not yet eligible"}</strong><small>{service.qualified ? `Notifications ${service.optedIn ? "on" : "off"}` : "Add and verify the required qualification"}</small></div>{service.qualified ? <button aria-label={`${service.optedIn ? "Disable" : "Enable"} ${service.serviceType} offer notifications`} role="switch" aria-checked={service.optedIn} className={service.optedIn ? "toggle on" : "toggle"} disabled={pilot.busy} onClick={() => void toggle(service.serviceType, !service.optedIn)}><i /></button> : <button className="verify-link" onClick={() => flash(`${service.serviceType} proof upload is the next connected build item.`)}>Add proof</button>}</div>)}<div className="grade-explainer"><span>i</span><p><strong>{state.officer.psiraGrade} does not force you into Armed work.</strong> Every offer also requires a current LOKD service and purpose endorsement.</p></div></article><article className="officer-section-card compliance-centre"><div className="officer-section-heading"><div><p className="eyebrow">Compliance</p><h2>Your verified records</h2></div></div>{state.officer.compliance.map((record) => <div key={record.id}><span className="compliance-ok">✓</span><p><strong>{record.recordType}</strong><small>{record.expiresAt ? `Expires ${record.expiresAt}` : record.nextDueAt ? `Next due ${record.nextDueAt}` : "Current"}</small></p><em>{record.status}</em></div>)}<p className="reg21-note">LOKD endorsements are internal readiness standards and do not replace any statutory qualification or employer duty.</p></article></section>;
}
