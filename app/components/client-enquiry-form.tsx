"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Receipt = { saved?: boolean; reference?: string; error?: string; confirmationEmailSent?: boolean; notificationStatus?: string };
const referencePattern = /^ENQ-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

export default function ClientEnquiryForm({ onSubmitted }: { onSubmitted?: (reference: string) => void } = {}) {
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [startDate, setStartDate] = useState("");
  const [today] = useState(() => new Date(Date.now() + 7200000).toISOString().slice(0, 10));
  const original = useRef<{ input: string; body: string } | null>(null);
  const inFlight = useRef(false);
  const success = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (receipt) success.current?.focus(); }, [receipt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

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
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    const endDate = value("endDate");
    if (endDate < value("startDate")) { setError("The end date must be on or after the start date."); return; }
    const digits = value("mobile").replace(/\D/g, "");
    if (!/^(0\d{9}|27\d{9})$/.test(digits)) { setError("Enter a South African phone number, starting with 0 or +27."); return; }
    const schedule = "Site address: " + value("siteAddress") + ". Dates: " + value("startDate") + " to " + endDate + ". Hours: " + value("startTime") + " to " + value("endTime") + " (South Africa time). Officers per shift: " + value("officers") + ". Schedule: " + value("schedule") + ".";
    const days = (Date.parse(value("startDate") + "T00:00:00+02:00") - Date.now()) / 86400000;
    const input = {
      organisationName: value("organisationName"), contactName: value("contactName"), email: value("email"), mobile: value("mobile"),
      siteArea: value("siteArea"), siteType: value("siteType"), serviceType: value("serviceType"),
      requiredStart: days <= 30 ? "within_30_days" : days <= 90 ? "one_to_three_months" : days <= 180 ? "three_to_six_months" : "planning",
      siteAddress: value("siteAddress"), startDate: value("startDate"), endDate, startTime: value("startTime"), endTime: value("endTime"),
      officers: Number(value("officers")), schedule: value("schedule"),
      message: schedule + "\n\n" + value("message"),
      advanceFundingAcknowledged: form.get("advanceFundingAcknowledged") === "on",
      privacyConsent: form.get("privacyConsent") === "on", company: value("company"),
    };
    const canonical = JSON.stringify(input);
    if (original.current?.input !== canonical) original.current = { input: canonical, body: JSON.stringify({ ...input, requestKey: crypto.randomUUID() }) };
    await send(original.current.body);
  }

  if (receipt) return <section className="public-form-success" aria-live="polite">
    <span className="public-success-mark" aria-hidden="true">✓</span><h2 ref={success} tabIndex={-1}>Your enquiry is with LOKD.</h2>
    <p>We will review your requirements and contact you about your quote. Keep your reference for any follow-up.</p>
    {receipt.confirmationEmailSent === true && <p>A confirmation has been sent to your email address.</p>}
    {receipt.confirmationEmailSent === false && <div className="public-retry"><p>Your enquiry is saved, but its emails have not been confirmed. You can retry delivery without submitting another enquiry.</p><button type="button" disabled={busy} onClick={() => { if (original.current) void send(original.current.body); }}>{busy ? "Checking delivery…" : "Retry email confirmation"}</button>{error && <p role="alert">{error}</p>}</div>}
    <dl><dt>Enquiry reference</dt><dd>{receipt.reference}</dd></dl>
    <p>Use the same email in the Client Zone to follow your enquiry. Your cover is confirmed after you agree the quote and service terms.</p>
    <Link className="public-button public-button--primary" href="/sign-in?return_to=%2Fclient">Track your enquiry</Link>
  </section>;

  return <form className="public-form" onSubmit={submit} aria-busy={busy}>
    <div><h2>Your security requirements</h2><p>All fields are required unless marked optional. Times are in South Africa time.</p></div>
    <fieldset disabled={busy || uncertain}><legend>1. Service and site</legend><div className="public-form-grid">
      <label className="public-field-full">Security service<select name="serviceType" required defaultValue=""><option value="" disabled>Select a service</option><option value="scheduled_unarmed_fixed_site">Unarmed guarding</option><option value="armed_static">Armed site security</option><option value="armed_movement">Armed movement protection</option><option value="vip_unarmed">VIP protection — unarmed</option><option value="vip_armed">VIP protection — armed</option><option value="vip_protective_driver">Protective driver</option><option value="vip_team">VIP protection team</option></select></label>
      <label>Site type<select name="siteType" required defaultValue=""><option value="" disabled>Select a site type</option><option value="commercial_property">Workplace / commercial property</option><option value="logistics_industrial">Logistics / industrial</option><option value="construction">Construction</option><option value="residential_estate">Residential property</option><option value="education">Education</option><option value="retail">Retail</option><option value="other">Event / other</option></select></label>
      <label>Suburb or area<input name="siteArea" minLength={2} maxLength={100} required autoComplete="address-level2" /></label>
      <label className="public-field-full">Site or venue address<input name="siteAddress" minLength={5} maxLength={200} required autoComplete="street-address" /></label>
    </div></fieldset>
    <fieldset disabled={busy || uncertain}><legend>2. Dates and cover</legend><div className="public-form-grid">
      <label>Start date<input name="startDate" type="date" required min={today} value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
      <label>End date<input name="endDate" type="date" required min={startDate || undefined} /></label>
      <label>Shift starts<input name="startTime" type="time" required /></label><label>Shift ends<input name="endTime" type="time" required /></label>
      <label>Officers per shift<input name="officers" type="number" min={1} max={100} step={1} required inputMode="numeric" /></label>
      <label>Schedule<select name="schedule" required defaultValue=""><option value="" disabled>Select a schedule</option><option>Single shift</option><option>Every day in this period</option><option>Weekdays in this period</option><option>Selected days — described below</option></select></label>
      <label className="public-field-full">What do you need covered?<textarea name="message" required minLength={20} maxLength={1400} aria-describedby="enquiry-brief-help" /><small id="enquiry-brief-help">Include duties, access points and any selected days. For overnight cover, the end time is on the following day.</small></label>
    </div></fieldset>
    <fieldset disabled={busy || uncertain}><legend>3. Your contact details</legend><div className="public-form-grid">
      <label>Organisation or household name<input name="organisationName" minLength={2} maxLength={120} required autoComplete="organization" /></label>
      <label>Contact name<input name="contactName" minLength={3} maxLength={100} required autoComplete="name" /></label>
      <label>Email address<input name="email" type="email" maxLength={120} required autoComplete="email" /></label>
      <label>Phone number<input name="mobile" type="tel" maxLength={24} required autoComplete="tel" /></label>
    </div></fieldset>
    <fieldset className="public-consents" disabled={busy || uncertain}><legend>Your agreement</legend>
      <label><input name="advanceFundingAcknowledged" type="checkbox" required /><span>I understand that cover is confirmed after LOKD reviews my request and we agree the quote and service terms.</span></label>
      <label><input name="privacyConsent" type="checkbox" required /><span>I agree that LOKD may use my details to respond to this enquiry, as described in the <Link href="/privacy">privacy notice</Link>.</span></label>
      <label className="public-honeypot" aria-hidden="true">Leave this field empty<input name="company" tabIndex={-1} autoComplete="off" /></label>
    </fieldset>
    {error && <p className="public-form-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
    {uncertain && <div className="public-retry"><p>Keep this page open. Retrying checks the same enquiry and avoids a duplicate.</p><button type="button" disabled={busy} onClick={() => { if (original.current) void send(original.current.body); }}>Retry original enquiry</button></div>}
    <button className="public-button public-button--primary" type="submit" disabled={busy || uncertain}>{busy ? "Sending your enquiry…" : "Get a quote"}</button>
  </form>;
}
