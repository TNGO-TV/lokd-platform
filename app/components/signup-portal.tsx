'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {signupNextStep,signupStatusLabels,type SignupRecord,type SignupKind} from '../lib/signup-types';
import {applicationPsiraDeclaration} from '../lib/psira-pathway';
import styles from './signup-portal.module.css';
import OfficerPresencePanel from './officer-presence-panel';
import TestAgreementPanel from './test-agreement-panel';
const fieldLabels:Record<string,string>={fullName:'Full name',mobile:'Mobile number',city:'City or town',province:'Province',psiraStatus:'PSiRA position',psiraNumber:'PSiRA number',psiraGrade:'PSiRA grade',organisationName:'Organisation',contactName:'Contact name',siteArea:'Site area',message:'Site brief',pathway:'Pathway',siteType:'Site type',requiredStart:'Planning window',serviceType:'Service',services:'Work interests',purposes:'Work environments',training:'Training interests'};
const options:Record<string,string[]>={pathway:['qualified','training'],province:['Gauteng','Western Cape','Free State','KwaZulu-Natal','Eastern Cape','Mpumalanga','Limpopo','North West','Northern Cape'],psiraStatus:['active','expired','in_training','not_registered'],psiraGrade:['','Grade A','Grade B','Grade C','Grade D','Grade E']};
const valueLabel=(value:string)=>({active:'Registered and current',expired:'Registered · renewal needed',in_training:'Currently in training',not_registered:'Not yet registered'}[value]??value.replaceAll('_',' '));
function date(value:string){return new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'});}
export default function SignupPortal({kind:initialKind,operations=false}:{kind:SignupKind;operations?:boolean}) {
 const [kind,setKind]=useState(initialKind),[records,setRecords]=useState<SignupRecord[]>([]),[email,setEmail]=useState(''),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const endpoint=`/api/signup?scope=${operations?'operations':kind}${operations?`&kind=${kind}`:''}`;
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  try{const response=await fetch(`${endpoint}&offset=${offset}`,{cache:'no-store'});const data=await response.json() as {error?:string;records?:SignupRecord[];hasMore?:boolean;email?:string};if(!response.ok||!Array.isArray(data.records))throw new Error(data.error??'Unable to load your submissions.');setRecords(data.records);setHasMore(data.hasMore===true);setEmail(data.email??'');}
  catch(cause){setError(cause instanceof Error?cause.message:'Unable to load your submissions.');}
  finally{setLoading(false);}
 },[endpoint,offset]);
 // This effect synchronises the selected intake page with its remote record.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(()=>{void refresh();},[refresh]);
 async function run(body:Record<string,unknown>) {
  if(busy)return false;setBusy(true);setError('');setNotice('');
  try{const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...body,kind})});const data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error??'Unable to save.');await refresh();setNotice('Saved. The latest status is shown below.');return true;}
  catch(cause){setError(cause instanceof Error?cause.message:'Unable to save.');return false;}
  finally{setBusy(false);}
 }
 return <main className={styles.shell}>
  <header className={styles.header}><a href="https://lokd.co.za"><img src="/lokd-logo.png" alt="LOKD home"/></a><nav>{operations&&<><Link href="/ops/psira">PSiRA reviews</Link><Link href="/ops/security">Account security</Link></>}<Link href={operations?"/ops/service":`/${kind}/service`}>Service readiness</Link><Link href={operations?"/ops/agreements":`/${kind}/agreements`}>Approved agreements</Link><Link href={operations?"/ops/test-cycle":`/${kind}/test-cycle`}>Test operating cycle</Link><Link href="/sign-out">Sign out</Link></nav></header>
  <section className={styles.heading}><p>{operations?'OPERATIONS':'YOUR LOKD ACCOUNT'}</p><h1>{operations?'Application review':kind==='officer'?'Your officer application':'Your security enquiry'}</h1><p>{operations?'Review real client and officer submissions, request corrections and record the next steps.':'Follow your submission, send corrections and see what Operations needs from you.'}</p>{email&&<small>Signed in as {email}</small>}</section>
  {operations&&<nav className={styles.tabs} aria-label="Intake type">{(['officer','client'] as const).map(value=><button key={value} disabled={busy||loading} aria-pressed={kind===value} onClick={()=>{setKind(value);setOffset(0);setRecords([]);}}>{value==='officer'?'Officer applications':'Client enquiries'}</button>)}</nav>}
  <p className={styles.boundary}>Applications and enquiries are open. Identity checks, document signing and enrolment payments have test journeys. Live verification, approved contracts and live payments still require acceptance. Intake review does not approve security work or start a service.</p>
  {error&&<div className={styles.error} role="alert">{error} <button disabled={busy||loading} onClick={()=>void refresh()}>Refresh</button></div>}
  {notice&&<p role="status">{notice}</p>}
  {loading?<p role="status">Loading submissions…</p>:records.length===0?<section className={styles.card}><h2>{operations?'No submissions on this page':'No submission linked to this email yet'}</h2><p>{operations?'New applications will appear here.':'Use the same verified email you supplied on your application. A reference alone cannot give access to someone else’s submission.'}</p>{!operations&&<a className={styles.primary} href={`https://lokd.co.za/${kind==='officer'?'join':'contact'}`}>{kind==='officer'?'Start an application':'Submit a site enquiry'}</a>}<button disabled={busy} onClick={()=>void refresh()}>Check again</button></section>:records.map(record=><RecordCard key={`${record.kind}:${record.id}:${record.version}`} record={record} operations={operations} busy={busy||loading} run={run}/>)}
  {!operations&&kind==='officer'&&<OfficerPresencePanel/>}
  <nav className={styles.pagination} aria-label="Submission pages"><button disabled={offset===0||loading||busy} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><span>Page {offset/50+1}</span><button disabled={!hasMore||loading||busy} onClick={()=>setOffset(offset+50)}>Next</button></nav>
 </main>;
}
function RecordCard({record,operations,busy,run}:{record:SignupRecord;operations:boolean;busy:boolean;run:(body:Record<string,unknown>)=>Promise<boolean>}) {
 const [productionReference,setProductionReference]=useState('');
 async function prepareProduction(){try{const response=await fetch('/api/agreements/production?scope=operations&kind='+record.kind,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'prepare_entity',kind:record.kind,caseId:record.id,caseVersion:record.version})});const body=await response.json() as {error?:string;result?:{entityId:string}};if(!response.ok)throw Error(body.error);setProductionReference('Prepared '+body.result?.entityId+'. Verification and approvals remain pending.');}catch(e){setProductionReference(e instanceof Error?e.message:'Preparation failed.');}}
 const [editing,setEditing]=useState(false),[confirmWithdraw,setConfirmWithdraw]=useState(false),[values,setValues]=useState(record.details);
 const send=(body:Record<string,unknown>)=>run({id:record.id,expectedVersion:record.version,...body});
 const fields=record.kind==='officer'?['fullName','mobile','city','province','pathway','psiraStatus','psiraNumber','psiraGrade']:['organisationName','contactName','mobile','siteArea','message'];
 const registered=record.kind==='officer'&&applicationPsiraDeclaration(values.pathway,values.psiraStatus)==='registered';
 async function correct(event:FormEvent){event.preventDefault();const changes=Object.fromEntries(fields.map(key=>[key,values[key]??'']));if(await send({action:'correct',changes}))setEditing(false);}
 async function review(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);await send({action:'review',status:form.get('status'),note:form.get('note')});}
 return <article className={styles.card}>
  <header><div><small>{record.id} · Updated {date(record.updatedAt)}</small><h2>{record.details.fullName??record.details.organisationName}</h2><p>{record.email}</p></div><strong className={styles.status}>{signupStatusLabels[record.status]}</strong></header>
  {operations&&record.accountLinked&&record.status==='reviewed'&&<button disabled={busy} onClick={()=>void prepareProduction()}>Prepare operational record</button>}{productionReference&&<p role="status">{productionReference}</p>}
  <p>{signupNextStep(record)}</p>{record.note&&<blockquote><strong>Latest update</strong><p>{record.note}</p></blockquote>}
  {record.kind==='officer'&&<div className={styles.requirements}><strong>{registered?(record.verification?.verified?'Registration review current':'Registration and identity checks pending'):'Training / registration guidance'}</strong><p>{registered?'Your PSiRA number must be checked against the official register, and the result must separately be matched to you. The registration result and identity match are reviewed separately.':'This intake does not need a PSiRA lookup. It does not approve paid security work; you can correct your registration position when it changes.'}</p>{registered&&<p>Registration: {valueLabel(record.verification?.registrationStatus??'pending_review')} · Identity match: {valueLabel(record.verification?.identityMatch??'unchecked')}{record.verification?.checkedAt&&<> · Recorded {date(record.verification.checkedAt)}</>}{record.verification?.recheckAt&&<> · Recheck by {date(record.verification.recheckAt)}</>}</p>}{registered&&record.accountLinked&&!operations&&record.status!=='withdrawn'&&<Link href="/officer/psira">Open my PSiRA verification →</Link>}</div>}
  {!operations&&record.kind==='officer'&&record.accountLinked&&record.status!=='withdrawn'&&<Link href={`/officer/identity?caseId=${encodeURIComponent(record.id)}`}>Identity check progress →</Link>}
  {operations&&record.kind==='officer'&&record.accountLinked&&record.status!=='withdrawn'&&<Link href={`/ops/identity?caseId=${encodeURIComponent(record.id)}`}>Review identity check evidence →</Link>}
  {record.accountLinked&&<TestAgreementPanel kind={record.kind} caseId={record.id} operations={operations}/>}
  <details><summary>View submitted details</summary><dl className={styles.details}>{Object.entries(record.details).map(([key,value])=><div key={key}><dt>{fieldLabels[key]??key}</dt><dd>{value||'Not provided'}</dd></div>)}</dl></details>
  {!operations&&!record.accountLinked&&record.status!=='withdrawn'&&<button className={styles.primary} disabled={busy} onClick={()=>void send({action:'link'})}>Link to my account</button>}
  {!operations&&record.accountLinked&&record.status!=='withdrawn'&&<div className={styles.actions}><button disabled={busy} onClick={()=>setEditing(!editing)}>{editing?'Cancel editing':'Correct my details'}</button><button disabled={busy} onClick={()=>setConfirmWithdraw(!confirmWithdraw)}>Withdraw submission</button></div>}
  {confirmWithdraw&&<div className={styles.requirements}><p>Withdraw this submission? Operations will see it as withdrawn. Your history is retained.</p><button disabled={busy} onClick={()=>void send({action:'withdraw'})}>Confirm withdrawal</button><button disabled={busy} onClick={()=>setConfirmWithdraw(false)}>Keep submission</button></div>}
  {editing&&<form className={styles.form} onSubmit={correct}>{fields.filter(key=>registered||!['psiraNumber','psiraGrade'].includes(key)).map(key=><label key={key}>{fieldLabels[key]}{options[key]?<select value={values[key]??''} onChange={event=>setValues({...values,[key]:event.target.value})}>{options[key].map(option=><option key={option} value={option}>{valueLabel(option)||'Not provided'}</option>)}</select>:key==='message'?<textarea required minLength={20} maxLength={2000} value={values[key]??''} onChange={event=>setValues({...values,[key]:event.target.value})}/>:<input required={key!=='mobile'||record.kind==='officer'} maxLength={120} type={key==='mobile'?'tel':'text'} inputMode={key==='psiraNumber'?'numeric':undefined} value={values[key]??''} onChange={event=>setValues({...values,[key]:event.target.value})}/>}</label>)}<button className={styles.primary} disabled={busy}>Save and resubmit for review</button><small>Account email, access permissions and verification results cannot be changed through this form.</small></form>}
  {operations&&record.status!=='withdrawn'&&<form className={styles.form} onSubmit={review}><label>Review outcome<select name="status" defaultValue="needs_information"><option value="needs_information">Request information</option><option value="reviewed">Intake reviewed · further checks pending</option></select></label><label>Message visible to the applicant<textarea name="note" required minLength={10} maxLength={1200} placeholder="Explain what is needed and what the applicant should do next."/></label><button className={styles.primary} disabled={busy}>Save intake review</button></form>}
  {record.events.length>0&&<details><summary>Recent activity</summary><ol>{record.events.map((event,index)=><li key={index}><small>{date(event.recordedAt)}</small><p>{event.note}</p></li>)}</ol></details>}
 </article>;
}
