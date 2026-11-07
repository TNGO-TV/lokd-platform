"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

type Receipt = { saved?: boolean; reference?: string; error?: string; confirmationEmailSent?: boolean; notificationStatus?: string };
const referencePattern = /^ENQ-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
type CoverType = "" | "soon" | "date" | "ongoing";
const steps = ["How you need cover", "Service and site", "Your details"];

export default function ClientEnquiryForm({ onSubmitted }: { onSubmitted?: (reference: string) => void } = {}) {
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [step, setStep] = useState(1);
  const [coverType, setCoverType] = useState<CoverType>("");
  const [serviceType, setServiceType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [clock] = useState(() => Date.now());
  const today = new Date(clock + 7200000).toISOString().slice(0, 10);
  const tomorrow = new Date(clock + 7200000 + 86400000).toISOString().slice(0, 10);
  const original = useRef<{ input: string; body: string } | null>(null);
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    const timer = setTimeout(() => {
      // Preserve the homepage shortcuts from wip/on-demand-homepage, including SAST dates.
      const params = new URLSearchParams(window.location.search);
      const service = params.get("service");
      const select = formRef.current?.elements.namedItem("serviceType");
      if (service && select instanceof HTMLSelectElement && [...select.options].some(option => option.value === service)) {
        select.value = service;
        setServiceType(service);
      }
      const when = params.get("when");
      if (when === "today" || when === "tomorrow") {
        setCoverType("soon");
        setStartDate(new Date(Date.now() + 7200000 + (when === "tomorrow" ? 86400000 : 0)).toISOString().slice(0, 10));
      }
      if (when === "ongoing") setCoverType("ongoing");
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { if (receipt) success.current?.focus(); }, [receipt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);

  function advance(event?: { preventDefault(): void }) {
    // Continue becomes the submit button when this update reveals step three.
    event?.preventDefault();
    const fields = formRef.current?.querySelectorAll(`fieldset[data-booking-step="${step}"] input, fieldset[data-booking-step="${step}"] select, fieldset[data-booking-step="${step}"] textarea`);
    if (fields) for (const field of fields) if ("reportValidity" in field && typeof field.reportValidity === "function" && !field.reportValidity()) return;
    setError(""); setStep(Math.min(3, step + 1));
  }

  async function send(body: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/enquiries", { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(45000) });
      if (response.status >= 500) setUncertain(true);
      const result: Receipt = await response.json();
      if (!response.ok) {
        if (response.status < 500) setUncertain(false);
        throw new Error(typeof result?.error === "string" ? result.error : "We could not save your enquiry. Please try again.");
      }
      if (result?.saved !== true || typeof result.reference !== "string" || !referencePattern.test(result.reference)) {
        setUncertain(true);
        throw new Error("We could not confirm your enquiry. Retry the original request below to check its status.");
      }
      setUncertain(false); setReceipt(result); onSubmitted?.(result.reference);
    } catch (cause) {
      if (!(cause instanceof Error) || cause instanceof TypeError || cause instanceof SyntaxError || cause.name === "TimeoutError" || cause.name === "AbortError") setUncertain(true);
      setError(cause instanceof Error && !["TimeoutError", "AbortError"].includes(cause.name) ? cause.message : "The connection timed out. Retry the original enquiry to check whether it was saved.");
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || uncertain) return;
    if (step < 3) { advance(); return; }
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    if (!/^(0\d{9}|27\d{9})$/.test(value("mobile").replace(/\D/g, ""))) {
      setError("Enter a South African phone number, starting with 0 or +27."); return;
    }
    const input = {
      organisationName: value("organisationName"), contactName: value("contactName"), email: value("email"), mobile: value("mobile"),
      siteArea: value("siteArea"), siteType: value("siteType"), serviceType: value("serviceType"), siteAddress: value("siteAddress"), message: value("message"),
      booking: { coverType, startDate, shift: value("shift"), officers: Number(value("officers")), term: coverType === "ongoing" ? value("term") : "single", rosterPattern: coverType === "ongoing" ? value("rosterPattern") : "daily" },
      advanceFundingAcknowledged: form.get("advanceFundingAcknowledged") === "on",
      privacyConsent: form.get("privacyConsent") === "on", company: value("company"),
    };
    const canonical = JSON.stringify(input);
    if (original.current?.input !== canonical) original.current = { input: canonical, body: JSON.stringify({ ...input, requestKey: crypto.randomUUID() }) };
    await send(original.current.body);
  }

  if (receipt) return <section className="public-form-success booking-success" aria-live="polite">
    <Icon name="circleCheck" size={40} /><h2 ref={success} tabIndex={-1}>Your enquiry is with LOKD.</h2>
    <p>Your booking request is saved. LOKD Operations will confirm the officers and the price with you. This request does not confirm cover.</p>
    {receipt.confirmationEmailSent === true && <p>A confirmation has been sent to your email address.</p>}
    {receipt.confirmationEmailSent === false && <div className="public-retry"><p>Your request is saved, but its emails have not been confirmed. You can check delivery without submitting another request.</p><button type="button" disabled={busy} onClick={() => { if (original.current) void send(original.current.body); }}>{busy ? "Checking delivery…" : "Retry email confirmation"}</button>{error && <p role="alert">{error}</p>}</div>}
    <dl><dt>Enquiry reference</dt><dd>{receipt.reference}</dd></dl>
    <p>Use the same email in the Client Zone to follow your request. Cover is confirmed only after you and LOKD agree the service details and price.</p>
    <Link className="public-button public-button--primary" href="/sign-in?return_to=%2Fclient">Track your enquiry <Icon name="arrowUpRight" size={20} /></Link>
  </section>;

  const locked = busy || uncertain;
  const chooseCover = (value: CoverType) => { setCoverType(value); if (value === "soon") setStartDate(today); };
  return <form ref={formRef} className="public-form booking-flow" onSubmit={submit} aria-busy={busy}>
    <div><p className="public-kicker">Your booking request</p><h2 ref={stepHeading} tabIndex={-1}>{steps[step - 1]}</h2><p>Step {step} of 3. Operations will review your request and confirm availability.</p></div>
    <ol className="booking-steps" aria-label="Booking progress">{steps.map((title, index) => <li key={title} aria-current={step === index + 1 ? "step" : undefined}><span>{index + 1}</span>{title}</li>)}</ol>
    <fieldset data-booking-step="1" hidden={step !== 1} disabled={locked}><legend>1. Choose how you need cover</legend>
      <div className="booking-cover-options">{([
        ["soon", "Today / tomorrow", "LOKD Flex", "Short-notice cover for a single shift.", "clock"],
        ["date", "A specific date", "LOKD Flex", "Plan a single shift for a date that suits you.", "calendar"],
        ["ongoing", "Ongoing cover", "LOKD Fixed", "A planned roster for 1, 3, 6 or 12 months.", "users"],
      ] as const).map(([value, label, model, description, icon]) => <label className="booking-cover-option" key={value}><input type="radio" name="coverType" value={value} checked={coverType === value} onChange={() => chooseCover(value)} required={step === 1} /><span><Icon name={icon} size={24} /><strong>{label}</strong><em>{model}</em><small>{description}</small></span></label>)}</div>
      <div className="public-form-grid booking-date-fields">
        {coverType === "soon" ? <label>When do you need cover?<select name="when" value={startDate === tomorrow ? "tomorrow" : "today"} onChange={event => setStartDate(event.target.value === "tomorrow" ? tomorrow : today)}><option value="today">Today</option><option value="tomorrow">Tomorrow</option></select></label>
          : coverType && <label>Start date<input name="startDate" type="date" required={step === 1} min={today} value={startDate} onChange={event => setStartDate(event.target.value)} /></label>}
        {coverType === "ongoing" && <><label>Contract term<select name="term" required={step === 1} defaultValue=""><option value="" disabled>Choose a term</option>{[1, 3, 6, 12].map(months => <option value={months} key={months}>{months} {months === 1 ? "month" : "months"}</option>)}</select></label><label>Roster<select name="rosterPattern" required={step === 1} defaultValue=""><option value="" disabled>Choose a roster</option><option value="weekdays">Weekdays (Monday–Friday)</option><option value="monday_saturday">Mon–Sat</option><option value="daily">Daily</option></select></label></>}
      </div>
    </fieldset>
    <fieldset data-booking-step="2" hidden={step !== 2} disabled={locked}><legend>2. Service and site</legend><div className="public-form-grid">
      <label className="public-field-full">Security service<select name="serviceType" required={step === 2} defaultValue="" onChange={event => setServiceType(event.target.value)}><option value="" disabled>Select a service</option><option value="scheduled_unarmed_fixed_site">Unarmed guarding</option><option value="armed_static">Armed security</option><option value="vip_unarmed">VIP protection</option></select></label>
      <label>Number of officers<input name="officers" type="number" min={1} max={serviceType === "vip_unarmed" ? 4 : 6} step={1} required={step === 2} inputMode="numeric" defaultValue={1} /></label>
      <label>Shift<select name="shift" required={step === 2} defaultValue="" aria-describedby="booking-shift-help"><option value="" disabled>Choose a shift</option><option value="day" disabled={!!startDate && Date.parse(startDate + "T06:00:00+02:00") <= clock}>Day · 06:00–18:00 SAST</option><option value="night" disabled={!!startDate && Date.parse(startDate + "T18:00:00+02:00") <= clock}>Night · 18:00–06:00 SAST</option></select><small id="booking-shift-help">Each shift is 12 hours. Night shifts end the following morning. Choose a shift that has not started.</small></label>
      <label>Site type<select name="siteType" required={step === 2} defaultValue=""><option value="" disabled>Select a site type</option><option value="commercial_property">Workplace / commercial property</option><option value="logistics_industrial">Logistics / industrial</option><option value="construction">Construction</option><option value="residential_estate">Residential property</option><option value="education">Education</option><option value="retail">Retail</option><option value="other">Event / other</option></select></label>
      <label>Suburb or area<input name="siteArea" minLength={2} maxLength={100} required={step === 2} autoComplete="address-level2" /></label>
      <label className="public-field-full">Site or venue address<input name="siteAddress" minLength={5} maxLength={200} required={step === 2} autoComplete="street-address" /></label>
      <label className="public-field-full">Site instructions (optional)<textarea name="message" maxLength={1400} rows={4} /><small>Include access arrangements, duties and information Operations should review.</small></label>
    </div><p className="booking-help">For a larger team, contact <a href="mailto:bookings@lokd.co.za">bookings@lokd.co.za</a>.</p></fieldset>
    <fieldset data-booking-step="3" hidden={step !== 3} disabled={locked}><legend>3. Your contact details</legend><div className="public-form-grid">
      <label>Organisation or household name<input name="organisationName" minLength={2} maxLength={120} required={step === 3} autoComplete="organization" /></label>
      <label>Contact name<input name="contactName" minLength={3} maxLength={100} required={step === 3} autoComplete="name" /></label>
      <label>Email address<input name="email" type="email" maxLength={120} required={step === 3} autoComplete="email" /></label>
      <label>Phone number<input name="mobile" type="tel" maxLength={24} required={step === 3} autoComplete="tel" /></label>
    </div><div className="public-consents booking-consents">
      <label><input name="advanceFundingAcknowledged" type="checkbox" required={step === 3} /><span>I understand that LOKD Operations will confirm the officers and the price. Sending this request does not confirm cover.</span></label>
      <label><input name="privacyConsent" type="checkbox" required={step === 3} /><span>I agree that LOKD may use my details to respond to this request, as described in the <Link href="/privacy">privacy notice</Link>.</span></label>
      <label className="public-honeypot" aria-hidden="true">Leave this field empty<input name="company" tabIndex={-1} autoComplete="off" /></label>
    </div></fieldset>
    {error && <p className="public-form-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
    {uncertain && <div className="public-retry"><p>Keep this page open. Retrying checks the same request and avoids a duplicate.</p><button type="button" disabled={busy} onClick={() => { if (original.current) void send(original.current.body); }}>Retry original enquiry</button></div>}
    <div className="booking-actions">{step > 1 && <button className="booking-back" type="button" disabled={locked} onClick={() => { setError(""); setStep(step - 1); }}>Back</button>}{step < 3 ? <button className="public-button public-button--primary" type="button" disabled={locked} onClick={advance}>Continue <Icon name="arrowUpRight" size={18} /></button> : <button className="public-button public-button--primary" type="submit" disabled={locked}>{busy ? "Sending your request…" : "Request cover"}</button>}</div>
  </form>;
}
