"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { calendarPriceBook, requiredSpecialistChecks, specialistRateCard, specialistTerms } from "../lib/specialist-operations-core";
import { specialistProfiles, type SpecialistServiceCode } from "../lib/specialist-pricing";
import type { SpecialistAction, SpecialistBooking, SpecialistOperationsState, SpecialistPack, SpecialistPackContent } from "../lib/specialist-operations-types";

import { readWorkspaceResponse, workspaceAccessDenied } from "./workspace-request";

const money=(cents:number)=>new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(cents/100);
const day=(iso:string)=>new Date(Date.parse(iso)+2*3600000).toISOString().slice(0,10);
const fromDay=(value:string,end=false)=>value?new Date(`${value}T${end?"23:59:59":"00:00:00"}+02:00`).toISOString():"";
type Tab="packs"|"rates"|"partners"|"rehearsals";
type Run=(action:SpecialistAction)=>Promise<boolean>;

export function SpecialistOperationsControl({initialTab="packs",sandbox=false}:{initialTab?:Tab;sandbox?:boolean}) {
  const lock=useRef(false), dirty=useRef(false);
  const [uncertain,setUncertain]=useState(false),[denied,setDenied]=useState(false),[generation,setGeneration]=useState(0);
  const [state,setState]=useState<SpecialistOperationsState|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[tab,setTab]=useState<Tab>(initialTab),[selected,setSelected]=useState("");
  const request=useCallback(async(action?:SpecialistAction,signal?:AbortSignal)=>{
    const response=await fetch(sandbox?'/api/sandbox/application':'/api/specialist?scope=operations',sandbox?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({service:'specialist',input:action??{action:'read'}}),signal}:{cache:'no-store',signal,...(action?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(action)}:{})});
    const payload=await readWorkspaceResponse<{state?:SpecialistOperationsState;data?:SpecialistOperationsState;mode?:string;policyVersion?:string;productionWorkEligible?:boolean}>(response);
    if(sandbox&&(payload.mode!=='sandbox'||payload.policyVersion!=='lokd-sandbox-completion-v1'||payload.productionWorkEligible!==false))throw Error('The isolated specialist policy could not be verified.');
    const data=sandbox?payload.data:payload.state;
    if(!data)throw Error('Specialist records unavailable.');
    return data;
  },[sandbox]);
  const fail=useCallback((cause:unknown)=>{if(workspaceAccessDenied(cause)){setState(null);setSelected('');setDenied(true);dirty.current=false;}setError(cause instanceof Error?cause.message:'Specialist records unavailable.');},[]);
  const refresh=useCallback(async()=>{
    if(lock.current)return;
    if(dirty.current&&!window.confirm('Discard the specialist drafts and read the saved sources?'))return;
    lock.current=true;setBusy(true);
    try {setState(await request());setError('');setDenied(false);setUncertain(false);dirty.current=false;setGeneration(g=>g+1);}
    catch(cause){fail(cause);}
    finally{lock.current=false;setBusy(false);}
  },[request,fail]);
  useEffect(()=>{
    const controller=new AbortController();
    void request(undefined,controller.signal).then(data=>{if(!controller.signal.aborted){setState(data);setError('');}}).catch(cause=>{if(!controller.signal.aborted)fail(cause);});
    return()=>controller.abort();
  },[request,fail]);
  const run:Run=async(action)=>{
    if(lock.current||uncertain||denied)return false;
    lock.current=true;setBusy(true);setError('');
    try {setState(await request(action));dirty.current=false;return true;}
    catch(cause){fail(cause);setUncertain(true);return false;}
    finally{lock.current=false;setBusy(false);}
  };
  async function downloadPack(id:string){
    if(lock.current)return;
    lock.current=true;setBusy(true);
    try{
      const current=await request(), pack=current.packs.find(p=>p.id===id);
      if(!pack)throw Error('The private specialist pack is no longer available.');
      const doc=document.implementation.createHTMLDocument('Private sandbox specialist pack');
      const policy=doc.createElement('meta');policy.httpEquiv='Content-Security-Policy';policy.content="default-src 'none'; base-uri 'none'; form-action 'none'";doc.head.appendChild(policy);
      const title=doc.createElement('h1');title.textContent='Private fictional specialist pack';doc.body.appendChild(title);
      const boundary=doc.createElement('p');boundary.textContent='lokd-sandbox-completion-v1 · No live deployment authority. Current authorised source, revision '+pack.version;doc.body.appendChild(boundary);
      const content=doc.createElement('pre');content.textContent=JSON.stringify(pack,null,2);doc.body.appendChild(content);
      const url=URL.createObjectURL(new Blob(['<!doctype html>'+doc.documentElement.outerHTML],{type:'text/html'})),link=document.createElement('a');link.href=url;link.download='sandbox-specialist-'+pack.id.replace(/[^a-zA-Z0-9_-]/g,'_')+'-v'+pack.version+'.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(cause){fail(cause);}finally{lock.current=false;setBusy(false);}
  }
  if(!state) return <section className="command-error" role="status"><h1>Specialist operations</h1><p>{error||"Loading assignment packs and commercial controls…"}</p>{error&&<button onClick={()=>void refresh()}>Try again</button>}</section>;
  const booking=state.bookings.find(b=>b.id===selected)??state.bookings[0];
  const pack=state.packs.find(p=>p.bookingId===booking?.id);
  return <div className="specialist-control" onChangeCapture={()=>{dirty.current=true;}}>
    <section className="command-heading"><div><p className="eyebrow">Armed Security · VIP Protection</p><h1>Specialist operations</h1><p>Prepare the service order, review evidence and record independent approval.</p></div><button className="secondary-button" disabled={busy} onClick={()=>void refresh()}>Refresh records</button></section>
    <div className="onboarding-lock-banner" style={{gridTemplateColumns:"minmax(0,1fr)"}}><div><strong>{sandbox?"Isolated fictional specialist preparation":state.environment==="demo"?"Synthetic rehearsal environment":"Production preparation"}</strong><p>{sandbox?"These sources exist only in the guarded sandbox. Approval cannot authorise real work.":state.environment==="demo"?"All records in this workspace are synthetic. Approval here cannot authorise real work.":"Real deployment still requires verified onboarding, activation and provider controls."} Settlement remains locked.</p></div></div>
    <nav className="specialist-tabs" aria-label="Specialist controls">{([['packs','Deployment packs'],['rates','Rate card & terms'],['partners','Partners & vehicles'],['rehearsals','Pilot rehearsals']] as [Tab,string][]).filter(([key])=>!sandbox||key!=='rehearsals').map(([key,label])=><button key={key} aria-current={tab===key?"page":undefined} className={tab===key?"active":""} onClick={()=>setTab(key)}>{label}</button>)}</nav>
    {error&&<div className="specialist-error" role="alert">{error}</div>}{uncertain&&<p role="status">The write outcome requires review. Your draft is retained; inspect the saved sources before another submission.</p>}
    <fieldset disabled={busy||uncertain} style={{minWidth:0,border:0,padding:0,display:"grid",gap:"1.25rem"}}><legend>Specialist source controls</legend>
    <div style={{minWidth:0}} hidden={tab!=="rates"}><RateReview key={generation} state={state} run={run} busy={busy||uncertain}/></div>
    <div style={{minWidth:0}} hidden={tab!=="partners"}><PartnerRegister key={generation} state={state} run={run} busy={busy||uncertain}/></div>
    <div style={{minWidth:0}} hidden={tab!=="packs"}>
      <div className="specialist-kpis"><article><span>Specialist bookings</span><strong>{state.bookings.length}</strong></article><article><span>Current approved packs</span><strong>{state.packs.filter(p=>p.status==="approved"&&!p.blockers.length).length}</strong></article><article><span>Commercial review</span><strong>{state.commercialReview?.status??"Not submitted"}</strong></article></div>
      {booking?<><label className="specialist-booking-picker">Assignment<select value={booking.id} onChange={e=>{if(!dirty.current||window.confirm("Discard the current specialist draft and open this assignment?")){dirty.current=false;setSelected(e.target.value);}}}>{state.bookings.map(b=><option key={b.id} value={b.id}>{b.siteName} · {specialistProfiles[b.serviceCode].label} · {b.id}</option>)}</select></label><PackEditor key={`${generation}-${booking.id}-${pack?.version??0}`} booking={booking} pack={pack} state={state} run={run} busy={busy||uncertain} sandbox={sandbox}/>{sandbox&&pack&&<button disabled={busy} onClick={()=>void downloadPack(pack.id)}>Download authorised private sandbox pack</button>}</>:<section className="clean-state"><div><h2>No specialist booking yet</h2><p>Submit an Armed or VIP quote through the client booking flow. Its service order will appear here for preparation. You can review the rate card and supplier evidence while the booking is prepared.</p>{!sandbox&&<button className="secondary-button" onClick={()=>setTab("rehearsals")}>Open pilot rehearsals</button>}</div></section>}
    </div>
    {tab==="rehearsals"&&<section className="specialist-panel"><header><div><h2>Four specialist rehearsals</h2><p>Exercise configured pricing, documentary readiness, expiry, underfunding and quote changes with synthetic facts. These results do not certify live providers or authorise deployment.</p></div><button className="primary-button primary-button--light" disabled={busy||state.environment!=="demo"} onClick={()=>void run({action:"run_rehearsals"})}>{busy?"Running…":"Run all four scenarios"}</button></header>
      {state.rehearsals[0]?<><p>Last run: {new Date(state.rehearsals[0].createdAt).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg"})} SAST · {state.rehearsals[0].runBy}</p><div className="specialist-scenarios">{state.rehearsals[0].scenarios.map(s=><article key={s.serviceCode}><h3>{s.label}</h3><p><strong>{s.status.toUpperCase()}</strong> · {money(s.totalCents)} illustrative total</p><ul>{s.steps.map(step=><li key={step.label}><strong>{step.passed?"Passed":"Failed"} · {step.label}</strong><span>{step.detail}</span></li>)}</ul></article>)}</div></>:<p>No specialist rehearsal has been run.</p>}
      <details className="specialist-production-blockers"><summary>Evidence still required before the real pilot</summary><ul>{state.productionBlockers.map(b=><li key={b}>{b}</li>)}</ul></details>
    </section>}
    </fieldset>
  </div>;
}

function RateReview({state,run,busy}:{state:SpecialistOperationsState;run:Run;busy:boolean}) {
  const [reference,setReference]=useState(""),[expiry,setExpiry]=useState("");const review=state.commercialReview;
  async function submit(e:FormEvent){e.preventDefault();await run({action:"submit_commercial",evidenceReference:reference,expiresAt:fromDay(expiry,true),version:review?.version??0});}
  return <>
    <section className="specialist-panel"><h2>Rate card for commercial review</h2><p>Reference prices below are for one ordinary service block at minimum team size, before risk, notice or calendar adjustments. Planning is already included in the cost floor. Amounts are ZAR.</p>
      <div className="specialist-table-wrap"><table><thead><tr><th>Service</th><th>Operators</th><th>Officer / 12h</th><th>List / operator</th><th>Planning</th><th>Cost floor</th><th>Client total</th><th>Min. margin</th></tr></thead><tbody>{specialistRateCard.map(r=><tr key={r.code}><th>{r.label}</th><td>{r.minimumOperators}</td><td>{money(r.officerShiftCents)}</td><td>{money(r.listShiftCents)}</td><td>{r.minimumPlanningHours}h × {money(r.planningHourlyCostCents)} cost</td><td>{money(r.price.costFloorCents)}</td><td>{money(r.price.totalCents)}</td><td>{r.minimumMarginBasisPoints/100}%</td></tr>)}</tbody></table></div>
      <h3>Calendar multipliers</h3><div className="specialist-table-wrap"><table><thead><tr><th>Day</th><th>Fixed client</th><th>Flex client</th><th>Fixed officer</th><th>Flex officer</th></tr></thead><tbody>{Object.values(calendarPriceBook).map(c=><tr key={c.label}><th>{c.label}</th><td>{c.fixedClientMultiplier}×</td><td>{c.flexClientMultiplier}×</td><td>{c.fixedOfficerMultiplier}×</td><td>{c.flexOfficerMultiplier}×</td></tr>)}</tbody></table></div>
      <p>These are quote multipliers. Individual statutory pay is calculated separately from approved work records.</p>
    </section>
    <section className="specialist-panel"><h2>Terms and cost assumptions</h2><p>Quote validity: {specialistTerms.quoteValidityDays} days, subject to continuing availability and cost evidence. Accepted scope changes require a new review.</p><dl className="specialist-terms">{([['Booking minimum',specialistTerms.minimum],['Planning',specialistTerms.planning],['Extensions and overtime',specialistTerms.extension],['Cancellation',specialistTerms.cancellation],['Exclusions',specialistTerms.exclusion]]).map(([label,detail])=><div key={label}><dt>{label}</dt><dd>{detail}</dd></div>)}</dl><ul>{specialistTerms.assumptions.map(a=><li key={a}>{a}</li>)}</ul><p>Source checks: {specialistTerms.sources.map((s,i)=><span key={s.url}>{i>0?" · ":""}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></span>)}</p></section>
    <section className="specialist-panel"><h2>Record commercial sign-off</h2><p>The evidence must cover actual employer costs, supplier quotes, insurance, final contract wording and the signatory mandate. A different named operator reviews the submitted record.</p>{review&&<p>Status: <strong>{review.status}</strong> · prepared by {review.preparedBy} · expires {day(review.expiresAt)}</p>}
      <form onSubmit={submit}><div className="specialist-form-grid"><label>Approval pack reference<input required maxLength={500} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference to the reviewed cost and terms pack"/></label><label>Review valid until<input required type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label></div><div className="specialist-actions"><button disabled={busy} className="secondary-button">Submit for independent review</button>{review?.status==="review"&&<button type="button" disabled={busy||review.preparedBy===state.actorEmail} onClick={()=>void run({action:"approve_commercial",id:review.id,version:review.version})}>Approve rate card & terms</button>}{review?.status==="approved"&&<button type="button" disabled={busy} onClick={()=>void run({action:"revoke_commercial",id:review.id,version:review.version})}>Revoke approval</button>}</div></form>
    </section>
  </>;
}

function PackEditor({booking,pack,state,run,busy,sandbox=false}:{booking:SpecialistBooking;pack?:SpecialistPack;state:SpecialistOperationsState;run:Run;busy:boolean;sandbox?:boolean}) {
  const [content,setContent]=useState<SpecialistPackContent>(pack?.content??{commandOwner:"",clientBrief:"",officerBrief:"",officerIds:[],partnerId:"",checks:[]});
  const [dirty,setDirty]=useState(false);
  const update=(patch:Partial<SpecialistPackContent>)=>{setDirty(true);setContent({...content,...patch});};
  const required=requiredSpecialistChecks(booking,content.officerIds);
  function check(code:string,field:"reference"|"validFrom"|"expiresAt",value:string){const old=content.checks.find(c=>c.code===code)??{code,reference:"",validFrom:"",expiresAt:""};update({checks:[...content.checks.filter(c=>c.code!==code),{...old,[field]:value}]});}
  return <section className="specialist-panel"><header><div><h2>{booking.siteName}</h2><p>{specialistProfiles[booking.serviceCode].label} · {booking.headcount} operator(s) · {pack?.status??"Draft not yet saved"}</p></div><strong>{money(booking.totalCents)} total</strong></header>
    <div className="specialist-kpis specialist-kpis--pair"><article><span>Assignment plan</span><strong>{booking.planCurrent?"Current":"Review required"}</strong></article><article><span>Specialist authority</span><strong>{booking.authorityCurrent?"Current":"Review required"}</strong></article></div>
    <form onSubmit={async e=>{e.preventDefault();await run({action:"save_pack",bookingId:booking.id,version:pack?.version??0,content});}}>
      <div className="specialist-form-grid"><label>Command owner<input maxLength={200} value={content.commandOwner} onChange={e=>update({commandOwner:e.target.value})}/></label><label>Partner / vehicle provider<select value={content.partnerId} onChange={e=>update({partnerId:e.target.value})}><option value="">No external partner selected</option>{state.partners.map(p=><option key={p.id} value={p.id}>{p.name} · {p.status}</option>)}</select></label><label>Client scope and deliverables<textarea rows={4} maxLength={4000} value={content.clientBrief} onChange={e=>update({clientBrief:e.target.value})}/></label><label>Officer instructions and reporting<textarea rows={4} maxLength={8000} value={content.officerBrief} onChange={e=>update({officerBrief:e.target.value})}/></label></div>
      <fieldset className="specialist-officer-picker"><legend>Named personnel and relief</legend>{state.officers.map(o=><label key={o.id}><input type="checkbox" checked={content.officerIds.includes(o.id)} onChange={e=>update({officerIds:e.target.checked?[...content.officerIds,o.id]:content.officerIds.filter(x=>x!==o.id)})}/><span>{o.name}<small>{o.id}</small></span></label>)}{!state.officers.length&&<p>No officers have been onboarded in this environment.</p>}</fieldset>
      <h3>Evidence covering the full roster</h3><p>Enter controlled document references. Store sensitive source documents in the existing private evidence workflow.</p><div className="specialist-evidence-list">{required.map(r=>{const evidence=content.checks.find(c=>c.code===r.code);return <fieldset key={r.code}><legend>{r.label}</legend><label>Reference<input maxLength={500} value={evidence?.reference??""} onChange={e=>check(r.code,"reference",e.target.value)}/></label><label>Valid from<input type="date" value={evidence?.validFrom?day(evidence.validFrom):""} onChange={e=>check(r.code,"validFrom",fromDay(e.target.value))}/></label><label>Expires<input type="date" value={evidence?.expiresAt?day(evidence.expiresAt):""} onChange={e=>check(r.code,"expiresAt",fromDay(e.target.value,true))}/></label></fieldset>;})}</div>
      <div className="specialist-actions"><button className="primary-button primary-button--light" disabled={busy}>{busy?"Saving…":"Save pack revision"}</button>{pack?.status==="draft"&&<button type="button" disabled={busy||dirty} onClick={()=>void run({action:"submit_pack",id:pack.id,version:pack.version})}>Submit for review</button>}{pack?.status==="review"&&<button type="button" disabled={busy||dirty||pack.preparedBy===state.actorEmail} onClick={()=>void run({action:"approve_pack",id:pack.id,version:pack.version})}>Approve as independent reviewer</button>}{pack?.status==="approved"&&<button type="button" disabled={busy} onClick={()=>void run({action:"revoke_pack",id:pack.id,version:pack.version})}>Revoke pack approval</button>}</div>
    </form>
    {pack&&<><p>Prepared by {pack.preparedBy}{pack.approvedBy?` · Reviewed by ${pack.approvedBy}`:" · Awaiting independent review"}. Revision {pack.version}.</p>{!sandbox&&<a className="secondary-button" href={`/api/specialist?scope=operations&pack=${encodeURIComponent(pack.id)}&download=1`}>Download current Operations pack</a>}{pack.blockers.length>0&&<details open className="specialist-production-blockers"><summary>{pack.blockers.length} item(s) prevent approval</summary><ul>{pack.blockers.map(b=><li key={b}>{b}</li>)}</ul></details>}</>}
  </section>;
}

function PartnerRegister({state,run,busy}:{state:SpecialistOperationsState;run:Run;busy:boolean}) {
  const [name,setName]=useState(""),[reference,setReference]=useState(""),[start,setStart]=useState(""),[expiry,setExpiry]=useState(""),[codes,setCodes]=useState<SpecialistServiceCode[]>([]);
  return <section className="specialist-panel"><h2>Partner and vehicle evidence</h2><p>Register the supplier, approved service scope and evidence period. The evidence pack must include relevant authority, insurance, vehicle and pricing documents. Registration alone does not approve deployment.</p>
    {state.partners.map(p=><article key={p.id} className="specialist-partner-row"><div><h3>{p.name}</h3><p>{p.serviceCodes.map(c=>specialistProfiles[c].label).join(" · ")}</p><p>{p.status} · expires {day(p.expiresAt)} · {p.evidenceReference}</p></div><div className="specialist-actions">{p.status==="review"&&<button disabled={busy||p.preparedBy===state.actorEmail} onClick={()=>void run({action:"approve_partner",id:p.id,version:p.version})}>Verify partner</button>}{p.status==="approved"&&<button disabled={busy} onClick={()=>void run({action:"revoke_partner",id:p.id,version:p.version})}>Revoke</button>}</div></article>)}
    <form onSubmit={async e=>{e.preventDefault();if(await run({action:"add_partner",name,serviceCodes:codes,evidenceReference:reference,validFrom:fromDay(start),expiresAt:fromDay(expiry,true)})){setName("");setReference("");}}}><div className="specialist-form-grid"><label>Supplier name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><label>Evidence pack reference<input required maxLength={500} value={reference} onChange={e=>setReference(e.target.value)}/></label><label>Valid from<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Expires<input required type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label></div><fieldset className="specialist-officer-picker"><legend>Supported services</legend>{specialistRateCard.map(r=><label key={r.code}><input type="checkbox" checked={codes.includes(r.code)} onChange={e=>setCodes(e.target.checked?[...codes,r.code]:codes.filter(c=>c!==r.code))}/>{r.label}</label>)}</fieldset><button className="secondary-button" disabled={busy||!codes.length}>Submit partner for verification</button></form>
  </section>;
}
