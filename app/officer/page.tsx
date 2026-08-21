"use client";

import { useState } from "react";

type OfficerTab = "Home" | "Offers" | "Schedule" | "Wallet" | "Profile";
type OfferState = "open" | "accepted" | "declined";

const officerTabs: OfficerTab[] = ["Home", "Offers", "Schedule", "Wallet", "Profile"];

export default function OfficerApp() {
  const [mode, setMode] = useState<"approved" | "applicant">("approved");
  const [offerState, setOfferState] = useState<OfferState>("open");
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
        <button className="portal-profile" aria-label="Open officer profile">LK</button>
      </header>

      <section className="portal-page officer-page">
        <div className="demo-switch"><span>Preview state</span><button className={mode === "approved" ? "active" : ""} onClick={() => setMode("approved")}>Approved officer</button><button className={mode === "applicant" ? "active" : ""} onClick={() => setMode("applicant")}>Applicant</button></div>
        {mode === "applicant" ? <Applicant flash={flash} /> : <ApprovedOfficer offerState={offerState} setOfferState={setOfferState} flash={flash} />}
      </section>
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
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
        <div className="application-note"><strong>Approval is required</strong><p>Your grade, service qualifications and documents are checked before offers are switched on.</p></div>
      </aside>
      <section className="application-form">
        <div className="form-heading"><span>Step {step} of 4</span><h2>{steps[step-1]}</h2><p>Your information is reviewed by LOKD before activation.</p></div>
        {step === 1 && <div className="field-grid"><label>First name<input defaultValue="Lerato" /></label><label>Last name<input defaultValue="Khumalo" /></label><label>Mobile number<input defaultValue="+27 82 ••• ••84" /></label><label>Email address<input defaultValue="lerato@example.co.za" /></label><label className="field-wide">Residential area<input defaultValue="Johannesburg North" /></label></div>}
        {step === 2 && <><div className="field-grid"><label>PSiRA number<input placeholder="Enter registration number" /></label><label>Current grade<select defaultValue="B"><option value="A">Grade A</option><option value="B">Grade B</option><option value="C">Grade C</option></select></label><label>Expiry date<input type="date" /></label><label>Identity verification<select><option>South African ID</option><option>Lawful work document</option></select></label><button className="upload-field field-wide" onClick={() => flash("Document picker opened in demo mode.")}><span>＋</span><strong>Upload PSiRA certificate</strong><small>PDF, JPG or PNG · encrypted after upload</small></button></div><div className="qualification-box"><div><span>Service qualifications</span><strong>Tell us which work you are qualified to perform</strong><p>Your PSiRA grade and service qualifications are verified separately. A Grade B officer may still choose Unarmed offers.</p></div><label><input type="checkbox" defaultChecked /> Unarmed</label><label><input type="checkbox" defaultChecked /> Armed · competency required</label><label><input type="checkbox" /> VIP · close protection proof required</label></div></>}
        {step === 3 && <div className="selection-grid"><p>Select the areas where you can reliably take offers.</p>{["Rosebank / Sandton","Midrand","Linbro Park","Randburg","Centurion"].map((area,index) => <label key={area}><input type="checkbox" defaultChecked={index < 3} />{area}</label>)}<label className="field-wide">Typical availability<select><option>Weekday day and night shifts</option><option>Weekends only</option><option>Night shifts only</option></select></label></div>}
        {step === 4 && <div className="field-grid"><label>Bank name<select><option>Select bank</option><option>FNB</option><option>Standard Bank</option><option>Absa</option><option>Nedbank</option><option>Capitec</option></select></label><label>Account type<select><option>Cheque / Current</option><option>Savings</option></select></label><label className="field-wide">Account number<input placeholder="Account number" /></label><label className="consent field-wide"><input type="checkbox" />I confirm the information is accurate and consent to verification.</label></div>}
        <div className="form-actions"><button className="secondary-button" disabled={step === 1} onClick={() => setStep(Math.max(1,step-1))}>Back</button><button className="primary-button primary-button--light" onClick={() => step < 4 ? setStep(step+1) : flash("Application submitted for LOKD approval.")}>{step < 4 ? "Save and continue" : "Submit for approval"}</button></div>
      </section>
    </div>
  );
}

