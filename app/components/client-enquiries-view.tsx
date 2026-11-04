"use client";

import {readWorkspaceResponse,workspaceAccessDenied,workspaceFailure} from './workspace-request';
import {clientEnquiriesResponse} from '../lib/workspace-response-contracts';
import {matchesWorkspaceCommand} from '../lib/workspace-command-receipt';
import type {OperationsClientRequest,OperationsClientRequests} from '../lib/booking-client-requests';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ClientEnquiry = {
  id: string;
  organisationName: string;
  contactName: string;
  email: string;
  mobile: string | null;
  siteArea: string;
  siteType: string;
  requiredStart: string;
  serviceType: string;
  message: string;
  status: "new" | "triaged" | "closed";
  ownerId: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type EnquiriesResponse={enquiries:ClientEnquiry[]};

const siteTypeLabels: Record<string, string> = {
  commercial_property: "Commercial property",
  logistics_industrial: "Logistics / industrial",
  construction: "Construction",
  residential_estate: "Residential estate",
  education: "Education",
  retail: "Retail",
  other: "Other",
};

const startLabels: Record<string, string> = {
  within_30_days: "Within 30 days",
  one_to_three_months: "1–3 months",
  three_to_six_months: "3–6 months",
  planning: "Early planning",
};

const serviceLabels: Record<string, string> = {
  scheduled_unarmed_fixed_site: "Scheduled Unarmed",
  armed_static: "Armed static",
  armed_movement: "Armed movement",
  vip_unarmed: "VIP · unarmed",
  vip_armed: "VIP · armed",
  vip_protective_driver: "Protective driver",
  vip_team: "Protective team",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function ClientEnquiriesView({ flash }: { flash: (message: string) => void }) {
  const [enquiries, setEnquiries] = useState<ClientEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"open" | "new" | "triaged" | "closed">("open");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");

  const generation=useRef(0),locked=useRef(false);
  const load = useCallback(async () => {
    const current=++generation.current;
    setLoading(true);
    setError("");
    try {
      const response=await fetch("/api/enquiries",{cache:"no-store"});
      const payload=await readWorkspaceResponse<EnquiriesResponse>(response,clientEnquiriesResponse);
      if(current===generation.current)setEnquiries(payload.enquiries);
    } catch(cause) {
      if(current===generation.current){
        if(workspaceAccessDenied(cause)){setEnquiries([]);setClosingId(null);setResolution("");}
        setError(workspaceFailure(cause,"The enquiry queue could not be loaded."));
      }
    } finally {if(current===generation.current)setLoading(false);}
  },[]);
  useEffect(()=>{const requests=generation;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);requests.current++;};},[load]);

  const visible = useMemo(() => enquiries.filter((item) => {
    if (filter === "open") return item.status !== "closed";
    return item.status === filter;
  }), [enquiries, filter]);

  const counts = useMemo(() => ({
    new: enquiries.filter((item) => item.status === "new").length,
    triaged: enquiries.filter((item) => item.status === "triaged").length,
    closed: enquiries.filter((item) => item.status === "closed").length,
  }), [enquiries]);

  async function update(item: ClientEnquiry, action: "triage" | "close") {
    if(locked.current||loading||error)return;
    locked.current=true;
    setBusyId(item.id);
    setError("");
    try {
      const command={id:item.id,action,version:item.version,...(action==="close"?{resolution}:{})};
      const response = await fetch("/api/enquiries", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });
      await readWorkspaceResponse(response,async value=>value!==null&&typeof value==='object'&&'ok' in value&&value.ok===true&&await matchesWorkspaceCommand(value,'client-enquiries',command));
      setClosingId(null);
      setResolution("");
      await load();
      flash(action === "triage" ? `${item.id} is owned by this Operations account.` : `${item.id} was closed.`);
    } catch (cause) {
      if(workspaceAccessDenied(cause)){setEnquiries([]);setClosingId(null);setResolution("");}
      setError(workspaceFailure(cause,"The enquiry could not be updated."));
    } finally {
      locked.current=false;
      setBusyId(null);
    }
  }

  return <>
    <section className="command-heading enquiry-queue-heading">
      <div><p className="eyebrow">Client requests</p><h1>Client enquiries</h1><p>Review new enquiries and help clients book the right security service.</p></div>
      <button className="secondary-button" disabled={loading||busyId!==null} onClick={() => void load()}>↻ Refresh queue</button>
    </section>

    <section className="enquiry-queue-summary" aria-label="Client enquiry summary">
      <article><span>New</span><strong>{counts.new}</strong><small>Awaiting an owner</small></article>
      <article><span>Triaged</span><strong>{counts.triaged}</strong><small>Owned by Operations</small></article>
      <article><span>Closed</span><strong>{counts.closed}</strong><small>Resolution recorded</small></article>

    </section>

    <section className="enquiry-queue-panel">
      <header><div><strong>Enquiries</strong><span>Client requests</span></div><nav aria-label="Filter enquiries">{(["open", "new", "triaged", "closed"] as const).map((value) => <button className={filter === value ? "active" : ""} key={value} onClick={() => setFilter(value)}>{value}</button>)}</nav></header>
      {error && <p className="command-error-inline" role="alert">{error}</p>}
      {loading ? <div className="enquiry-queue-empty"><span className="pulse-dot" /><strong>Loading the signed-in queue…</strong></div>
        : visible.length === 0 ? <div className="enquiry-queue-empty"><span>✓</span><strong>No {filter} enquiries.</strong><p>New enquiries will appear here.</p></div>
          : <div className="enquiry-queue-list">{visible.map((item) => <article className={`enquiry-queue-card status-${item.status}`} key={item.id}>
            <header><div><span>{item.id}</span><h2>{item.organisationName}</h2><p>{item.contactName} · {item.email}{item.mobile ? ` · ${item.mobile}` : ""}</p></div><em>{item.status}</em></header>
            <dl><div><dt>Service</dt><dd>{serviceLabels[item.serviceType] ?? item.serviceType}</dd></div><div><dt>Area</dt><dd>{item.siteArea}</dd></div><div><dt>Site</dt><dd>{siteTypeLabels[item.siteType] ?? item.siteType}</dd></div><div><dt>Window</dt><dd>{startLabels[item.requiredStart] ?? item.requiredStart}</dd></div><div><dt>Received</dt><dd>{formatDate(item.createdAt)} SAST</dd></div></dl>
            <blockquote>{item.message}</blockquote>
            {item.ownerId && <p className="enquiry-owner">Owner: <strong>{item.ownerId}</strong></p>}
            {item.resolution && <p className="enquiry-resolution"><strong>Resolution</strong>{item.resolution}</p>}
            {item.status !== "closed" && <footer>
              {item.status === "new" && <button disabled={loading||Boolean(error)||busyId!==null} onClick={() => void update(item, "triage")}>Take ownership</button>}
              <button className="secondary" disabled={loading||Boolean(error)||busyId!==null} onClick={() => { setClosingId(closingId === item.id ? null : item.id); setResolution(""); }}>Close with outcome</button>
            </footer>}
            {closingId === item.id && <div className="enquiry-close-panel"><label><span>Resolution note</span><textarea value={resolution} disabled={loading||Boolean(error)||busyId!==null} minLength={3} maxLength={600} onChange={(event) => setResolution(event.target.value)} placeholder="Add the outcome and next steps for the client." /></label><div><button onClick={() => { setClosingId(null); setResolution(""); }}>Cancel</button><button disabled={resolution.trim().length < 3||loading||Boolean(error)||busyId!==null} onClick={() => void update(item, "close")}>{busyId === item.id ? "Saving…" : "Record and close"}</button></div></div>}
          </article>)}</div>}
    </section>
    <ServiceRequestsQueue flash={flash}/>
  </>;
}

