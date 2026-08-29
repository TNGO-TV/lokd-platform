"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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

export default function JoinPage() {
  const search = useSearchParams();
  const requestedPath = search.get("path");
  const initialPathway: Pathway = requestedPath === "training" ? "training" : "qualified";
  const [step, setStep] = useState(1);
  const [pathway, setPathway] = useState<Pathway>(initialPathway);
  const [services, setServices] = useState<string[]>(["Unarmed"]);
  const [purposes, setPurposes] = useState<string[]>(["Commercial access"]);
  const [training, setTraining] = useState<string[]>([]);
  const [details, setDetails] = useState({ fullName: "", mobile: "", email: "", city: "", province: "Gauteng", psiraStatus: initialPathway === "training" ? "not_registered" : "active", psiraNumber: "", psiraGrade: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  const progress = useMemo(() => `${Math.round((step / 3) * 100)}%`, [step]);

  function toggle(value: string, current: string[], update: (next: string[]) => void) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function updateDetail(name: keyof typeof details, value: string) {
    setDetails((current) => ({ ...current, [name]: value }));
  }

  function continueForm() {
    setError("");
    if (step === 2) {
      if (details.fullName.trim().length < 3 || !details.mobile.trim() || !details.email.includes("@") || details.city.trim().length < 2) {
        setError("Complete your name, mobile number, email address and city before continuing.");
        return;
      }
    }
    setStep(step + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!services.length) return setError("Choose at least one type of work you would like to hear about.");
    if (!purposes.length) return setError("Choose at least one work environment you would like to prepare for.");
    if (pathway === "training" && !training.length) return setError("Choose at least one training area.");
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pathway,
          ...details,
          services,
          purposes,
          training,
          over18Confirmed: form.get("over18Confirmed") === "on",
          eligibilityAcknowledged: form.get("eligibilityAcknowledged") === "on",
          contactConsent: form.get("contactConsent") === "on",
          company: form.get("company"),
        }),
      });
      const payload = (await response.json()) as { reference?: string; error?: string };
      if (!response.ok || !payload.reference) throw new Error(payload.error ?? "We could not save your application.");
      setReference(payload.reference);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your application.");
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return <main className="join-shell"><header className="join-header"><Link href="/"><img src="/lokd-logo.png" alt="LOKD" /></Link><span>Officer network</span></header><section className="join-success"><div className="join-success-mark">✓</div><p className="public-kicker">Application received</p><h1>Your LOKD journey has started.</h1><p>We have saved your {pathway === "training" ? "training-pathway interest" : "officer application"}. A LOKD team member will contact you when the relevant pilot intake opens.</p><dl><dt>Your reference</dt><dd>{reference}</dd></dl><div><Link className="public-button public-button--dark" href="/">Return home</Link><Link className="public-button public-button--outline-dark" href="/officer">View officer pilot</Link></div><small>Keep your reference. The authenticated onboarding stage will use a specialist identity provider for secure ID validation, selfie/liveness and face matching. Do not send identity documents, certificates or banking information by email or chat.</small></section></main>;
  }

  return (
    <main className="join-shell">
      <header className="join-header"><Link href="/"><img src="/lokd-logo.png" alt="LOKD" /></Link><span>Officer network</span><Link href="/officer">Officer pilot →</Link></header>
      <div className="join-progress" aria-label={`Step ${step} of 3`}><span style={{ width: progress }} /></div>
      <section className="join-layout">
        <aside className="join-intro">
          <p className="public-kicker">Step {step} of 3</p>
          <h1>{step === 1 ? "Start where you are." : step === 2 ? "Tell us about yourself." : "Choose your direction."}</h1>
          <p>{step === 1 ? "Your answer changes the next steps—not your opportunity to join the network." : step === 2 ? "We collect only enough information to place you in the correct pilot intake." : "Choose the work and training information that is relevant to your goals."}</p>
          <div className="join-promise"><span>✓</span><p><strong>No documents or banking details here.</strong> Secure ID validation, liveness and credential checks follow inside the authenticated officer account.</p></div>
        </aside>

        <form className="join-form-card" onSubmit={submit}>
          {step === 1 && <fieldset className="join-path-picker"><legend>Which describes you best?</legend><button type="button" className={pathway === "qualified" ? "selected" : ""} onClick={() => { setPathway("qualified"); if (details.psiraStatus === "not_registered") updateDetail("psiraStatus", "active"); }}><span>01</span><div><strong>I&apos;m already qualified</strong><p>I am PSiRA registered, trained or already working in security.</p></div><i>{pathway === "qualified" ? "✓" : "→"}</i></button><button type="button" className={pathway === "training" ? "selected" : ""} onClick={() => { setPathway("training"); if (details.psiraStatus === "active") updateDetail("psiraStatus", "not_registered"); }}><span>02</span><div><strong>I need training</strong><p>I am starting out, upgrading or need specialist training.</p></div><i>{pathway === "training" ? "✓" : "→"}</i></button><div className="join-form-note"><strong>{pathway === "qualified" ? "Officer application" : "Training-pathway interest"}</strong><p>{pathway === "qualified" ? "LOKD will later verify your registration and qualifications before activating work categories." : "LOKD will provide intake information only where the course and provider status are confirmed."}</p></div></fieldset>}

          {step === 2 && <div className="join-fields join-contact-step">
            <div className="join-form-title join-contact-heading">
              <span>YOUR DETAILS</span>
              <h2>How can LOKD reach you?</h2>
              <p>Use contact details you check regularly. Required fields are clearly marked.</p>
            </div>

            <section className="join-field-section" aria-labelledby="join-contact-details">
              <div className="join-section-heading">
                <span>01</span>
                <div><h3 id="join-contact-details">Contact details</h3><p>For pilot intake updates and application follow-up.</p></div>
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
                <div><h3 id="join-readiness-details">Location and readiness</h3><p>Enough context to route you to the correct pilot intake.</p></div>
              </div>
              <div className="join-form-grid">
                <label className="join-field"><span>City or nearest town <b>Required</b></span><input name="city" value={details.city} onChange={(event) => updateDetail("city", event.target.value)} autoComplete="address-level2" required maxLength={80} placeholder="e.g. Johannesburg" /></label>
                <label className="join-field"><span>Province <b>Required</b></span><select name="province" value={details.province} onChange={(event) => updateDetail("province", event.target.value)} required><option>Gauteng</option><option>Western Cape</option><option>Free State</option><option>KwaZulu-Natal</option><option>Eastern Cape</option><option>Mpumalanga</option><option>Limpopo</option><option>North West</option><option>Northern Cape</option></select></label>
                <label className="join-field join-field--full"><span>Current PSiRA position <b>Required</b></span><select name="psiraStatus" value={details.psiraStatus} onChange={(event) => updateDetail("psiraStatus", event.target.value)} required><option value="active">Registered and current</option><option value="expired">Registered but needs renewal</option><option value="in_training">Currently in training</option><option value="not_registered">Not yet registered</option></select></label>
                <label className="join-field"><span>PSiRA number <b className="join-optional">Optional</b></span><input name="psiraNumber" value={details.psiraNumber} onChange={(event) => updateDetail("psiraNumber", event.target.value)} maxLength={40} placeholder="Enter it if available" /></label>
                <label className="join-field"><span>Highest grade <b className="join-optional">Optional</b></span><select name="psiraGrade" value={details.psiraGrade} onChange={(event) => updateDetail("psiraGrade", event.target.value)}><option value="">Not applicable / unsure</option><option>Grade A</option><option>Grade B</option><option>Grade C</option><option>Grade D</option><option>Grade E</option></select></label>
              </div>
            </section>

            <div className="join-privacy-strip"><span>✓</span><p><strong>Keep sensitive documents out of this form.</strong> Identity, credential and banking checks happen only inside the secure onboarding flow.</p></div>
            {error && <p className="join-error" role="alert">{error}</p>}
          </div>}

          {step === 3 && <div className="join-fields"><div className="join-form-title"><span>YOUR DIRECTION</span><h2>What would you like to work toward?</h2></div><fieldset className="join-check-grid"><legend>Work categories you are interested in</legend>{serviceChoices.map((item) => <label key={item}><input type="checkbox" checked={services.includes(item)} onChange={() => toggle(item, services, setServices)} /><span><strong>{item}</strong><small>{item === "Unarmed" ? "Guarding, access and event work" : item === "Armed" ? "Separate firearm and assignment checks apply" : "Separate close-protection credentials apply"}</small></span><i>✓</i></label>)}</fieldset><fieldset className="join-check-grid join-training-grid"><legend>Work environments you want to prepare for</legend>{purposeChoices.map((item) => <label key={item}><input type="checkbox" checked={purposes.includes(item)} onChange={() => toggle(item, purposes, setPurposes)} /><span><strong>{item}</strong></span><i>✓</i></label>)}<div className="join-form-note" style={{ gridColumn: "1 / -1" }}><strong>Interest is not an endorsement.</strong><p>LOKD training, assessment and approval are required before a purpose is added to your live LOKD Passport or used to match offers.</p></div></fieldset>{pathway === "training" && <fieldset className="join-check-grid join-training-grid"><legend>Training information you need</legend>{trainingChoices.map((item) => <label key={item}><input type="checkbox" checked={training.includes(item)} onChange={() => toggle(item, training, setTraining)} /><span><strong>{item}</strong></span><i>✓</i></label>)}</fieldset>}<div className="join-consent-stack"><label className="join-consent"><input name="over18Confirmed" type="checkbox" required /><span>I confirm that I am at least 18 years old.</span></label><label className="join-consent"><input name="eligibilityAcknowledged" type="checkbox" required /><span>I understand that PSiRA registration and work eligibility remain subject to the applicable statutory, training and fit-and-proper requirements.</span></label><label className="join-consent"><input name="contactConsent" type="checkbox" required /><span>I agree that LOKD may store these details and contact me about officer onboarding or relevant training intake information. I understand that this is not an offer of employment or a guarantee of work.</span></label></div><label className="join-honeypot" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>{error && <p className="join-error" role="alert">{error}</p>}</div>}

          <div className="join-form-actions">{step > 1 && <button type="button" onClick={() => { setError(""); setStep(step - 1); }}>← Back</button>}<span />{step < 3 ? <button className="public-button public-button--dark" type="button" onClick={continueForm}>Continue →</button> : <button className="public-button public-button--lime" type="submit" disabled={busy}>{busy ? "Saving…" : pathway === "training" ? "Find my training pathway →" : "Submit officer application →"}</button>}</div>
        </form>
      </section>
      <footer className="join-footer">Qualification, registration, licensing and app approval are separate processes. LOKD verifies the requirements applicable to each work category.</footer>
    </main>
  );
}
