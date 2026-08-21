"use client";

import { useState } from "react";

export default function OfficerApp() {
  const [mode, setMode] = useState<"approved" | "applicant">("approved");
  const [offerState, setOfferState] = useState<"open" | "accepted" | "declined">("open");
  const [notice, setNotice] = useState("");

  function flash(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 3000);
  }

  return (
    <main className="portal-shell officer-shell">
      <header className="portal-header">
        <a href="/" className="portal-logo"><img src="/lokd-logo.svg" alt="LOKD" /></a>
        <div className="portal-role-switch"><a href="/">Ops</a><a className="active" href="/officer">Officer</a><a href="/client">Client</a></div>
        <button className="portal-profile">LK</button>
      </header>

      <section className="portal-page officer-page">
        <div className="demo-switch"><span>Preview state</span><button className={mode === "approved" ? "active" : ""} onClick={() => setMode("approved")}>Approved officer</button><button className={mode === "applicant" ? "active" : ""} onClick={() => setMode("applicant")}>Applicant</button></div>
        {mode === "applicant" ? <Applicant flash={flash} /> : <ApprovedOfficer offerState={offerState} setOfferState={setOfferState} flash={flash} />}
      </section>
      {notice && <div className="toast"><span>✓</span>{notice}</div>}
    </main>
  );
}

function Applicant({ flash }: { flash: (text: string) => void }) {
  const [step, setStep] = useState(2);
  const steps = ["Personal information", "PSiRA & qualifications", "Availability & areas", "Banking & agreements"];
  return (
    <div className="application-layout">
      <aside className="application-progress">
        <p className="eyebrow">Officer application</p>
        <h1>Join the approved LOKD network.</h1>
        <p>Complete your information once. LOKD verifies every profile before any offer can be accepted.</p>
        <div className="application-steps">{steps.map((item,index) => <button key={item} className={step === index+1 ? "current" : step > index+1 ? "done" : ""} onClick={() => setStep(index+1)}><i>{step > index+1 ? "✓" : index+1}</i><span><strong>{item}</strong><small>{step > index+1 ? "Complete" : step === index+1 ? "In progress" : "Not started"}</small></span></button>)}</div>
        <div className="application-note"><strong>Approval is required</strong><p>Submitting information does not guarantee access to bookings or offers.</p></div>
      </aside>
      <section className="application-form">
        <div className="form-heading"><span>Step {step} of 4</span><h2>{steps[step-1]}</h2><p>Your information is reviewed by LOKD before activation.</p></div>
        {step === 1 && <div className="field-grid"><label>First name<input defaultValue="Lerato" /></label><label>Last name<input defaultValue="Khumalo" /></label><label>Mobile number<input defaultValue="+27 82 ••• ••84" /></label><label>Email address<input defaultValue="lerato@example.co.za" /></label><label className="field-wide">Residential area<input defaultValue="Johannesburg North" /></label></div>}
        {step === 2 && <div className="field-grid"><label>PSiRA number<input placeholder="Enter registration number" /></label><label>Current grade<select defaultValue="C"><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option></select></label><label>Expiry date<input type="date" /></label><label>Identity verification<select><option>South African ID</option><option>Lawful work document</option></select></label><button className="upload-field field-wide" onClick={() => flash("Document picker opened in demo mode.")}><span>＋</span><strong>Upload PSiRA certificate</strong><small>PDF, JPG or PNG · encrypted after upload</small></button></div>}
        {step === 3 && <div className="selection-grid"><p>Select the areas where you can reliably take offers.</p>{["Rosebank / Sandton","Midrand","Linbro Park","Randburg","Centurion"].map((area,index) => <label key={area}><input type="checkbox" defaultChecked={index < 3} />{area}</label>)}<label className="field-wide">Typical availability<select><option>Weekday day and night shifts</option><option>Weekends only</option><option>Night shifts only</option></select></label></div>}
        {step === 4 && <div className="field-grid"><label>Bank name<select><option>Select bank</option><option>FNB</option><option>Standard Bank</option><option>Absa</option><option>Nedbank</option><option>Capitec</option></select></label><label>Account type<select><option>Cheque / Current</option><option>Savings</option></select></label><label className="field-wide">Account number<input placeholder="Account number" /></label><label className="consent field-wide"><input type="checkbox" />I confirm the information is accurate and consent to verification.</label></div>}
        <div className="form-actions"><button className="secondary-button" disabled={step === 1} onClick={() => setStep(Math.max(1,step-1))}>Back</button><button className="primary-button primary-button--light" onClick={() => step < 4 ? setStep(step+1) : flash("Application submitted for LOKD approval.")}>{step < 4 ? "Save and continue" : "Submit for approval"}</button></div>
      </section>
    </div>
  );
}