const requestLabels: Record<string,string> = {client_site:'Site details',booking_request:'Cover request',booking_change:'Booking change',booking_cancellation:'Cancellation request',shift_rating:'Shift rating',service_issue:'Service issue'};
const objectValue=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
function serviceRequestsResponse(value:unknown):boolean{
  return objectValue(value)&&typeof value.viewerUserId==='string'&&typeof value.isOwner==='boolean'&&Array.isArray(value.serviceRequests)&&value.serviceRequests.every(row=>objectValue(row)&&['id','category','status','summary','createdAt','updatedAt','clientOwnerUserId','organisationName','contactName','email','siteName','siteArea','address','priority'].every(key=>typeof row[key]==='string')&&Number.isSafeInteger(row.version)&&Number(row.version)>0&&objectValue(row.detail)&&['ownerId','publicNote','bookingId','shiftId','clientId','mobile'].every(key=>row[key]===null||typeof row[key]==='string'));
}

function ServiceRequestsQueue({flash}:{flash:(message:string)=>void}){
  const [data,setData]=useState<OperationsClientRequests|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [filter,setFilter]=useState<'open'|'triaged'|'closed'|'all'>('open');
  const generation=useRef(0),locked=useRef(false);
  const load=useCallback(async()=>{
    const current=++generation.current;setLoading(true);setError('');
    try{const response=await fetch('/api/client-bookings?scope=operations',{cache:'no-store'});const payload=await readWorkspaceResponse<OperationsClientRequests>(response,serviceRequestsResponse);if(current===generation.current)setData(payload);}
    catch(cause){if(current===generation.current){if(workspaceAccessDenied(cause))setData(null);setError(workspaceFailure(cause,'Service requests could not be loaded.'));}}
    finally{if(current===generation.current)setLoading(false);}
  },[]);
  useEffect(()=>{const active=generation;const timer=setTimeout(()=>void load(),0);return()=>{clearTimeout(timer);active.current++;};},[load]);
  async function review(item:OperationsClientRequest,status:'triaged'|'closed',note:string){
    if(locked.current||loading||error)return false;
    locked.current=true;setBusy(true);setError('');setMessage('');const current=++generation.current;
    try{
      const command={action:'review_request',id:item.id,expectedVersion:item.version,status,note};
      const response=await fetch('/api/client-bookings?scope=operations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)});
      const payload=await readWorkspaceResponse<OperationsClientRequests&{emailDelivery?:{errors?:string[]}}>(response,async value=>serviceRequestsResponse(value)&&objectValue(value)&&value.ok===true&&await matchesWorkspaceCommand(value,'client-enquiries',command));
      if(current!==generation.current)return false;
      setData(payload);const text=status==='triaged'?'Request assigned to your Operations account.':'Request closed with your message to the client.';
      setMessage([text,...payload.emailDelivery?.errors??[]].join(' '));flash(text);return true;
    }catch(cause){if(current===generation.current){if(workspaceAccessDenied(cause))setData(null);setError(workspaceFailure(cause,'This request could not be updated.'));}return false;}
    finally{locked.current=false;if(current===generation.current)setBusy(false);}
  }
  const visible=(data?.serviceRequests??[]).filter(item=>filter==='all'||item.status===filter);
  return <section className="client-panel client-stack" aria-label="Service requests">
    <div className="client-heading"><div><h2>Service requests</h2><p>Review cover requests, booking changes, sites and client feedback.</p></div><button className="client-secondary" disabled={loading||busy} onClick={()=>void load()}>Refresh requests</button></div>
    <nav className="client-actions" aria-label="Filter service requests">{(['open','triaged','closed','all'] as const).map(value=><button type="button" className="client-secondary" aria-pressed={filter===value} key={value} onClick={()=>setFilter(value)}>{value==='open'?'New':value==='triaged'?'Under review':value==='closed'?'Closed':'All'}</button>)}</nav>
    {error&&<p role="alert">{error}{error.includes('second factor')&&<> <a className="client-link" href="/ops/security">Verify Operations sign-in</a></>}</p>}{message&&<p role="status">{message}</p>}
    {loading?<p role="status">Loading service requests…</p>:!error&&!visible.length?<p>No service requests in this view.</p>:visible.map(item=><article className="client-panel" key={item.id}>
      <div className="client-heading"><div><p className="client-muted">{requestLabels[item.category]??'Client request'} · {item.id}</p><h3>{item.summary}</h3></div><span className="client-status">{item.status==='triaged'?'Under review':item.status}{item.priority==='high'?' · High priority':''}</span></div>
      <p><strong>{item.organisationName||'Client account'}</strong>{item.contactName?' · '+item.contactName:''}{item.email?' · '+item.email:''}{item.mobile?' · '+item.mobile:''}</p>
      <dl className="client-facts">{item.clientId&&<div><dt>Client</dt><dd>{item.clientId}</dd></div>}{item.siteName&&<div><dt>Site</dt><dd>{item.siteName}</dd></div>}{item.address&&<div><dt>Address</dt><dd>{item.address}</dd></div>}{item.siteArea&&<div><dt>Area</dt><dd>{item.siteArea}</dd></div>}<div><dt>Received</dt><dd>{formatDate(item.createdAt)} SAST</dd></div>{item.bookingId&&<div><dt>Booking</dt><dd>{item.bookingId}</dd></div>}{item.shiftId&&<div><dt>Shift</dt><dd>{item.shiftId}</dd></div>}
        {([['serviceType','Service'],['startDate','Start date'],['endDate','End date'],['shiftStart','Start time (SAST)'],['shiftEnd','End time (SAST)'],['headcount','Officers'],['score','Rating out of 5'],['latitude','Latitude'],['longitude','Longitude']] as const).map(([key,label])=>typeof item.detail[key]==='string'||typeof item.detail[key]==='number'?<div key={key}><dt>{label}</dt><dd>{String(item.detail[key])}</dd></div>:null)}
      </dl>
      {['note','reason','cancellationReason'].map(key=>typeof item.detail[key]==='string'?<p key={key}>{String(item.detail[key])}</p>:null)}
      {item.publicNote&&<p><strong>Message to client: </strong>{item.publicNote}</p>}
      {item.ownerId&&<p className="client-muted">Owner: {item.ownerId===data?.viewerUserId?'You':item.ownerId}</p>}
      {['booking_request','booking_change','booking_cancellation'].includes(item.category)&&<a className="client-link" href="/ops/service">Open service orders</a>}
      {['open','triaged'].includes(item.status)&&(item.clientOwnerUserId===data?.viewerUserId?<p>Another operator must review your own request.</p>:item.ownerId&&item.ownerId!==data?.viewerUserId&&!data?.isOwner?<p>This request is assigned to another operator.</p>:<RequestReviewForm key={item.id+':'+item.version} item={item} disabled={busy||loading||Boolean(error)} review={review}/>)}
    </article>)}
  </section>;
}

function RequestReviewForm({item,disabled,review}:{item:OperationsClientRequest;disabled:boolean;review:(item:OperationsClientRequest,status:'triaged'|'closed',note:string)=>Promise<boolean>}){
  const [note,setNote]=useState(''),[status,setStatus]=useState<'triaged'|'closed'>(item.status==='open'?'triaged':'closed');
  return <details><summary>Review request</summary><form className="client-form" onSubmit={async event=>{event.preventDefault();if(await review(item,status,note))setNote('');}}><fieldset disabled={disabled}>
    <label>Outcome<select value={status} onChange={event=>setStatus(event.target.value as 'triaged'|'closed')}>{item.status==='open'&&<option value="triaged">Take ownership</option>}<option value="closed">Close with outcome</option></select></label>
    <label className="client-full">Message to client<textarea required minLength={3} maxLength={2000} rows={4} value={note} onChange={event=>setNote(event.target.value)} placeholder="Explain the outcome and next steps."/></label>
  </fieldset><button className="client-primary" disabled={disabled||note.trim().length<3}>{disabled?'Saving…':'Save review'}</button></form></details>;
}
