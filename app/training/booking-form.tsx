"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../components/icons";
import { currentIntakeMonth, trainingCourse, trainingCourses, trainingIdStatuses, trainingPsiraStatuses } from "../lib/training-courses";

export default function TrainingBookingForm() {
  const search = useSearchParams();
  const course = trainingCourse(search.get("course"))?.id ?? "";
  return <BookingForm key={course} initialCourse={course} />;
}

function BookingForm({ initialCourse }: { initialCourse: string }) {
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false), [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ reference: string; confirmationEmailSent: boolean } | null>(null);
  const lock = useRef(false), original = useRef<{ input: string; body: string } | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null), successRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (receipt) successRef.current?.focus(); }, [receipt]);

  async function send(body: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/training", { method: "POST", headers: { "content-type": "application/json" }, body, signal: AbortSignal.timeout(45000) });
      if (response.status >= 500) setUncertain(true);
      const result = await response.json() as { saved?: boolean; reference?: string; error?: string; confirmationEmailSent?: boolean };
      if (!response.ok) {
        if (response.status < 500) setUncertain(false);
        throw new Error(typeof result?.error === "string" ? result.error : "We could not save your training request. Please try again.");
      }
      if (result?.saved !== true || typeof result.reference !== "string" || !/^TRN-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(result.reference)) {
        setUncertain(true); throw new Error("We could not confirm your request. Retry the original request below to check its status.");
      }
      setUncertain(false); setReceipt({ reference: result.reference, confirmationEmailSent: result.confirmationEmailSent === true });
    } catch (cause) {
      if (!(cause instanceof Error) || cause instanceof TypeError || cause instanceof SyntaxError || cause.name === "TimeoutError" || cause.name === "AbortError") setUncertain(true);
      setError(cause instanceof Error && !["TimeoutError", "AbortError"].includes(cause.name) ? cause.message : "The connection timed out. Retry the original request to check whether it was saved.");
    } finally { lock.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current || uncertain) return;
    const data = new FormData(event.currentTarget), value = (key: string) => String(data.get(key) ?? "").trim();
    if (!/^(0\d{9}|27\d{9})$/.test(value("mobile").replace(/\D/g, ""))) { setError("Enter a South African mobile number, starting with 0 or +27."); return; }
    const input = { course: value("course"), preferredIntakeMonth: value("preferredIntakeMonth"), fullName: value("fullName"), mobile: value("mobile"), email: value("email"), idStatus: value("idStatus"), psiraStatus: value("psiraStatus"), consent: data.get("consent") === "on", company: value("company") };
    const canonical = JSON.stringify(input);
    if (original.current?.input !== canonical) original.current = { input: canonical, body: JSON.stringify({ ...input, requestKey: crypto.randomUUID() }) };
    await send(original.current.body);
  }

  if (receipt) return <div className="public-form-success" aria-live="polite"><Icon name="circleCheck" size={36} /><h2 ref={successRef} tabIndex={-1}>Your training request is with LOKD.</h2><p>Our training team will contact you to confirm the course requirements and available intake dates. Your place is confirmed when the team confirms your booking.</p><dl><dt>Training reference</dt><dd>{receipt.reference}</dd></dl><p>{receipt.confirmationEmailSent ? "A confirmation has been sent to your email address." : "Keep this reference. If a confirmation email does not arrive, contact training@lokd.co.za."}</p><a className="public-text-link" href="mailto:training@lokd.co.za">Contact the training team</a></div>;
  return <form className="public-form" onSubmit={submit} aria-busy={busy}>
    <div><p className="public-kicker">Your next step</p><h2>Book a training place</h2><p>Tell us what you want to study and when. All fields are required. Do not send identity documents through this form.</p></div>
    <fieldset disabled={busy || uncertain}><legend>Course and intake</legend><div className="public-form-grid"><label>Course<select name="course" required defaultValue={initialCourse}><option value="">Choose a course</option>{trainingCourses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select></label><label>Preferred intake month<input type="month" name="preferredIntakeMonth" required min={currentIntakeMonth()} /></label></div><p className="public-note">Your preferred month helps us plan your intake. The team will confirm the dates and entry requirements.</p></fieldset>
    <fieldset disabled={busy || uncertain}><legend>Your contact details</legend><div className="public-form-grid"><label className="public-field-full">Full name<input name="fullName" required minLength={3} maxLength={100} autoComplete="name" /></label><label>Mobile number<input name="mobile" type="tel" required maxLength={24} autoComplete="tel" /></label><label>Email address<input name="email" type="email" required maxLength={120} autoComplete="email" /></label></div></fieldset>
    <fieldset disabled={busy || uncertain}><legend>Identity and registration</legend><div className="public-form-grid"><label>Identity document status<select name="idStatus" required defaultValue=""><option value="">Choose your ID status</option>{trainingIdStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>PSIRA registration status<select name="psiraStatus" required defaultValue=""><option value="">Choose your PSIRA status</option>{trainingPsiraStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div></fieldset>
    <fieldset className="public-consents" disabled={busy || uncertain}><legend>Your consent</legend><label><input type="checkbox" name="consent" required /><span>I agree that LOKD may process these details and contact me about my training request under the <Link href="/privacy">privacy notice</Link>.</span></label><label className="public-honeypot" aria-hidden="true">Leave this field empty<input name="company" tabIndex={-1} autoComplete="off" /></label></fieldset>
    {error && <p className="public-form-error" role="alert" ref={errorRef} tabIndex={-1}>{error}</p>}
    {uncertain && <div className="public-retry"><p>Keep this page open. Retrying checks the same request and avoids a duplicate.</p><button type="button" disabled={busy} onClick={() => { if (original.current) void send(original.current.body); }}>Retry original training request</button></div>}
    <button className="public-button public-button--primary" type="submit" disabled={busy || uncertain}>{busy ? "Sending your request…" : "Send booking request"}</button>
  </form>;
}