function ApprovedOfficer({ offerState, setOfferState, flash }: { offerState: "open" | "accepted" | "declined"; setOfferState: (value: "open" | "accepted" | "declined") => void; flash: (text: string) => void }) {
  return (
    <>
      <section className="officer-welcome"><div><p className="eyebrow">Friday · 21 August</p><h1>Good afternoon, Lerato.</h1><p>Your profile is approved and open to eligible LOKD offers.</p></div><div className="approved-chip"><i /> Approved · PSiRA verified</div></section>
      <section className="wallet-card">
        <div className="wallet-main"><span>LOKD Wallet</span><small>Internal earnings ledger</small><strong>R2,880.00</strong><p>Total tracked earnings</p></div>
        <div className="wallet-buckets"><div><span>Available</span><strong>R960.00</strong><small>Eligible for Thursday withdrawal</small></div><div><span>Pending</span><strong>R1,920.00</strong><small>Awaiting client sign-off or contract end</small></div></div>
        <div className="wallet-cycle"><span>Next cycle</span><strong>Request Thursday · clears Friday</strong><button onClick={() => flash("R960 withdrawal queued for Thursday processing.")}>Request withdrawal →</button></div>
      </section>
      <section className="officer-grid">
        <article className="offer-card">
          <div className="offer-top"><div><p className="eyebrow">{offerState === "open" ? "New booking offer" : "Offer update"}</p><span className={offerState === "open" ? "offer-live" : "offer-muted"}>{offerState === "open" ? "Expires in 03:12" : offerState === "accepted" ? "Accepted" : "Declined"}</span></div><strong>R980.00</strong><small>Your offer amount</small></div>
          <h2>Saturday access-control shift</h2><p className="offer-site">Metsi Midrand Depot · Contractor access</p>
          <dl className="offer-terms"><div><dt>Date</dt><dd>Sat 22 Aug</dd></div><div><dt>Time</dt><dd>06:00–18:00</dd></div><div><dt>Length</dt><dd>12 hours</dd></div><div><dt>Release</dt><dd>Client sign-off</dd></div></dl>
          <div className="offer-rule"><span>i</span><p>This is a single-shift offer. R980 moves to Pending after completion and becomes Available when the client signs off or the booking term ends.</p></div>
          {offerState === "open" ? <div className="offer-actions"><button onClick={() => setOfferState("declined")}>Decline</button><button onClick={() => { setOfferState("accepted"); flash("Offer accepted. The shift is now assigned to you."); }}>Accept R980 offer</button></div> : <div className={`offer-outcome ${offerState}`}><strong>{offerState === "accepted" ? "Offer accepted" : "Offer declined"}</strong><p>{offerState === "accepted" ? "The booking is now in your schedule. Site briefing unlocks 24 hours before the shift." : "This offer has been returned to the eligible officer queue."}</p></div>}
        </article>
        <aside className="officer-side">
          <article className="small-portal-card"><div className="small-card-title"><span>Current booking</span><em>On post</em></div><h3>Northbridge Rosebank Offices</h3><p>06:00–18:00 · Main access</p><div className="shift-progress"><i /></div><div className="shift-times"><span>Checked in 05:54</span><span>Ends 18:00</span></div><button onClick={() => flash("Post check submitted at 14:35.")}>Submit post check</button></article>
          <article className="small-portal-card next-payout"><span>Thursday withdrawal</span><strong>27 Aug</strong><p>Requests entered by the cut-off are processed for Friday clearance.</p><a href="#wallet">View wallet activity →</a></article>
        </aside>
      </section>
      <nav className="mobile-bottom-nav"><button className="active">Today</button><button>Offers</button><button>Schedule</button><button>Wallet</button><button>Profile</button></nav>
    </>
  );
}
