"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ClientEnquiryForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/enquiries", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        organisationName: form.get("organisationName"), contactName: form.get("contactName"),
        email: form.get("email"), mobile: form.get("mobile"), siteArea: form.get("siteArea"),
        siteType: form.get("siteType"), requiredStart: form.get("requiredStart"), message: form.get("message"),
        serviceType: form.get("serviceType"),
        advanceFundingAcknowledged: form.get("advanceFundingAcknowledged") === "on",
        privacyConsent: form.get("privacyConsent") === "on", company: form.get("company"),
      }) });
      const payload = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !payload.reference) throw new Error(payload.error ?? "We could not save your enquiry.");
      setReference(payload.reference);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We could not save your enquiry."); }
    finally { setBusy(false); }
  }

  if (reference) return <div className="enquiry-success" role="status"><span>✓</span><p className="public-kicker">Enquiry received</p><h2>We have your operating brief.</h2><p>LOKD will review service fit, risk, mobilisation, workforce capacity, pricing evidence and the required activation controls before making any commitment.</p><dl><dt>Reference</dt><dd>{reference}</dd></dl><Link className="public-button public-button--dark" href="/clients">Read the client guide <b>→</b></Link></div>;

  return <form className="enquiry-form" onSubmit={submit}>
    <header><span>CONTROLLED LAUNCH ENQUIRY</span><h2>Tell us about the site.</h2><p>This form opens a review only. It does not create a quote, booking, credit facility or deployment.</p></header>
    <div className="enquiry-form-grid"><label><span>Organisation</span><input name="organisationName" minLength={2} maxLength={120} required autoComplete="organization" /></label><label><span>Contact name</span><input name="contactName" minLength={3} maxLength={100} required autoComplete="name" /></label><label><span>Email</span><input name="email" type="email" maxLength={120} required autoComplete="email" /></label><label><span>Mobile <em>Optional</em></span><input name="mobile" type="tel" maxLength={24} autoComplete="tel" /></label><label><span>Site area</span><input name="siteArea" minLength={2} maxLength={100} required placeholder="e.g. Midrand" autoComplete="address-level2" /></label><label><span>Site type</span><select name="siteType" required defaultValue=""><option value="" disabled>Choose one</option><option value="commercial_property">Commercial property</option><option value="logistics_industrial">Logistics / industrial</option><option value="construction">Construction</option><option value="residential_estate">Residential estate</option><option value="education">Education</option><option value="retail">Retail</option><option value="other">Other</option></select></label><label className="enquiry-field--full"><span>Security service</span><select name="serviceType" required defaultValue="scheduled_unarmed_fixed_site"><option value="scheduled_unarmed_fixed_site">Scheduled Unarmed guarding</option><option value="armed_static">Armed static guarding</option><option value="armed_movement">Armed movement protection</option><option value="vip_unarmed">VIP protection · unarmed</option><option value="vip_armed">VIP protection · armed</option><option value="vip_protective_driver">Protective driver</option><option value="vip_team">Protective team</option></select></label><label className="enquiry-field--full"><span>Planning window</span><select name="requiredStart" required defaultValue=""><option value="" disabled>Choose one</option><option value="within_30_days">Within 30 days</option><option value="one_to_three_months">1–3 months</option><option value="three_to_six_months">3–6 months</option><option value="planning">Early planning</option></select></label><label className="enquiry-field--full"><span>What must the post achieve?</span><textarea name="message" minLength={20} maxLength={2000} required placeholder="Share the operating hours, access points, people or assets, known incidents and the outcome you need." /></label></div>
    <div className="enquiry-consents"><label><input name="advanceFundingAcknowledged" type="checkbox" required /><span>I understand that LOKD offers no credit terms and requires cleared advance funding before matching or deployment.</span></label><label><input name="privacyConsent" type="checkbox" required /><span>I agree that LOKD may store these details and contact me about this enquiry. I have read the <Link href="/privacy">privacy notice</Link>.</span></label></div>
    <label className="join-honeypot" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
    {error && <p className="join-error" role="alert">{error}</p>}
    <button className="public-button public-button--lime" disabled={busy} type="submit">{busy ? "Saving…" : "Submit site enquiry →"}</button>
  </form>;
}
