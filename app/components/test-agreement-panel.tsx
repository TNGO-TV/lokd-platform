'use client';
import {useRef,useState,type FormEvent} from 'react';
import type {Envelope} from '../lib/test-agreements';
import styles from './signup-portal.module.css';
type Data={caseVersion:number;withdrawn:boolean;documents:(Envelope&{usable:boolean;stale:boolean})[];events:{envelope_id:string;snapshot:string;recorded_at:string}[]};
type Action='issue'|'sign'|'review'|'cancel';
type Pending={action:Action;caseVersion:number;envelope?:Envelope};
const labels:Record<Action,string>={issue:'Issue or retrieve test agreement',sign:'Sign test agreement',review:'Review test signature',cancel:'Cancel test document'};
const noteLabels={issue:'Why are you issuing this test agreement?',review:'Test signer identity and authority evidence reviewed',cancel:'Why is this test document being cancelled?'};
export default function TestAgreementPanel({kind,caseId,operations=false}:{kind:'client'|'officer';caseId:string;operations?:boolean}){
 const [data,setData]=useState<Data|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [pending,setPending]=useState<Pending|null>(null),[note,setNote]=useState(''),[name,setName]=useState(''),[acknowledged,setAcknowledged]=useState(false);
 const lock=useRef(false);
 const endpoint=`/api/agreements/test?kind=${kind}${operations?'&scope=operations':''}`;
 function close(){setPending(null);setNote('');setName('');setAcknowledged(false);}
 function clearPrivate(){setData(null);close();}
 async function load(){
  if(lock.current)return;lock.current=true;setBusy(true);
  try{const r=await fetch(endpoint+'&caseId='+encodeURIComponent(caseId),{cache:'no-store'}),d=await r.json() as Data&{error?:string};if([401,403].includes(r.status))clearPrivate();if(!r.ok)throw Error(d.error);setData(d);close();setError('');}
  catch(e){setError(e instanceof Error?e.message:'Unable to load documents.');}
  finally{lock.current=false;setBusy(false);}
 }
 function begin(action:Action,envelope?:Envelope){
  if(!data||lock.current)return;
  setPending({action,caseVersion:data.caseVersion,envelope});setNote('');setName('');setAcknowledged(false);setError('');
 }
 async function act(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!pending||lock.current)return;
  const {action,envelope:e,caseVersion}=pending;
  if(action==='sign'?(name.trim().length<3||name.length>100):(note.trim().length<12||note.length>1200)){
   setError(action==='sign'?'Enter a test signer name of 3 to 100 characters.':'Enter a reason or evidence note of 12 to 1200 characters.');return;
  }
  if((action==='sign'||action==='review')&&!acknowledged){setError('Confirm the test acknowledgement before saving.');return;}
  const extra=action==='sign'?{signerName:name,affirmative:acknowledged,testAcknowledged:acknowledged,contentHash:e?.content_hash,contextHash:e?.context_hash}:{note,identityAndAuthorityReviewed:action==='review'&&acknowledged};
  lock.current=true;setBusy(true);setError('');
  try{const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,caseId,caseVersion,envelopeId:e?.id,expectedRevision:e?.revision,...extra})}),d=await r.json() as Data&{error?:string};if([401,403].includes(r.status))clearPrivate();if(!r.ok)throw Error(d.error);setData(d);close();}
  catch(e){setError(e instanceof Error?e.message:'Unable to save; refresh before retrying.');}
  finally{lock.current=false;setBusy(false);}
 }
 function download(e:Envelope){const blob=new Blob([e.wording+'\n\nTEST RECEIPT\n'+JSON.stringify({state:e.state,signer:e.signer_name,signedAt:e.signed_at,contentHash:e.content_hash,contextHash:e.context_hash},null,2)],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='LOKD-test-agreement-'+e.id+'.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <section>
  <h3>Agreement delivery and signing test</h3><p>Test documents exercise the signing process. They never authorise employment, service, payment or work.</p>
  <button disabled={busy} onClick={()=>void load()}>{data?'Refresh test documents':'Open test documents'}</button>
  {error&&<p role="alert">{error}</p>}
  {data&&<>
   {data.withdrawn&&<p>This submission is withdrawn; document history is read-only.</p>}
   {operations&&!data.withdrawn&&<button disabled={busy||!!pending} onClick={()=>begin('issue')}>Issue or retrieve test agreement</button>}
   {!data.documents.length&&<p>No test document issued. Operations can deliver one to this account.</p>}
   {pending&&<form className={styles.form} aria-label={labels[pending.action]} onSubmit={event=>void act(event)}>
    <fieldset disabled={busy}>
     {pending.envelope&&<p>Test document: {pending.envelope.document_version} · Revision {pending.envelope.revision}</p>}
     {pending.action==='sign'?<>
      <label>Your name for this test signing record<input autoFocus name="signerName" required minLength={3} maxLength={100} value={name} onChange={event=>setName(event.target.value)}/></label>
      <label><input type="checkbox" required checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>I have read this exact test document and agree to record a TEST signature. This is not a live contract or payment authority.</label>
     </>:<>
      <label>{noteLabels[pending.action]}<textarea autoFocus name="note" required minLength={12} maxLength={1200} value={note} onChange={event=>setNote(event.target.value)}/></label>
      {pending.action==='review'&&<label><input type="checkbox" required checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/>I have reviewed the test signer and their authority evidence. This does not approve a live legal agreement.</label>}
     </>}
     <button type="submit">{busy?'Saving…':pending.action==='issue'?'Confirm test agreement issue':pending.action==='sign'?'Record test signature':pending.action==='review'?'Save test signature review':'Confirm test document cancellation'}</button>
     <button type="button" onClick={close}>Close form without saving</button>
    </fieldset>
   </form>}
   {data.documents.map(e=><article key={e.id}>
    <h4>{e.document_version}</h4><p role="status">{e.state.replaceAll('_',' ')}{e.stale?' · superseded application':!e.usable?' · closed or expired':''}</p><p>{e.note}</p><p>Expires: {new Date(e.expires_at).toLocaleString('en-ZA')}</p>
    <details><summary>Read exact test document</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{e.wording}</pre></details>
    <button onClick={()=>download(e)}>Download test document and record</button>
    {e.usable&&!operations&&e.state==='issued'&&<button disabled={busy||!!pending} onClick={()=>begin('sign',e)}>Sign test agreement</button>}
    {e.usable&&operations&&e.state==='signed_test'&&<button disabled={busy||!!pending} onClick={()=>begin('review',e)}>Review test signature</button>}
    {e.usable&&['issued','signed_test','reviewed_test'].includes(e.state)&&<button disabled={busy||!!pending} onClick={()=>begin('cancel',e)}>Cancel test document</button>}
   </article>)}
   {!!data.events.length&&<details><summary>Dated document activity</summary>{data.events.map((e,i)=><p key={i}>{e.recorded_at} · {JSON.parse(e.snapshot).state} · {JSON.parse(e.snapshot).note}</p>)}</details>}
  </>}
 </section>;
}