function ApprovedOfficer({ offerState, setOfferState, flash }: { offerState: OfferState; setOfferState: (value: OfferState) => void; flash: (text: string) => void }) {
  const [tab, setTab] = useState<OfficerTab>("Home");
  const [preferences, setPreferences] = useState({ Unarmed: true, Armed: false });

  function choose(next: OfficerTab) {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <section className="officer-welcome"><div><p className="eyebrow">Friday · 21 August</p><h1>Good afternoon, Lerato.</h1><p>Everything you need is one tap away.</p></div><div className="approved-chip"><i /> Approved · Grade B</div></section>

      <nav className="officer-tabbar" aria-label="Officer app">
        {officerTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => choose(item)}>{item}</button>)}
      </nav>

      <section className="officer-summary" aria-label="Officer summary">
        <button onClick={() => choose("Schedule")}><span>Next shift</span><strong>Today · 18:00</strong><small>Rosebank · Main access</small></button>
        <button onClick={() => choose("Offers")}><span>Open offers</span><strong>{offerState === "open" ? "1 new" : "All reviewed"}</strong><small>Matched to your choices</small></button>
        <button onClick={() => choose("Wallet")}><span>Available</span><strong>R960.00</strong><small>Thursday withdrawal</small></button>
      </section>

      {tab === "Home" && <OfficerHome choose={choose} flash={flash} />}
      {tab === "Offers" && <OfficerOffers offerState={offerState} setOfferState={setOfferState} flash={flash} />}
      {tab === "Schedule" && <OfficerSchedule flash={flash} />}
      {tab === "Wallet" && <OfficerWallet flash={flash} />}
      {tab === "Profile" && <OfficerProfile preferences={preferences} setPreferences={setPreferences} flash={flash} />}

      <nav className="mobile-bottom-nav" aria-label="Officer app mobile navigation">{officerTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => choose(item)}>{item}</button>)}</nav>
    </>
  );
}

function OfficerHome({ choose, flash }: { choose: (tab: OfficerTab) => void; flash: (text: string) => void }) {
  return <section className="officer-home-grid">
    <article className="officer-focus-card"><div className="focus-card-top"><span className="coverage-active"><i /> On post</span><em>Ends 18:00</em></div><h2>Northbridge Rosebank Offices</h2><p>Main access · Unarmed</p><div className="shift-progress"><i /></div><div className="shift-times"><span>Checked in 05:54</span><span>Ends 18:00</span></div><button className="primary-button primary-button--light" onClick={() => flash("Post check submitted at 14:35.")}>Submit post check</button></article>
    <aside className="officer-quick-stack"><article className="small-portal-card"><span>New Unarmed offer</span><strong>Saturday · R980</strong><p>You qualify because Grade B meets the minimum and Unarmed notifications are on.</p><button onClick={() => choose("Offers")}>Review offer →</button></article><article className="small-portal-card release-preview"><span>Next earnings release</span><strong>Friday · Weekly</strong><p>This 1-month contract releases verified earnings weekly.</p><button onClick={() => choose("Wallet")}>Open wallet →</button></article></aside>
  </section>;
}

