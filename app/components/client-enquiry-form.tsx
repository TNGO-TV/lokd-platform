"use client";

import Link from "next/link";
import BookingScheduleFields from "./booking-schedule-fields";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icons";

type Receipt = { saved?: boolean; reference?: string; error?: string; confirmationEmailSent?: boolean; notificationStatus?: string };
const referencePattern = /^ENQ-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
type CoverType = "" | "bolt" | "flex" | "fixed";
const steps = ["Choose your cover", "Service and site", "Your details"];
const coverLabels: Record<Exclude<CoverType, "">, string> = { bolt: "LOKD Bolt", flex: "LOKD Flex", fixed: "LOKD Fixed" };
const serviceLabels: Record<string, string> = { scheduled_unarmed_fixed_site: "Unarmed guarding", armed_static: "Armed security", vip_unarmed: "VIP protection" };
const shiftLabels: Record<string, string> = { day: "Day, 06:00–18:00", night: "Night, 18:00–06:00", both: "Day and night" };
type Summary = { officers: string; area: string; shift: string; term: string; requested: number };

export default function ClientEnquiryForm({ onSubmitted }: { onSubmitted?: (reference: string) => void } = {}) {
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [step, setStep] = useState(1);
  const [coverType, setCoverType] = useState<CoverType>("");
  const [serviceType, setServiceType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [summary, setSummary] = useState<Summary>({ officers: "1", area: "", shift: "day", term: "", requested: 0 });
  const [clock] = useState(() => Date.now());
  const today = new Date(clock + 7200000).toISOString().slice(0, 10);
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
      const model=params.get("model"); if(model && ["bolt","flex","fixed"].includes(model))setCoverType(model as CoverType);
      const when = params.get("when");
      if (when === "today" || when === "tomorrow") {
        setCoverType("bolt");
        setStartDate(new Date(Date.now() + 7200000 + (when === "tomorrow" ? 86400000 : 0)).toISOString().slice(0, 10));
      }
      if (when === "date") setCoverType("flex");
      if (when === "ongoing") setCoverType("fixed");
      // Homepage sentence builder: officers and area carry into step two.
      const elements = formRef.current?.elements;
      const requested = Math.trunc(Number(params.get("officers")));
      const officers = elements?.namedItem("officers");
      let requestedLarger = 0;
      if (Number.isFinite(requested) && requested >= 1 && requested <= 20 && officers instanceof HTMLInputElement) {
        const limit = service === "vip_unarmed" ? 4 : 6;
        officers.value = String(Math.min(requested, limit));
        if (requested > limit) requestedLarger = requested;
      }
      const area = (params.get("area") ?? "").trim().slice(0, 100);
      const siteArea = elements?.namedItem("siteArea");
      if (area.length >= 2 && siteArea instanceof HTMLInputElement) siteArea.value = area;
      if (formRef.current) readSummary(formRef.current, requestedLarger);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => { if (receipt) success.current?.focus(); }, [receipt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);

  function readSummary(form: HTMLFormElement, requested?: number) {
    const field = (name: string) => { const element = form.elements.namedItem(name); return element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement ? element.value.trim() : ""; };
    setSummary(current => ({ officers: field("officers"), area: field("siteArea"), shift: field("shift"), term: field("term"), requested: requested ?? current.requested }));
  }

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
      booking: { coverType, startDate, shift: value("shift"), officers: Number(value("officers")), term: coverType === "fixed" ? value("term") : coverType === "flex" ? "calendar_month" : "single", durationWeeks:0,endDate:coverType === "flex"?value("endDate"):undefined,includePublicHolidays:form.get("includePublicHolidays")==="on",rosterPattern:value("rosterPattern") },
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
    <Link className="public-button public-button--primary" href="/sign-in?return_to=%2Fclient">Track your enquiry</Link>
  </section>;

  const locked = busy || uncertain;
  const chooseCover = (value: CoverType) => { setCoverType(value); if (value === "bolt") setStartDate(today); };
  return <form ref={formRef} className="public-form booking-flow" onSubmit={submit} onChange={event => readSummary(event.currentTarget)} aria-busy={busy}>
    <div><h2 ref={stepHeading} tabIndex={-1}>{steps[step - 1]}</h2><p>Step {step} of 3. LOKD Operations reviews your request and confirms availability.</p></div>
    <ol className="booking-steps" aria-label="Booking progress">{steps.map((title, index) => <li key={title} aria-current={step === index + 1 ? "step" : undefined} data-done={step > index + 1 ? "" : undefined}><span>{index + 1}</span>{title}</li>)}</ol>
    <fieldset data-booking-step="1" hidden={step !== 1} disabled={locked}><legend>1. Choose your LOKD service</legend>
      <div className="booking-cover-options">{([
        ["bolt", "LOKD Bolt", "Immediate / emergency service", "Less than 72 hours’ notice", "clock"],
        ["flex", "LOKD Flex", "Temporary / flexible service", "7+ days in a calendar month", "calendar"],
        ["fixed", "LOKD Fixed", "Ongoing deployment", "3 months or more", "users"],
      ] as const).map(([value, label, model, description, icon]) => <label className="booking-cover-option" key={value}><input type="radio" name="coverType" value={value} checked={coverType === value} onChange={() => chooseCover(value)} required={step === 1} /><span><Icon name={icon} size={24} /><strong>{label}</strong><em>{model}</em><small>{description}</small></span></label>)}</div>
      <div className="public-form-grid booking-date-fields">
        {coverType && <label>Start date<input name="startDate" type="date" required={step === 1} min={today} max={coverType==='bolt'?new Date(clock+7200000+72*3600000).toISOString().slice(0,10):undefined} value={startDate} onChange={event => setStartDate(event.target.value)}/></label>}
        {coverType === 'flex' && <label>Service end date<input name="endDate" type="date" min={startDate||today} required={step===1}/></label>}
        {coverType === "fixed" && <><label>Contract term<select name="term" required={step === 1} defaultValue=""><option value="" disabled>Choose a term</option>{[3, 6, 12].map(months => <option value={months} key={months}>{months} {months === 1 ? "month" : "months"}</option>)}</select></label></>}
      </div>
    </fieldset>
    <fieldset data-booking-step="2" hidden={step !== 2} disabled={locked}><legend>2. Service and site</legend><div className="public-form-grid">
      <label className="public-field-full">Security service<select name="serviceType" required={step === 2} defaultValue="" onChange={event => setServiceType(event.target.value)}><option value="" disabled>Select a service</option><option value="scheduled_unarmed_fixed_site">Unarmed guarding</option><option value="armed_static">Armed security</option><option value="vip_unarmed">VIP protection</option></select></label>
      <label>Number of officers<input name="officers" type="number" min={1} max={serviceType === "vip_unarmed" ? 4 : 6} step={1} required={step === 2} inputMode="numeric" defaultValue={1} /></label>
      <BookingScheduleFields year={Number((startDate||today).slice(0,4))}/>
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
    <div className="booking-actions">{step > 1 && <button className="booking-back" type="button" disabled={locked} onClick={() => { setError(""); setStep(step - 1); }}>Back</button>}{step < 3 ? <button className="public-button public-button--primary" type="button" disabled={locked} onClick={advance}>Continue</button> : <button className="public-button public-button--primary" type="submit" disabled={locked}>{busy ? "Sending your request…" : "Request cover"}</button>}</div>
    <aside className="booking-summary" aria-label="Your booking so far">
      <h2>Your booking</h2>
      <dl>{([
        ["Cover", coverType ? coverLabels[coverType] : ""], ["Start", startDate], ["Term", coverType === "fixed" && summary.term ? summary.term + " months" : ""],
        ["Service", serviceLabels[serviceType] ?? ""], ["Officers", summary.officers], ["Shift", shiftLabels[summary.shift] ?? ""], ["Area", summary.area],
      ] as const).filter(([label, value]) => label !== "Term" || value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd data-empty={value ? undefined : ""}>{value || "Not chosen yet"}</dd></div>)}</dl>
      {summary.requested > 0 && <p className="booking-help booking-help--alert" role="status">You asked for {summary.requested} officers. An online request covers up to {serviceType === "vip_unarmed" ? 4 : 6}; for a larger team, contact <a href="mailto:bookings@lokd.co.za">bookings@lokd.co.za</a> and we will plan it with you.</p>}
      <p>PSIRA-verified officers. Operations confirms officers and price before cover starts.</p>
    </aside>
  </form>;
}
