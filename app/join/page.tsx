"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { PublicHeader, PublicFooter } from "../components/public-site-shell";
import { Icon } from "../components/icons";
import { newOfficerSteps, officerAvailability, officerEntryPath, renewalStatuses, type OfficerEntryPath } from "../lib/psira-pathway";

const services = ["Unarmed", "Armed", "VIP"];
const purposes = ["Commercial access", "Construction site", "School", "Retail", "Residential", "Event", "Logistics / industrial"];
const trainingChoices = ["Entry-level security training", "Security grade upgrade", "Firearms training", "Armed-work readiness", "VIP / close-protection training"];
const provinces = ["Gauteng", "Western Cape", "Free State", "KwaZulu-Natal", "Eastern Cape", "Mpumalanga", "Limpopo", "North West", "Northern Cape"];

export default function JoinPage() { return <OfficerApplicationJourney />; }

export function OfficerApplicationJourney({ onSubmitted }: { onSubmitted?: (reference: string) => void } = {}) {
  const search = useSearchParams();
  const entryPath = officerEntryPath(search.get("path"));
  return <OfficerApplicationForm key={entryPath} initialPath={entryPath} onSubmitted={onSubmitted} />;
}

function OfficerApplicationForm({ initialPath, onSubmitted }: { initialPath: OfficerEntryPath; onSubmitted?: (reference: string) => void }) {
  const [pathway, setPathway] = useState(initialPath === "new" ? "training" : "qualified");
  const [psiraStatus, setPsiraStatus] = useState(initialPath === "new" ? "not_registered" : "active");
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState("");
  const [reference, setReference] = useState(""), [emailSent, setEmailSent] = useState(false);
  const inFlight = useRef(false), original = useRef<{ input: string; body: string } | null>(null);
  const confirmation = useRef<HTMLHeadingElement>(null), errorRef = useRef<HTMLParagraphElement>(null);
  const registered = psiraStatus === "active" || psiraStatus === "expired";
  useEffect(() => { if (reference) confirmation.current?.focus(); }, [reference]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function send(body: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/applications", { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(45000) });
      if (response.status >= 500) setUncertain(true);
      const result = await response.json() as {saved?: boolean; reference?: string; error?: string; confirmationEmailSent?: boolean};
      if (!response.ok) {
        if (response.status < 500) setUncertain(false);
        throw new Error(typeof result?.error === "string" ? result.error : "We could not save your application. Please try again.");
      }
      if (result?.saved !== true || typeof result.reference !== "string" || !/^APP-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(result.reference)) {
        setUncertain(true); throw new Error("We could not confirm your application. Retry the original request below to check its status.");
      }
      setUncertain(false); setReference(result.reference); setEmailSent(result.confirmationEmailSent === true); onSubmitted?.(result.reference);
    } catch (cause) {
      if (!(cause instanceof Error) || cause instanceof TypeError || cause instanceof SyntaxError || cause.name === "TimeoutError" || cause.name === "AbortError") setUncertain(true);
      setError(cause instanceof Error && !["TimeoutError", "AbortError"].includes(cause.name) ? cause.message : "The connection timed out. Retry the original application to check whether it was saved.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || uncertain) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    if (!/^(0\d{9}|27\d{9})$/.test(value("mobile").replace(/\D/g, ""))) { setError("Enter a South African mobile number, starting with 0 or +27."); return; }
    if (!form.getAll("services").length || !form.getAll("purposes").length) { setError("Choose at least one work interest and one work environment."); return; }
    if (registered && !form.getAll("availability").length) { setError("Choose at least one availability option."); return; }
    if (pathway === "training" && !form.getAll("training").length) { setError("Choose at least one training interest."); return; }
    const input = {
      pathway, entryPath: pathway === "training" ? "new" : "registered", fullName: value("fullName"), mobile: value("mobile"), email: value("email"), city: value("city"), province: value("province"),
      psiraStatus, psiraNumber: registered ? value("psiraNumber") : "", psiraGrade: registered ? value("psiraGrade") : "",
      services: form.getAll("services"), purposes: form.getAll("purposes"), training: form.getAll("training"),
      availability: form.getAll("availability"), renewalStatus: psiraStatus === "expired" ? value("renewalStatus") : undefined,
      over18Confirmed: form.get("over18Confirmed") === "on", eligibilityAcknowledged: form.get("eligibilityAcknowledged") === "on",
      contactConsent: form.get("contactConsent") === "on", company: value("company"),
    };
    const canonical = JSON.stringify(input);
    if (original.current?.input !== canonical) original.current = { input: canonical, body: JSON.stringify({ ...input, requestKey: crypto.randomUUID() }) };
    await send(original.current.body);
  }

  return <div className="public-site officers-site"><PublicHeader active="officers" /><main id="main-content" tabIndex={-1}>
    <section className="public-page-hero"><p className="public-kicker">Join LOKD · South Africa</p><h1>Apply as an officer.</h1><p>Tell us about your experience and qualifications to take the next step towards security work with LOKD.</p><ul className="public-inline-proof"><li>PSIRA registration checks</li><li>Identity verification</li><li>Suitable shifts in the app</li><li>Clear assignment details</li></ul></section>
    <section className="public-form-section">
      {reference ? <div className="public-form-success" aria-live="polite"><span className="public-success-mark"><Icon name="circleCheck" /></span><h2 ref={confirmation} tabIndex={-1}>Your application is with LOKD.</h2><p>We will review your details and contact you about your next steps.</p>{emailSent && <p>A confirmation has been sent to your email address.</p>}<dl><dt>Application reference</dt><dd>{reference}</dd></dl><p>Open the Officer Zone using the email you applied with to follow your application and respond to requests. Registration, identity and role checks are completed before you can start work.</p><Link className="public-button public-button--primary" href="/sign-in?return_to=%2Fofficer">Track your application</Link></div> :
      <form className="public-form" onSubmit={submit} aria-busy={busy}>
        <div><h2>Your officer application</h2><p>All fields are required unless marked optional. Keep identity documents for the secure ID check in your Officer Zone.</p></div>
        {pathway === "training" && <section className="officers-pathway" aria-labelledby="new-pathway-title"><h3 id="new-pathway-title">Your route into security work</h3><p>LOKD is a certified security training provider. We guide you from your application through training and registration, with work offered only after the required checks.</p><ol>{newOfficerSteps.map(([title, detail]) => <li key={title}><strong>{title}</strong><span>{detail}</span></li>)}</ol><Link href="/training">Explore training at LOKD</Link></section>}
        <fieldset disabled={busy || uncertain}><legend>1. Your details</legend><div className="public-form-grid">
          <label className="public-field-full">Full name<input name="fullName" required minLength={3} maxLength={100} autoComplete="name" /></label>
          <label>Mobile number<input name="mobile" type="tel" required maxLength={24} autoComplete="tel" /></label><label>Email address<input name="email" type="email" required maxLength={120} autoComplete="email" /></label>
          <label>City or town<input name="city" required minLength={2} maxLength={80} autoComplete="address-level2" /></label>
          <label>Province<select name="province" required defaultValue="Gauteng" autoComplete="address-level1">{provinces.map(province => <option key={province}>{province}</option>)}</select></label>
        </div></fieldset>
        <fieldset disabled={busy || uncertain}><legend>2. Your registration</legend><div className="public-form-grid">
          <label>Application pathway<select name="pathway" value={pathway} onChange={event => { setPathway(event.target.value); setPsiraStatus(event.target.value === "training" ? "not_registered" : "active"); }}><option value="qualified">PSIRA Registered or renewal</option><option value="training">New Application</option></select></label>
          <label>PSIRA registration status<select name="psiraStatus" value={psiraStatus} onChange={event => setPsiraStatus(event.target.value)}>{pathway === "qualified" ? <><option value="active">Registered and current</option><option value="expired">Registered — renewal needed</option></> : <><option value="in_training">Currently in training</option><option value="not_registered">Not yet registered</option></>}</select></label>
          {registered && <><label>PSIRA number<input name="psiraNumber" required pattern="[0-9]{1,12}" maxLength={12} inputMode="numeric" /></label><label>Highest grade<select name="psiraGrade" required defaultValue=""><option value="">Choose your grade</option>{["Grade A", "Grade B", "Grade C", "Grade D", "Grade E"].map(grade => <option key={grade}>{grade}</option>)}</select></label></>}
          {psiraStatus === "expired" && <label className="public-field-full">Renewal status<select name="renewalStatus" required defaultValue=""><option value="">Choose your renewal status</option>{renewalStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        </div><p className="public-note">{psiraStatus === "expired" ? "LOKD can help with PSIRA renewal and refresher training before work is offered. Your registration must be current, with identity and role checks complete, before you can work." : "LOKD checks registration, identity and role qualifications before approving security work. Training and registration must be complete before work is offered."}</p></fieldset>
        <fieldset disabled={busy || uncertain}><legend>3. Work interests — choose at least one</legend><div className="public-choice-grid">{services.map(service => <label key={service}><input type="checkbox" name="services" value={service} /><span>{service}</span></label>)}</div></fieldset>
        <fieldset disabled={busy || uncertain}><legend>Work environments — choose at least one</legend><div className="public-choice-grid">{purposes.map(purpose => <label key={purpose}><input type="checkbox" name="purposes" value={purpose} /><span>{purpose}</span></label>)}</div></fieldset>
        {registered && <fieldset disabled={busy || uncertain}><legend>Availability — choose at least one</legend><div className="public-choice-grid">{officerAvailability.map(availability => <label key={availability}><input type="checkbox" name="availability" value={availability} /><span>{availability}</span></label>)}</div><p className="public-note">Tell us when and how you prefer to work. You review each shift offer before accepting it.</p></fieldset>}
        {pathway === "training" && <fieldset disabled={busy || uncertain}><legend>Training interests — choose at least one</legend><div className="public-choice-grid">{trainingChoices.map(training => <label key={training}><input type="checkbox" name="training" value={training} /><span>{training}</span></label>)}</div></fieldset>}
        <fieldset className="public-consents" disabled={busy || uncertain}><legend>Your agreement</legend>
          <label><input name="over18Confirmed" type="checkbox" required /><span>I confirm that I am at least 18 years old.</span></label>
          <label><input name="eligibilityAcknowledged" type="checkbox" required /><span>I understand that registration, qualifications and work eligibility must be checked before I can work.</span></label>
          <label><input name="contactConsent" type="checkbox" required /><span>I agree that LOKD may store these details and contact me about my application or training interests under the <Link href="/privacy">privacy notice</Link>. Applying does not guarantee work or a training place.</span></label>
          <label className="public-honeypot" aria-hidden="true">Leave this field empty<input name="company" tabIndex={-1} autoComplete="off" /></label>
        </fieldset>
        {error && <p className="public-form-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
        {uncertain && <div className="public-retry"><p>Keep this page open. Retrying checks the same application and avoids a duplicate.</p><button type="button" disabled={busy} onClick={() => { if (original.current) void send(original.current.body); }}>Retry original application</button></div>}
        <button className="public-button public-button--primary" type="submit" disabled={busy || uncertain}>{busy ? "Sending your application…" : "Submit application"}</button>
      </form>}
    </section>
  </main><PublicFooter /></div>;
}