function OfficerOffers({ offerState, setOfferState, flash }: { offerState: OfferState; setOfferState: (value: OfferState) => void; flash: (text: string) => void }) {
  return <section className="officer-section-card">
    <div className="section-heading"><div><p className="eyebrow">Matched work</p><h2>Offers for you</h2><p>Only work matching your grade, qualifications, area, availability and choices appears here.</p></div><span className="service-badge service-unarmed">Unarmed</span></div>
    <article className="offer-card offer-card--simple">
      <div className="offer-top"><div><span className={offerState === "open" ? "offer-live" : "offer-muted"}>{offerState === "open" ? "Expires in 03:12" : offerState === "accepted" ? "Accepted" : "Declined"}</span></div><strong>R980.00</strong><small>Your offer amount</small></div>
      <h2>Midrand contractor access</h2><p className="offer-site">Metsi Midrand Depot · 1-month contract</p>
      <dl className="offer-terms"><div><dt>Starts</dt><dd>Sat 22 Aug</dd></div><div><dt>Shift</dt><dd>06:00–18:00</dd></div><div><dt>Service</dt><dd>Unarmed</dd></div><div><dt>Release</dt><dd>Weekly</dd></div></dl>
      <div className="eligibility-note"><span>✓</span><p><strong>You match this offer.</strong> Grade C+ required · Grade B verified · Unarmed notifications on.</p></div>
      <div className="offer-rule"><span>i</span><p>The client has paid the full contract term. Completed, verified earnings move to Available in the weekly release; Thursday withdrawal requests are expected to clear Friday.</p></div>
      {offerState === "open" ? <div className="offer-actions"><button onClick={() => setOfferState("declined")}>Decline</button><button onClick={() => { setOfferState("accepted"); flash("Offer accepted. The contract is now in your schedule."); }}>Accept R980 offer</button></div> : <div className={`offer-outcome ${offerState}`}><strong>{offerState === "accepted" ? "Offer accepted" : "Offer declined"}</strong><p>{offerState === "accepted" ? "This contract is now in Schedule. Site briefing unlocks before the first shift." : "This offer has returned to the eligible officer queue."}</p></div>}
    </article>
  </section>;
}

function OfficerSchedule({ flash }: { flash: (text: string) => void }) {
  const items = [
    { day: "Today", date: "21 Aug", site: "Northbridge Rosebank", shift: "06:00–18:00", service: "Unarmed", state: "On post" },
    { day: "Monday", date: "24 Aug", site: "Northbridge Rosebank", shift: "06:00–18:00", service: "Unarmed", state: "Confirmed" },
    { day: "Friday", date: "28 Aug", site: "Metsi Midrand", shift: "06:00–18:00", service: "Unarmed", state: "Confirmed" },
  ];
  return <section className="officer-section-card"><div className="section-heading"><div><p className="eyebrow">Your work</p><h2>Schedule</h2><p>Upcoming shifts and the information you need to arrive ready.</p></div></div><div className="schedule-list">{items.map((item) => <button key={item.date+item.site} onClick={() => flash(`${item.site} briefing opened.`)}><time><strong>{item.day}</strong><span>{item.date}</span></time><div><strong>{item.site}</strong><small>{item.shift} · {item.service}</small></div><em>{item.state}</em><b>›</b></button>)}</div></section>;
}

