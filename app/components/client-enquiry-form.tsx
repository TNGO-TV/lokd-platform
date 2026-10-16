"use client";

import SandboxCommandRecovery from './sandbox-command-recovery';
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

const record=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
export default function ClientEnquiryForm({sandbox=false,onSubmitted,onAccessLost}:{sandbox?:boolean;onSubmitted?:(reference:string)=>void;onAccessLost?:()=>void}) {
  const [uncertain,setUncertain]=useState(false);
  const originalSandboxBody=useRef<string|null>(null);
  const originalPublicBody=useRef<string|null>(null),publicInput=useRef<string|null>(null),inFlight=useRef(false);
  const successRef = useRef<HTMLHeadingElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => { if (reference) successRef.current?.focus(); }, [reference]);

  async function sendBody(body:string) {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError("");
    try {
      const response=await fetch(sandbox?'/api/sandbox/application':'/api/enquiries',{method:'POST',headers:{'content-type':'application/json'},body});
      if(sandbox&&[401,403].includes(response.status))onAccessLost?.();
      if(response.status>=500||sandbox&&response.status===202)setUncertain(true);
      const raw:unknown=await response.json();const result=record(raw)?raw:null;
      if(!response.ok){
        if(response.status<500)setUncertain(false);
        throw Error(typeof result?.error==='string'?result.error:'The enquiry could not be confirmed. Keep this tab and retry the original request.');
      }
      if(sandbox&&(result?.mode!=='sandbox'||result?.policyVersion!=='lokd-sandbox-completion-v1'||result?.productionWorkEligible!==false)){
        setUncertain(true);throw Error('The isolated enquiry boundary could not be verified.');
      }
      const payload=sandbox?result?.data:result;
      if(!record(payload)||payload.saved!==true||typeof payload.reference!=='string'||!/^ENQ-[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/.test(payload.reference)){
        setUncertain(true);throw Error('A saved enquiry could not be confirmed. Keep this tab and recover the original receipt before submitting again.');
      }
      setUncertain(false);setReference(payload.reference);onSubmitted?.(payload.reference);
    }catch(cause){
      if(cause instanceof TypeError||cause instanceof SyntaxError)setUncertain(true);
      setError(cause instanceof Error?cause.message:'The enquiry could not be confirmed. Keep this tab and retry the original request.');
    }finally{inFlight.current=false;setBusy(false);}
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(inFlight.current||uncertain)return;
    const form=new FormData(event.currentTarget);
    const input={
      organisationName:form.get('organisationName'),contactName:form.get('contactName'),
      email:form.get('email'),mobile:form.get('mobile'),siteArea:form.get('siteArea'),
      siteType:form.get('siteType'),requiredStart:form.get('requiredStart'),message:form.get('message'),
      serviceType:form.get('serviceType'),advanceFundingAcknowledged:form.get('advanceFundingAcknowledged')==='on',
      privacyConsent:form.get('privacyConsent')==='on',company:form.get('company'),
    };
    const canonical=JSON.stringify(input);
    const body=!sandbox&&publicInput.current===canonical&&originalPublicBody.current?originalPublicBody.current:JSON.stringify(sandbox?{service:'client_enquiry',input,requestKey:crypto.randomUUID()}:{...input,requestKey:crypto.randomUUID()});
    if(sandbox)originalSandboxBody.current=body;else {originalPublicBody.current=body;publicInput.current=canonical;}
    await sendBody(body);
  }

  if(sandbox&&reference)return <section><h3 ref={successRef} tabIndex={-1}>Fictional client enquiry saved</h3><p>Reference: {reference}</p><p>Link this source to the same signed-in synthetic account below. No real contact or service was initiated.</p></section>;
  if (reference) return <div className="enquiry-success" role="status"><span>✓</span><p className="public-kicker">Enquiry received</p><h2 ref={successRef} tabIndex={-1}>We have your operating brief.</h2><p>LOKD will review service fit, risk, mobilisation, workforce capacity, pricing evidence and the required activation controls before making any commitment.</p><div className="journey-next"><h3>Awaiting Operations review</h3><p>Keep your reference. Operations needs to confirm your organisation, authority to request the service, site requirements and a suitable plan before a quote can be accepted.</p><p>Sign in to the Client portal using the same email, then link this enquiry to your account to follow progress and send corrections.</p><h3>Agreements still required</h3><p>Operations must prepare approved terms and a service order for your authorised representative. When a quote or agreement is issued to your account, review it in Agreements in the Client portal. Submitting this form signs no service agreement.</p><p>Do not pay against this enquiry reference. Payment instructions follow a confirmed service plan; remaining checks are completed before service activation.</p></div><dl><dt>Reference</dt><dd>{reference}</dd></dl><a className="public-button public-button--dark" href="https://portal.lokd.co.za">Track my enquiry <b>→</b></a><Link href="/clients">Read the client guide</Link></div>;

  return <form className="enquiry-form" onSubmit={submit}>
    <header><span>SECURITY ENQUIRY</span><h2>Tell us about the site.</h2><p>Share your requirements for assessment. We will confirm the scope, quote and next steps before a booking is made.</p></header>
    <fieldset disabled={busy||uncertain} className="enquiry-inputs">
    <div className="enquiry-form-grid"><label><span>Organisation</span><input name="organisationName" minLength={2} maxLength={120} required autoComplete="organization" /></label><label><span>Contact name</span><input name="contactName" minLength={3} maxLength={100} required autoComplete="name" /></label><label><span>Email</span><input name="email" type="email" maxLength={120} required autoComplete="email" /></label><label><span>Mobile <em>Optional</em></span><input name="mobile" type="tel" maxLength={24} autoComplete="tel" /></label><label><span>Site area</span><input name="siteArea" minLength={2} maxLength={100} required placeholder="e.g. Midrand" autoComplete="address-level2" /></label><label><span>Site type</span><select name="siteType" required defaultValue=""><option value="" disabled>Choose one</option><option value="commercial_property">Commercial property</option><option value="logistics_industrial">Logistics / industrial</option><option value="construction">Construction</option><option value="residential_estate">Residential estate</option><option value="education">Education</option><option value="retail">Retail</option><option value="other">Other</option></select></label><label className="enquiry-field--full"><span>Security service</span><select name="serviceType" required defaultValue="scheduled_unarmed_fixed_site"><option value="scheduled_unarmed_fixed_site">Scheduled Unarmed guarding</option><option value="armed_static">Armed static guarding</option><option value="armed_movement">Armed movement protection</option><option value="vip_unarmed">VIP protection · unarmed</option><option value="vip_armed">VIP protection · armed</option><option value="vip_protective_driver">Protective driver</option><option value="vip_team">Protective team</option></select></label><label className="enquiry-field--full"><span>Planning window</span><select name="requiredStart" required defaultValue=""><option value="" disabled>Choose one</option><option value="within_30_days">Within 30 days</option><option value="one_to_three_months">1–3 months</option><option value="three_to_six_months">3–6 months</option><option value="planning">Early planning</option></select></label><label className="enquiry-field--full"><span>What must the post achieve?</span><textarea name="message" minLength={20} maxLength={2000} required placeholder="Share the operating hours, access points, people or assets, known incidents and the outcome you need." /></label></div>
    <div className="enquiry-consents"><label><input name="advanceFundingAcknowledged" type="checkbox" required /><span>I understand that submitting this enquiry does not confirm service, and that Operations must review fit and commercial terms before any commitment.</span></label><label><input name="privacyConsent" type="checkbox" required /><span>I agree that LOKD may store these details and contact me about this enquiry. I have read the <Link href="/privacy">privacy notice</Link>.</span></label></div>
    <label className="join-honeypot" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
    </fieldset>
    {uncertain&&!sandbox&&<div role="status"><p>Your enquiry outcome is unconfirmed. Keep this tab. Retry the original request to recover its saved reference without creating a second enquiry.</p><button type="button" disabled={busy} onClick={()=>{if(originalPublicBody.current)void sendBody(originalPublicBody.current);}}>Retry original enquiry</button></div>}
    {uncertain&&sandbox&&<SandboxCommandRecovery scope='client_enquiry' endpoint='/api/sandbox/application' getBody={()=>originalSandboxBody.current} onRejected={()=>{originalSandboxBody.current=null;setUncertain(false);setError('The original request was rejected before any source write. Review and correct your details before submitting a new request.');}} onDenied={()=>{originalSandboxBody.current=null;onAccessLost?.();}} onRecovered={result=>{if(result.saved===true&&typeof result.reference==='string'&&/^ENQ-[0-9A-F-]{36}$/.test(result.reference)){setReference(result.reference);setUncertain(false);setError('');onSubmitted?.(result.reference);}}}/>}{uncertain&&sandbox&&<p role="alert">The original sandbox enquiry outcome is unconfirmed. Keep this tab and recover the source before another submission.</p>}{error && <p className="join-error" role="alert">{error}</p>}
    <button className="public-button public-button--lime" disabled={busy||uncertain} type="submit">{busy ? "Saving…" : "Submit site enquiry →"}</button>
  </form>;
}
