"use client";

import Image from "next/image";
import { PublicFooter } from "../components/public-site-shell";
import { applicationPsiraDeclaration } from "../lib/psira-pathway";
import SandboxCommandRecovery from '../components/sandbox-command-recovery';
import Link from "next/link";
import { OFFICER_PORTAL_URL } from "../lib/public-site";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { FormEvent } from "react";

type Pathway = "qualified" | "training";

const serviceChoices = ["Unarmed", "Armed", "VIP"] as const;
const purposeChoices = [
  "Commercial access",
  "Construction site",
  "School",
  "Retail",
  "Residential",
  "Event",
  "Logistics / industrial",
] as const;
const trainingChoices = [
  "Entry-level security training",
  "Security grade upgrade",
  "Firearms training",
  "Armed-work readiness",
  "VIP / close-protection training",
] as const;

const subscribeToHydration = () => () => {};

export default function JoinPage() { return <OfficerApplicationJourney/>; }

export function OfficerApplicationJourney({sandbox=false,onSubmitted,onAccessLost}:{sandbox?:boolean;onSubmitted?:(reference:string)=>void;onAccessLost?:()=>void}) {
  const Root = sandbox ? 'section' : 'main';
  const Heading = sandbox ? 'h3' : 'h1';
  const [uncertain,setUncertain] = useState(false);
  const originalSandboxBody = useRef<string|null>(null);
  const ready = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const search = useSearchParams();
  const requestedPath = search.get("path");
  const initialPathway: Pathway = requestedPath === "training" ? "training" : "qualified";
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(1);
  const [pathway, setPathway] = useState<Pathway>(initialPathway);
  const [services, setServices] = useState<string[]>(["Unarmed"]);
  const [purposes, setPurposes] = useState<string[]>(["Commercial access"]);
  const [training, setTraining] = useState<string[]>([]);
  const [details, setDetails] = useState({ fullName: "", mobile: "", email: "", city: "", province: "Gauteng", psiraStatus: initialPathway === "training" ? "not_registered" : "active", psiraNumber: "", psiraGrade: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const psiraRequired = applicationPsiraDeclaration(pathway, details.psiraStatus) === "registered";
  const progress = useMemo(() => `${Math.round((step / 3) * 100)}%`, [step]);

  useEffect(() => {
    if (step > 1 || reference) headingRef.current?.focus();
  }, [step, reference]);

  function toggle(value: string, current: string[], update: (next: string[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function updateDetail(name: keyof typeof details, value: string) {
    setDetails((current) => ({ ...current, [name]: value }));
  }

  function continueForm() {
    setError("");
    if (step === 2) {
      if (!formRef.current?.reportValidity()) return;
      if (!/^(0\d{9}|27\d{9})$/.test(details.mobile.replace(/\D/g, ""))) { setError("Enter a South African mobile number, for example 082 123 4567 or +27 82 123 4567."); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) { setError("Enter a complete email address, for example name@example.co.za."); return; }
      if (psiraRequired && !/^\d{1,12}$/.test(details.psiraNumber.trim())) { setError("Enter your numeric PSiRA number. Registered officers must complete verification before work approval."); return; }
      if (details.fullName.trim().length < 3 || !details.mobile.trim() || !details.email.includes("@") || details.city.trim().length < 2) {
        setError("Complete your name, mobile number, email address and city before continuing.");
        return;
      }
    }
    setStep(step + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 3) { continueForm(); return; }
    if (busy || uncertain) return;
    setError("");
    if (!services.length) return setError("Choose at least one type of work you would like to hear about.");
    if (!purposes.length) return setError("Choose at least one work environment you would like to prepare for.");
    if (pathway === "training" && !training.length) return setError("Choose at least one training area.");
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const input = {pathway,...details,services,purposes,training,over18Confirmed:form.get("over18Confirmed")==="on",eligibilityAcknowledged:form.get("eligibilityAcknowledged")==="on",contactConsent:form.get("contactConsent")==="on",company:form.get("company")};
      const body=JSON.stringify(sandbox?{service:'officer_application',input,requestKey:crypto.randomUUID()}:input);
      if(sandbox)originalSandboxBody.current=body;
      const response = await fetch(sandbox?"/api/sandbox/application":"/api/applications", {method:"POST",headers:{"content-type":"application/json"},body});
      if(sandbox&&[401,403].includes(response.status))onAccessLost?.();
      if(sandbox&&(response.status>=500||response.status===202))setUncertain(true);
      const result=await response.json() as {mode?:string;policyVersion?:string;productionWorkEligible?:boolean;data?:unknown;reference?:string;error?:string};
      if(sandbox&&response.ok&&(result.mode!=='sandbox'||result.policyVersion!=='lokd-sandbox-completion-v1'||result.productionWorkEligible!==false)){setUncertain(true);throw Error('The isolated intake boundary could not be verified.');}
      const payload=(sandbox&&response.ok?result.data:result) as {reference?:string;error?:string};
      if(!response.ok||!payload?.reference)throw new Error(payload?.error??(response.status===202?"Your original sandbox application is pending. Recover its receipt before another submission.":"We could not save your application."));
      setReference(payload.reference);
      onSubmitted?.(payload.reference);
    } catch (cause) {
      if(sandbox&&(cause instanceof TypeError||cause instanceof SyntaxError))setUncertain(true);
      setError(cause instanceof Error ? cause.message : "We could not save your application.");
    } finally {
      setBusy(false);
    }
  }

  if (sandbox&&reference) return <section className="join-success"><h3 ref={headingRef} tabIndex={-1}>Fictional officer application saved</h3><p>Reference: {reference}</p><p>No real onboarding contact or approval was issued. Link this source to the signed-in synthetic account below.</p></section>;
  if (reference) {
    return <main className="join-shell public-home"><header className="join-header"><Link href="/"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /></Link><span>Officer network</span></header><section className="join-success"><div className="join-success-mark">✓</div><p className="public-kicker">Application received</p><h1 ref={headingRef} tabIndex={-1}>Your LOKD journey has started.</h1><p>We have saved your {pathway === "training" ? "training-pathway interest" : "officer application"}. A LOKD team member will contact you when the relevant intake opens.</p><p>{psiraRequired ? "Your application requires PSiRA verification and identity matching before security-work approval." : "Your training or registration-guidance intake will not be sent for a PSiRA registration lookup. You can update your pathway when registered."}</p><div className="journey-next"><h2>What happens next?</h2><p><strong>{psiraRequired ? "Verification pending" : pathway === "training" ? "Training interest recorded" : "Registration guidance requested"}</strong></p><p>{psiraRequired ? "Operations must check the official registration result and separately confirm it belongs to you. An unavailable, unclear or expired result remains unverified; a review may need more information." : "This intake does not require a PSiRA lookup. Registration and identity checks apply if you later apply for registered security work."}</p><p>Save your reference. Sign in to the officer portal using the same email, then link this application to follow progress and send corrections. Account linking does not grant work approval.</p><p>Work remains unavailable until the required checks and approved agreements are complete. Live identity verification remains gated. Approved agreements are delivered separately through your account; there is nothing to sign in this form.</p></div><dl><dt>Your reference</dt><dd>{reference}</dd></dl><div><Link className="public-button public-button--dark" href="/">Return home</Link><a className="public-button public-button--outline-dark" href={OFFICER_PORTAL_URL}>Track my application</a></div><small>Keep your reference. The authenticated onboarding stage will use a specialist identity provider for secure ID validation, selfie/liveness and face matching. Do not send identity documents, certificates or banking information by email or chat.</small></section><PublicFooter /></main>;
  }

  return (
    <Root className={sandbox ? "join-shell" : "join-shell public-home"}>
      <header className="join-header"><Link href="/"><Image width={1096} height={333} unoptimized loading="eager" style={{height:"auto"}} src="/lokd-logo.png" alt="LOKD" /></Link><span>Officer network</span><a href={OFFICER_PORTAL_URL}>Officer portal →</a></header>
      <div className="join-progress" aria-label={`Step ${step} of 3`}><span style={{ width: progress }} /></div>
      <section className="join-layout">
        <aside className="join-intro">
          <p className="public-kicker">Step {step} of 3</p>
          <Heading ref={headingRef} tabIndex={-1}>{step === 1 ? "Start where you are." : step === 2 ? "Tell us about yourself." : "Choose your direction."}</Heading>
          <p>{step === 1 ? "Your answer changes the next steps—not your opportunity to join the network." : step === 2 ? "We collect only enough information to place you in the correct intake." : "Choose the work and training information that is relevant to your goals."}</p>
          <div className="join-promise"><span>✓</span><p><strong>No documents or banking details here.</strong> Secure ID validation, liveness and credential checks follow inside the authenticated officer account.</p></div>
        </aside>

        <form ref={formRef} className="join-form-card" onSubmit={submit}>
          {step === 1 && <fieldset disabled={!ready} className="join-path-picker"><legend>Which describes you best?</legend><button type="button" className={pathway === "qualified" ? "selected" : ""} onClick={() => { setPathway("qualified"); if (details.psiraStatus === "not_registered") updateDetail("psiraStatus", "active"); }}><span>01</span><div><strong>I&apos;m already qualified</strong><p>I am PSiRA registered, trained or already working in security.</p></div><i>{pathway === "qualified" ? "✓" : "→"}</i></button><button type="button" className={pathway === "training" ? "selected" : ""} onClick={() => { setPathway("training"); if (details.psiraStatus === "active") updateDetail("psiraStatus", "not_registered"); }}><span>02</span><div><strong>I need training</strong><p>I am starting out, upgrading or need specialist training.</p></div><i>{pathway === "training" ? "✓" : "→"}</i></button><div className="join-form-note"><strong>{pathway === "qualified" ? "Officer application" : "Training-pathway interest"}</strong><p>{pathway === "qualified" ? "LOKD will later verify your registration and qualifications before activating work categories." : "LOKD will provide intake information only where the course and provider status are confirmed."}</p></div></fieldset>}

          {step === 2 && <div className="join-fields join-contact-step">
            <div className="join-form-title join-contact-heading">
              <span>YOUR DETAILS</span>
              <h2>How can LOKD reach you?</h2>
              <p>Use contact details you check regularly. Required fields are clearly marked.</p>
            </div>

            <section className="join-field-section" aria-labelledby="join-contact-details">
              <div className="join-section-heading">
                <span>01</span>
                <div><h3 id="join-contact-details">Contact details</h3><p>For intake updates and application follow-up.</p></div>
              </div>
              <div className="join-form-grid">
                <label className="join-field join-field--full"><span>Full name <b>Required</b></span><input name="fullName" value={details.fullName} onChange={(event) => updateDetail("fullName", event.target.value)} autoComplete="name" minLength={3} maxLength={100} required placeholder="e.g. Lerato Khumalo" /></label>
                <label className="join-field"><span>Mobile number <b>Required</b></span><input name="mobile" value={details.mobile} onChange={(event) => updateDetail("mobile", event.target.value)} type="tel" inputMode="tel" autoComplete="tel" required maxLength={24} placeholder="e.g. 082 123 4567" /></label>
                <label className="join-field"><span>Email address <b>Required</b></span><input name="email" value={details.email} onChange={(event) => updateDetail("email", event.target.value)} type="email" inputMode="email" autoComplete="email" required maxLength={120} placeholder="you@example.co.za" /></label>
              </div>
            </section>

            <section className="join-field-section" aria-labelledby="join-readiness-details">
              <div className="join-section-heading">
                <span>02</span>
                <div><h3 id="join-readiness-details">Location and readiness</h3><p>Enough context to route you to the correct intake.</p></div>
              </div>
              <div className="join-form-grid">
                <label className="join-field"><span>City or nearest town <b>Required</b></span><input name="city" value={details.city} onChange={(event) => updateDetail("city", event.target.value)} autoComplete="address-level2" required maxLength={80} placeholder="e.g. Johannesburg" /></label>
                <label className="join-field"><span>Province <b>Required</b></span><select name="province" value={details.province} onChange={(event) => updateDetail("province", event.target.value)} required><option>Gauteng</option><option>Western Cape</option><option>Free State</option><option>KwaZulu-Natal</option><option>Eastern Cape</option><option>Mpumalanga</option><option>Limpopo</option><option>North West</option><option>Northern Cape</option></select></label>
                <label className="join-field join-field--full"><span>Current PSiRA position <b>Required</b></span><select name="psiraStatus" value={details.psiraStatus} onChange={(event) => updateDetail("psiraStatus", event.target.value)} required><option value="active">Registered and current</option><option value="expired">Registered but needs renewal</option><option value="in_training">Currently in training</option><option value="not_registered">Not yet registered</option></select></label>
                {psiraRequired && <label className="join-field"><span>PSiRA number <b>Required</b></span><input name="psiraNumber" value={details.psiraNumber} onChange={(event) => updateDetail("psiraNumber", event.target.value)} inputMode="numeric" pattern="[0-9]{1,12}" required maxLength={12} placeholder="Enter your registration number" /></label>}
                {psiraRequired && <label className="join-field"><span>Highest grade <b className="join-optional">Optional</b></span><select name="psiraGrade" value={details.psiraGrade} onChange={(event) => updateDetail("psiraGrade", event.target.value)}><option value="">Not applicable / unsure</option><option>Grade A</option><option>Grade B</option><option>Grade C</option><option>Grade D</option><option>Grade E</option></select></label>}
              </div>
              <p>{psiraRequired ? "PSiRA registration verification and an independent identity match are mandatory before approval for security work." : "No PSiRA registration lookup is required for this intake. We will support your training or registration pathway; this is not a rejection and does not authorise paid security work."}</p>
            </section>

            <div className="join-privacy-strip"><span>✓</span><p><strong>Keep sensitive documents out of this form.</strong> Identity, credential and banking checks happen only inside the secure onboarding flow.</p></div>
            {error && <p className="join-error" role="alert">{error}</p>}
          </div>}

          {step === 3 && <div className="join-fields"><div className="join-form-title"><span>YOUR DIRECTION</span><h2>What would you like to work toward?</h2></div><fieldset className="join-check-grid"><legend>Work categories you are interested in</legend>{serviceChoices.map((item) => <label key={item}><input type="checkbox" checked={services.includes(item)} onChange={() => toggle(item, services, setServices)} /><span><strong>{item}</strong><small>{item === "Unarmed" ? "Guarding, access and event work" : item === "Armed" ? "Separate firearm and assignment checks apply" : "Separate close-protection credentials apply"}</small></span><i>✓</i></label>)}</fieldset><fieldset className="join-check-grid join-training-grid"><legend>Work environments you want to prepare for</legend>{purposeChoices.map((item) => <label key={item}><input type="checkbox" checked={purposes.includes(item)} onChange={() => toggle(item, purposes, setPurposes)} /><span><strong>{item}</strong></span><i>✓</i></label>)}<div className="join-form-note" style={{ gridColumn: "1 / -1" }}><strong>Interest is not an endorsement.</strong><p>LOKD training, assessment and approval are required before a purpose is added to your live LOKD Passport or used to match offers.</p></div></fieldset>{pathway === "training" && <fieldset className="join-check-grid join-training-grid"><legend>Training information you need</legend>{trainingChoices.map((item) => <label key={item}><input type="checkbox" checked={training.includes(item)} onChange={() => toggle(item, training, setTraining)} /><span><strong>{item}</strong></span><i>✓</i></label>)}</fieldset>}<div className="join-consent-stack"><label className="join-consent"><input name="over18Confirmed" type="checkbox" required /><span>I confirm that I am at least 18 years old.</span></label><label className="join-consent"><input name="eligibilityAcknowledged" type="checkbox" required /><span>I understand that PSiRA registration and work eligibility remain subject to the applicable statutory, training and fit-and-proper requirements.</span></label><label className="join-consent"><input name="contactConsent" type="checkbox" required /><span>I agree that LOKD may store these details, including my PSiRA number where provided, and contact me about officer onboarding or relevant training intake information, as described in the <a href="/privacy" target="_blank" rel="noreferrer">LOKD privacy notice</a>. I understand that this is not an offer of employment or a guarantee of work.</span></label></div><label className="join-honeypot" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>{error && <p className="join-error" role="alert">{error}</p>}</div>}

          <div className="join-form-actions">{step > 1 && <button type="button" disabled={busy||uncertain} onClick={() => { setError(""); setStep(step - 1); }}>← Back</button>}<span />{step < 3 ? <button className="public-button public-button--dark" type="submit" disabled={!ready}>Continue →</button> : <button className="public-button public-button--lime" type="submit" disabled={busy||uncertain}>{busy ? "Saving…" : pathway === "training" ? "Find my training pathway →" : "Submit officer application →"}</button>}</div>
        </form>
      </section>
      {uncertain&&sandbox&&<SandboxCommandRecovery scope='officer_application' endpoint='/api/sandbox/application' getBody={()=>originalSandboxBody.current} onRejected={()=>{originalSandboxBody.current=null;setUncertain(false);setError('The original request was rejected before any source write. Review and correct your details before submitting a new request.');}} onDenied={()=>{originalSandboxBody.current=null;onAccessLost?.();}} onRecovered={result=>{if(typeof result.reference==='string'){setReference(result.reference);setUncertain(false);setError('');onSubmitted?.(result.reference);}}}/>}{uncertain&&<p role="alert" className="join-error">The original sandbox application outcome is unconfirmed. Its exact request is retained in this tab. Do not submit another application until the original source is recovered.</p>}
      <div className="join-footer">Qualification, registration, licensing and app approval are separate processes. LOKD verifies the requirements applicable to each work category.</div>{!sandbox && <PublicFooter />}
    </Root>
  );
}