function OfficerWallet({ flash }: { flash: (text: string) => void }) {
  return <>
    <section className="wallet-card" id="wallet"><div className="wallet-main"><span>LOKD Wallet</span><small>Internal earnings ledger</small><strong>R2,880.00</strong><p>Total tracked earnings</p></div><div className="wallet-buckets"><div><span>Available</span><strong>R960.00</strong><small>Eligible for Thursday withdrawal</small></div><div><span>Pending</span><strong>R1,920.00</strong><small>Verified work awaiting its release cycle</small></div></div><div className="wallet-cycle"><span>Next withdrawal</span><strong>Request Thursday · expected Friday clearance</strong><button onClick={() => flash("R960 withdrawal queued for Thursday processing.")}>Request R960 withdrawal →</button></div></section>
    <section className="release-policy-grid"><article><span>Contracts up to 3 months</span><strong>Weekly release</strong><p>Verified completed earnings are grouped and released every week.</p></article><article><span>Contracts longer than 3 months</span><strong>Monthly release</strong><p>Verified completed earnings are grouped and released each month.</p></article><article><span>After release</span><strong>Available to withdraw</strong><p>Thursday requests are processed for expected Friday bank clearance.</p></article></section>
    <section className="lokd-card-preview"><div className="mini-payment-card"><img src="/lokd-logo.svg" alt="" /><span>OFFICER</span><b>•••• 2081</b></div><div><p className="eyebrow">Future wallet layer</p><h2>LOKD Card</h2><p>A planned optional payout destination issued and administered by a licensed banking partner. Released earnings could be sent to an officer's own bank account or, in future, onto the card for purchases and cash withdrawals.</p><small>Pending earnings would never be spendable. Partner fees, limits and FICA requirements would apply.</small></div><em>Planned</em></section>
    <section className="officer-section-card wallet-activity"><div className="section-heading"><div><p className="eyebrow">Ledger activity</p><h2>Recent earnings</h2></div></div><div className="wallet-activity-row"><span><strong>Rosebank · Week 3</strong><small>1-month Unarmed contract</small></span><b>R960.00</b><em className="pill tone-green">Available</em></div><div className="wallet-activity-row"><span><strong>Rosebank · Week 4</strong><small>Shift verified · weekly release Friday</small></span><b>R960.00</b><em className="pill tone-amber">Pending</em></div><div className="wallet-activity-row"><span><strong>Sandton VIP contract</strong><small>6-month term · monthly release</small></span><b>R960.00</b><em className="pill tone-amber">Pending</em></div></section>
  </>;
}

function OfficerProfile({ preferences, setPreferences, flash }: { preferences: { Unarmed: boolean; Armed: boolean }; setPreferences: (value: { Unarmed: boolean; Armed: boolean }) => void; flash: (text: string) => void }) {
  return <section className="profile-layout"><article className="officer-section-card profile-identity"><div className="profile-person"><span>LK</span><div><p className="eyebrow">Approved officer</p><h2>Lerato Khumalo</h2><p>LOKD-002 · Johannesburg North</p></div></div><dl><div><dt>PSiRA grade</dt><dd>Grade B · Verified</dd></div><div><dt>PSiRA status</dt><dd>Current</dd></div><div><dt>Service area</dt><dd>Rosebank · Sandton · Midrand</dd></div></dl><button onClick={() => flash("Profile edit opened in demo mode.")}>Edit profile</button></article><article className="officer-section-card preference-card"><div className="section-heading"><div><p className="eyebrow">Offer choices</p><h2>Work I want to hear about</h2><p>Grade and service qualification determine eligibility. You decide which eligible offers notify you.</p></div></div><div className="preference-row"><span className="service-badge service-unarmed">Unarmed</span><div><strong>Eligible · Grade B verified</strong><small>No additional service endorsement required</small></div><button role="switch" aria-checked={preferences.Unarmed} className={preferences.Unarmed ? "toggle on" : "toggle"} onClick={() => setPreferences({...preferences,Unarmed:!preferences.Unarmed})}><i /></button></div><div className="preference-row"><span className="service-badge service-armed">Armed</span><div><strong>Eligible · competency verified</strong><small>Notifications currently {preferences.Armed ? "on" : "off"}</small></div><button role="switch" aria-checked={preferences.Armed} className={preferences.Armed ? "toggle on" : "toggle"} onClick={() => setPreferences({...preferences,Armed:!preferences.Armed})}><i /></button></div><div className="preference-row disabled"><span className="service-badge service-vip">VIP</span><div><strong>Not yet eligible</strong><small>Close protection qualification must be verified</small></div><button className="verify-link" onClick={() => flash("VIP qualification upload opened.")}>Add proof</button></div><div className="grade-explainer"><span>i</span><p><strong>Your Grade B does not force you into Armed work.</strong> You can keep Unarmed offers on, switch Armed notifications off, and add VIP only when the qualification is verified.</p></div></article></section>;
}
