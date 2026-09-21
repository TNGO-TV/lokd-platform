'use client';
import {readWorkspaceResponse,WorkspaceRequestError,workspaceFailure,workspaceAccessDenied} from './workspace-request';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { PSIRA_SOURCE, type PsiraCase, type PsiraEvidence } from '../lib/psira-verification';
import styles from './psira-verification.module.css';

const readResponse=(response:Response)=>readWorkspaceResponse<{cases:PsiraCase[];error?:string}>(response);

export default function PsiraVerificationPanel({ scope }: { scope: 'officer' | 'operations' }) {
  const [cases,setCases]=useState<PsiraCase[]>([]);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [loading,setLoading]=useState(true);
  const [canAccess,setCanAccess]=useState(false);
  const [busy,setBusy]=useState(false);
  const [number,setNumber]=useState('');
  const [declaration,setDeclaration]=useState('');
  const endpoint=`/api/psira?scope=${scope}`;
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try {const response=await fetch(endpoint,{cache:'no-store'});const data=await readResponse(response);setCases(data.cases);setCanAccess(true);}catch(e){if(workspaceAccessDenied(e)){setCases([]);setCanAccess(false);setNumber('');setDeclaration('');}setError(workspaceFailure(e,'Unable to load verification records.'));}finally{setLoading(false);}
  },[endpoint]);
  useEffect(()=>{const timer=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timer);},[refresh]);
  async function action(body: Record<string,unknown>) {
    setBusy(true);setError('');setMessage('');
    try {const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await readResponse(response);setCases(data.cases);setMessage('Verification record saved.');}catch(e){if(workspaceAccessDenied(e)){setCases([]);setCanAccess(false);setNumber('');setDeclaration('');}setError(workspaceFailure(e,'Unable to save the record.'));}finally{setBusy(false);}
  }
  return <main className={styles.page}>
    <header><a href={scope==='officer'?'/officer':'/ops'}>← Back to {scope==='officer'?'Officer':'Operations'}</a><p className={styles.kicker}>LOKD · Registration evidence</p><h1>PSiRA verification</h1><p>A registration lookup and a match to the person are separate checks. Submission alone never verifies an officer.</p></header>
    {error&&<WorkspaceRequestError message={error}/>}{message&&<p role="status">{message}</p>}
    <button type="button" disabled={busy||loading} onClick={()=>void refresh()}>Refresh records</button>
    {loading&&<p role="status">Loading verification records…</p>}{<>
      {scope==='officer'&&canAccess&&<form className={styles.card} onSubmit={e=>{e.preventDefault();void action({action:'submit',psiraNumber:number,declaration,expectedVersion:cases[0]?.version});}}><h2>Your registration pathway</h2><label>Registration pathway<select required value={declaration} onChange={e=>setDeclaration(e.target.value)}><option value="">Choose your pathway</option><option value="registered">I am registered (including renewal needed)</option><option value="not_registered">I am not registered</option><option value="training">I am applying for training</option></select></label>{declaration==='registered'&&<label>PSiRA number<input inputMode="numeric" pattern="[0-9]{1,12}" maxLength={12} required value={number} onChange={e=>setNumber(e.target.value)} /></label>}<p>{declaration==='registered'?"Verification is mandatory before security-work approval.":"Training and unregistered applicants follow a separate intake; no registration lookup or automatic rejection is required."}</p><p>Operations will check the official register and separately match the result to your identity. Replacing a number resets the current verification.</p><button disabled={busy||loading||!!error}>Submit for review</button></form>}
      {!loading&&!cases.length&&!error&&<p>No registration numbers are awaiting review.</p>}
      {cases.map(record=>{
        const latest=record.events[0];
        return <section className={styles.card} key={record.id}>
          <h2>{record.declaration==='registered'?`PSiRA ${record.psira_number}`:record.declaration==='training'?'Training pathway':'Registration guidance'}</h2>{scope==='operations'&&<p>{record.owner_email}</p>}
          <dl className={styles.facts}><div><dt>Registration result</dt><dd>{latest?.registration_status.replaceAll('_',' ')??'Unverified'}</dd></div><div><dt>Identity match</dt><dd>{latest?.identity_match??'unchecked'}</dd></div><div><dt>Current PSiRA check</dt><dd>{record.declaration!=='registered'?'Not required for this intake':record.verified?'Verified registration and identity match':'Unverified — mandatory check outstanding'}</dd></div><div><dt>Recheck</dt><dd>{record.declaration!=='registered'?'Not required for this intake':latest?.recheck_at?`${new Date(latest.recheck_at).toLocaleString()}${record.recheckDue?' · Due':''}`:'Awaiting source check'}</dd></div></dl>
          <p>This record does not grant deployment eligibility or replace the other onboarding checks.</p>
          {record.declaration==='registered'&&<div className={styles.actions}><a href={PSIRA_SOURCE} target="_blank" rel="noopener noreferrer">Open official PSiRA verification ↗</a><button disabled={busy||loading||!!error} onClick={()=>void action({action:'recheck',caseId:record.id,expectedVersion:record.version})}>Request a fresh check</button></div>}
          {scope==='operations'&&record.declaration==='registered'&&<ReviewForm key={`${record.id}-${record.version}`} busy={busy||loading||!!error} record={record} save={action}/>}
          <details><summary>Evidence history · {record.events.length} entries</summary>{record.events.map(event=>{
            const evidence=JSON.parse(event.evidence_json) as Partial<PsiraEvidence>&{reason?:string};
            return <article key={event.id} className={styles.history}><h3>{event.kind} · {event.registration_status.replaceAll('_',' ')}</h3><p>Recorded {new Date(event.recorded_at).toLocaleString()} by {event.recorded_by}</p>{evidence.checkedAt&&<p>Source checked {new Date(evidence.checkedAt).toLocaleString()}</p>}{evidence.returnedName&&<p>Returned name: {evidence.returnedName} · Grade: {evidence.grade||'Not returned'}</p>}{evidence.employmentStatus&&<p>Employment status: {evidence.employmentStatus}</p>}{evidence.certificateExpiry&&<p>Certificate expiry: {evidence.certificateExpiry}</p>}<p>{evidence.excerpt||evidence.reason}</p><p>Identity match: {event.identity_match}. {evidence.identityEvidence}</p>{evidence.source&&<a href={PSIRA_SOURCE} target="_blank" rel="noopener noreferrer">Official source</a>}<small>Evidence reference: {event.id}<br/>SHA-256: {event.evidence_hash}</small></article>;
          })}</details>
        </section>;
      })}
    </>}
  </main>;
}
function ReviewForm({record,busy,save}:{record:PsiraCase;busy:boolean;save:(body:Record<string,unknown>)=>Promise<void>}) {
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=new FormData(event.currentTarget);
    const get=(name:string)=>String(form.get(name)||'');
    await save({action:'review',caseId:record.id,expectedVersion:record.version,registrationStatus:get('registrationStatus'),identityMatch:get('identityMatch'),recheckAt:new Date(get('recheckAt')).toISOString(),evidence:{source:PSIRA_SOURCE,checkedAt:new Date(get('checkedAt')).toISOString(),...Object.fromEntries(['returnedNumber','returnedName','returnedStatus','grade','certificateExpiry','employmentStatus','excerpt','identityEvidence'].map(key=>[key,get(key)]))}});
  }
  return <details><summary>Record an Operations review</summary><form onSubmit={event=>void submit(event)} className={styles.review}>
    <p>Read the official result before choosing an outcome. An empty result, error, CAPTCHA or unavailable service must remain unverified. Record only relevant identity information; avoid full national ID numbers.</p>
    <label>Registration outcome<select name="registrationStatus" defaultValue="ambiguous"><option value="ambiguous">Ambiguous / inconclusive</option><option value="unavailable">Service unavailable</option><option value="registered">Registered</option><option value="not_registered">Explicitly not registered</option></select></label>
    <label>Source check time (your local time)<input name="checkedAt" type="datetime-local" required /></label>
    <label>Returned PSiRA number<input name="returnedNumber" maxLength={12}/></label><label>Returned name<input name="returnedName" maxLength={200}/></label><label>Exact registration status<input name="returnedStatus" maxLength={200}/></label><label>Grade<input name="grade" maxLength={100}/></label><label>Certificate expiry<input name="certificateExpiry" type="date"/></label><label>Employment status (separate from registration)<input name="employmentStatus" maxLength={200}/></label>
    <label>Dated result excerpt or failure description<textarea name="excerpt" required maxLength={6000}/></label>
    <label>Match to the person being onboarded<select name="identityMatch" defaultValue="unchecked"><option value="unchecked">Not checked</option><option value="confirmed">Confirmed using independent identity evidence</option><option value="mismatch">Mismatch — refer for review</option></select></label><label>Identity-match evidence / reference<textarea name="identityEvidence" maxLength={500}/></label>
    <label>Recheck by (within 30 days of source check)<input name="recheckAt" type="datetime-local" required/></label><p>Thirty days is LOKD’s provisional review interval, not a PSiRA guarantee. Certificate expiry can shorten it.</p><button disabled={busy}>Save dated review</button>
  </form></details>;
}
