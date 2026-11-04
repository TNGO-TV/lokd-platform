'use client';
import {useState,useEffect,useCallback,useRef,type FormEvent} from 'react';
import Link from 'next/link';
import {clientQuotesResponse} from '../lib/workspace-response-contracts';
import {matchesWorkspaceCommand} from '../lib/workspace-command-receipt';
import {QUOTES_EMAIL,INVOICE_EMAIL} from '../lib/public-site';
import {readWorkspaceResponse,workspaceFailure,workspaceAccessDenied} from './workspace-request';
import styles from './client-quotes-panel.module.css';
import type {ClientAgreement} from '../lib/agreement-client';

type Terms={id:string;title:string;version:string;entity_id:string;file_hash:string;approved_at:string|null;withdrawn:number};
type Quote={id:string;public_number?:string|null;order_id:string;terms_id:string;terms_title:string;terms_version:string;source_json:string;offer_hash:string;sequence:number;latest_sequence?:number;expires_at:string;cancelled:number;declined?:number;terms_withdrawn:number;receipt_json:string|null;receipt_hash:string|null;email_delivery_state:string|null;email_delivery_error?:string|null};
type State={quotes:Quote[];terms:Terms[];orders:{order_id:string;entity_id:string;source_json:string;sequence:number}[];owner:boolean;acknowledgement:string};
const money=(value:unknown)=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(Number(value)/100);
const sast=(value:string)=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'});

function Scope({json}:{json:string}){
 const s=JSON.parse(json);
 return <><dl className={styles.details}>
  <div><dt>Client</dt><dd>{s.clientName}</dd></div><div><dt>Contact</dt><dd>{s.contactName}</dd></div>
  <div><dt>Site</dt><dd>{s.siteName}<br/>{s.address}, {s.siteArea}</dd></div><div><dt>Service</dt><dd>{s.serviceType} · {s.purposeLabel}</dd></div>
  <div><dt>Dates</dt><dd>{s.startDate} to {s.endDate}</dd></div><div><dt>Times (SAST)</dt><dd>{s.shiftStart}–{s.shiftEnd}</dd></div>
  <div><dt>Cover</dt><dd>{s.headcount} officer(s) · {s.shiftCount} shifts · {s.rosterPattern.replaceAll('_',' ')}</dd></div><div><dt>Minimum grade</dt><dd>{s.minimumGrade}</dd></div>
 </dl><p><strong>{s.postName}</strong><br/>{s.instructions}</p>
 <div className={styles.tableWrap}><table><caption>Price for your cover</caption><thead><tr><th scope="col">Item</th><th scope="col">Amount</th></tr></thead><tbody>
  <tr><td>{s.serviceType} cover<br/><small>{s.shiftCount} shifts at {s.siteName}</small></td><td>{money(s.subtotalCents)}</td></tr>
  <tr><td>{s.vatCents===0?'VAT · not charged':'VAT'}</td><td>{money(s.vatCents)}</td></tr>
  <tr><th scope="row">Total</th><td><strong>{money(s.totalCents)}</strong></td></tr>
 </tbody></table></div><p>Payment: {s.fundingModel.replaceAll('_',' ')}{s.creditTermsDays>0?` · ${s.creditTermsDays} days`:''}</p></>;
}

function ConfirmAction({label,reason,acknowledgement,disabled,onConfirm}:{label:string;reason?:string;acknowledgement?:string;disabled:boolean;onConfirm:(reason:string)=>Promise<boolean>}){
 const [open,setOpen]=useState(false),[note,setNote]=useState(''),[checked,setChecked]=useState(false);
 return <div className={styles.confirm}><button type="button" disabled={disabled} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{label}</button>{open&&<form className={styles.form} onSubmit={async event=>{event.preventDefault();if(await onConfirm(note)){setOpen(false);setNote('');setChecked(false);}}}>
  {reason&&<label>{reason}<textarea required value={note} maxLength={1200} onChange={event=>setNote(event.target.value)} disabled={disabled}/></label>}
  {acknowledgement&&<label className={styles.checkbox}><input type="checkbox" required checked={checked} onChange={event=>setChecked(event.target.checked)} disabled={disabled}/><span>{acknowledgement}</span></label>}
  <div className={styles.actions}><button className={styles.primary} disabled={disabled||!!acknowledgement&&!checked}>Confirm {label.toLowerCase()}</button><button type="button" disabled={disabled} onClick={()=>setOpen(false)}>Keep unchanged</button></div>
 </form>}</div>;
}

function clientAgreementsResponse(value:unknown){
 if(!value||typeof value!=='object'||!('agreements' in value)||!Array.isArray(value.agreements))return false;
 return value.agreements.every(row=>{
  if(!row||typeof row!=='object'||!['id','role','wording','context_json','content_hash','context_hash','expires_at'].every(key=>typeof row[key]==='string'))return false;
  try{const context=JSON.parse(row.context_json);return context&&typeof context==='object'&&(row.receipt_json===null||typeof JSON.parse(row.receipt_json).acceptedAt==='string');}catch{return false;}
 });
}

function ClientAgreementPanel({focusId}:{focusId?:string}){
 const endpoint='/api/client-agreements'+(focusId?.startsWith('ENV-')?'?agreement='+encodeURIComponent(focusId):'');
 const [data,setData]=useState<{agreements:ClientAgreement[]}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stale,setStale]=useState(false);
 const [now,setNow]=useState(()=>Date.now());
 const inFlight=useRef(false);
 const load=useCallback(async()=>{if(inFlight.current)return;inFlight.current=true;setBusy(true);try{
  setData(await readWorkspaceResponse<{agreements:ClientAgreement[]}>(await fetch(endpoint,{cache:'no-store'}),clientAgreementsResponse));setError('');setStale(false);
 }catch(cause){if(workspaceAccessDenied(cause))setData(null);setError(workspaceFailure(cause,'Your service agreements could not be loaded.'));setStale(true);}finally{inFlight.current=false;setBusy(false);}},[endpoint]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(focusId&&data)document.getElementById(focusId)?.scrollIntoView({block:'nearest'});},[focusId,data]);
 async function sign(agreement:ClientAgreement){
  if(inFlight.current||stale)return false;inFlight.current=true;setBusy(true);setError('');
  try{
   const response=await readWorkspaceResponse<{agreements:ClientAgreement[];result:{receiptId:string}}>(await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'sign',envelopeId:agreement.id,contentHash:agreement.content_hash,contextHash:agreement.context_hash,affirmative:true})}),clientAgreementsResponse);
   if(response.result?.receiptId!=='LIVE-SIGN-'+agreement.id||!response.agreements.find(row=>row.id===agreement.id)?.receipt_json)throw Error('Your signature could not be confirmed. Refresh your agreements.');
   setData(response);setStale(false);return true;
  }catch(cause){setError(workspaceFailure(cause,'Your agreement could not be signed. Refresh and try again.'));setStale(true);if(workspaceAccessDenied(cause))setData(null);return false;}
  finally{inFlight.current=false;setBusy(false);}
 }
 if(data&&!data.agreements.length&&!error&&!focusId?.startsWith('ENV-'))return null;
 return <section aria-label="Service agreements" aria-busy={busy}><h2>Service agreements</h2><button disabled={busy} onClick={()=>void load()}>Refresh agreements</button>{busy&&<p role="status">Loading or saving agreements…</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
  {focusId?.startsWith('ENV-')&&data&&!data.agreements.some(row=>row.id===focusId)&&<p>Agreement not found for your account.</p>}
  {data?.agreements.map(agreement=>{
   const signed=agreement.receipt_json?JSON.parse(agreement.receipt_json):null,closed=agreement.cancelled||agreement.document_withdrawn||agreement.revoked_at,expired=Date.parse(agreement.expires_at)<=now;
   const scope=JSON.parse(agreement.context_json).scope??{};
   return <article className={styles.card} id={agreement.id} key={agreement.id}><h3>{agreement.role==='CLIENT_MSA'?'Client service agreement':'Service order agreement'}</h3><p className={styles.status}>{closed?'Withdrawn':signed?'Signed':expired?'Expired':'Awaiting your signature'}</p>
    <details><summary>Read your agreement</summary><div className={styles.wording}>{agreement.wording}</div><h4>Service details</h4><dl>{Object.entries(scope).map(([key,value])=><div key={key}><dt>{key.replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ')}</dt><dd>{String(value??'')}</dd></div>)}</dl></details>
    {signed?<><p>Signed {sast(signed.acceptedAt)} SAST.</p><a href={'/api/client-agreements?receipt='+encodeURIComponent(agreement.id)}>View signed agreement</a></>:<p>Valid until {sast(agreement.expires_at)} SAST.</p>}
    {!signed&&!closed&&!expired&&<ConfirmAction label="Sign agreement" disabled={busy||stale} acknowledgement="I have read this agreement and the service details. I agree to these terms and confirm I am authorised to sign for the client." onConfirm={()=>sign(agreement)}/>}
    {agreement.email_error&&<p role="status" className={styles.error}>{agreement.email_error}</p>}
   </article>;
  })}
 </section>;
}

function ClientQuotesPanelState({operations=false,focusId}:{operations?:boolean;focusId?:string}){
 const inFlight=useRef(false);
 const query=new URLSearchParams();if(operations)query.set('scope','operations');if(focusId?.startsWith('QUOTE-'))query.set('quote',focusId);
 const endpoint='/api/quotes'+(query.size?'?'+query.toString():'');
 const file=(id:string)=>endpoint+(query.size?'&':'?')+'file='+encodeURIComponent(id);
 const receipt=(id:string)=>endpoint+(query.size?'&':'?')+'receipt='+encodeURIComponent(id);
 const [now,setNow]=useState(()=>Date.now());
 const [data,setData]=useState<State|null>(null),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [checked,setChecked]=useState<Record<string,boolean>>({});
 const load=useCallback(async()=>{
  if(inFlight.current)return;inFlight.current=true;setBusy(true);
  try{setData(await readWorkspaceResponse<State>(await fetch(endpoint,{cache:'no-store'}),clientQuotesResponse));setStale(false);setError('');setChecked({});}
  catch(cause){setStale(true);if(workspaceAccessDenied(cause))setData(null);setError(workspaceFailure(cause,'Your quotes could not be loaded. Please try again.'));}
  finally{inFlight.current=false;setBusy(false);}
 },[endpoint]);
 useEffect(()=>{const timer=setTimeout(()=>void load(),0);return()=>clearTimeout(timer);},[load]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(focusId&&data)document.getElementById(focusId)?.scrollIntoView({block:'nearest'});},[focusId,data]);
 async function send(body:Record<string,unknown>){
  if(inFlight.current||!data||stale)return false;inFlight.current=true;setBusy(true);setError('');setNotice('');
  try{
   const response=await readWorkspaceResponse<State>(await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),clientQuotesResponse);
   if(!await matchesWorkspaceCommand(response,'quotes',body))throw Error('The action could not be confirmed. Refresh your quotes before retrying.');
   setData(response);setStale(false);setChecked({});
   setNotice(body.action==='accept'?'Your quote is accepted and your signature is saved.':body.action==='decline'?'Your decision has been saved.':body.action==='retry_email'?'Email status updated.':'Saved.');
   return true;
  }catch(cause){setStale(true);if(workspaceAccessDenied(cause))setData(null);setError(workspaceFailure(cause,'The action could not be completed. Refresh to check your quote.'));return false;}
  finally{inFlight.current=false;setBusy(false);}
 }
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,fd=new FormData(form),pdf=fd.get('pdf');
  if(!(pdf instanceof File)||!pdf.size||pdf.size>5_000_000){setError('Choose a PDF up to 5 MB.');return;}
  try{const bytes=new Uint8Array(await pdf.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));if(await send({action:'upload_terms',title:fd.get('title'),version:fd.get('version'),entityId:fd.get('entityId'),contentBase64:btoa(binary)}))form.reset();}
  catch{setError('The selected PDF could not be read.');}
 }
 function issue(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const fd=new FormData(event.currentTarget),order=data?.orders.find(row=>row.order_id===fd.get('orderId')),day=String(fd.get('expiresAt'));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)){setError('Choose a quote expiry date.');return;}
  void send({action:'issue',orderId:fd.get('orderId'),termsId:fd.get('termsId'),expiresAt:new Date(day+'T21:59:59Z').toISOString(),expectedSequence:order?.sequence??0});
 }
 return <section className={styles.shell} aria-busy={busy}>
  <Link href={operations?'/ops':'/client'}>Back to account</Link><header className={styles.heading}><div><h1>Quotes</h1><p>Review your cover, price and terms.</p></div><button disabled={busy} onClick={()=>void load()}>Refresh quotes</button></header>
  {!operations&&<p>Quote queries: <a href={'mailto:'+QUOTES_EMAIL}>{QUOTES_EMAIL}</a><br/>Billing queries: <a href={'mailto:'+INVOICE_EMAIL}>{INVOICE_EMAIL}</a></p>}
  {busy&&<p role="status">Loading or saving…</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{notice&&<p role="status" className={styles.status}>{notice}</p>}
  {stale&&data&&<p role="status">Your saved quotes are shown below. Refresh before making changes.</p>}
  {operations&&data&&<>
   <details><summary>Upload terms</summary><form className={styles.form} onSubmit={upload}>
    <label>Title<input name="title" required maxLength={200}/></label><label>Version<input name="version" required maxLength={80}/></label><label>Contracting entity<input name="entityId" required/></label><label>Terms PDF (up to 5 MB)<input name="pdf" type="file" accept="application/pdf,.pdf" required/></label><button className={styles.primary} disabled={busy||stale}>Upload terms</button>
   </form></details>
   {data.terms.map(term=><article className={styles.card} key={term.id}><h2>{term.title} · {term.version}</h2><p className={styles.status}>{term.withdrawn?'Withdrawn':term.approved_at?'Approved':'Awaiting approval'}</p><a href={file(term.id)}>Read terms PDF</a>
    {data.owner&&!term.approved_at&&!term.withdrawn&&<ConfirmAction label="Approve terms" disabled={busy||stale} acknowledgement="I have reviewed this exact terms PDF and approve it for client use." onConfirm={()=>send({action:'approve_terms',termsId:term.id,fileHash:term.file_hash,legalApprovalConfirmed:true})}/>}
    {data.owner&&!term.withdrawn&&<ConfirmAction label="Withdraw terms" reason="Reason" disabled={busy||stale} onConfirm={reason=>send({action:'withdraw_terms',termsId:term.id,reason})}/>}
   </article>)}
   <details><summary>Issue a quote</summary><form className={styles.form} onSubmit={issue}>
    <label>Service order<select name="orderId" required><option value="">Choose order</option>{data.orders.map(order=><option key={order.order_id} value={order.order_id}>{JSON.parse(order.source_json).clientName} · {JSON.parse(order.source_json).siteName}</option>)}</select></label>
    <label>Approved terms<select name="termsId" required><option value="">Choose terms</option>{data.terms.filter(term=>term.approved_at&&!term.withdrawn).map(term=><option key={term.id} value={term.id}>{term.title} · {term.version} · {term.entity_id}</option>)}</select></label>
    <label>Valid until (SAST)<input name="expiresAt" type="date" required/></label><button className={styles.primary} disabled={busy||stale||!data.orders.length||!data.terms.some(term=>term.approved_at&&!term.withdrawn)}>Issue quote</button>
   </form><p><Link href="/ops/service">Manage service orders</Link></p></details>
  </>}
  {data&&!data.quotes.length&&<article className={styles.card}><h2>No quotes yet</h2><p>Your quotes will appear here when LOKD has priced your cover.</p>{!operations&&<Link href="/client?view=request">Request cover</Link>}</article>}
  {focusId?.startsWith('QUOTE-')&&data&&!data.quotes.some(quote=>quote.id===focusId)&&<p role="status">This quote is not available in your account.</p>}
  {data?.quotes.map(quote=>{
   const newer=(quote.latest_sequence??quote.sequence)>quote.sequence||data.quotes.some(row=>row.order_id===quote.order_id&&row.sequence>quote.sequence),expired=!quote.receipt_json&&Date.parse(quote.expires_at)<=now,inactive=Boolean(quote.cancelled||quote.terms_withdrawn||newer);
   const signature=quote.receipt_json?JSON.parse(quote.receipt_json):null;
   return <article key={quote.id} id={quote.id} className={styles.card}>
    <h2>{quote.public_number??`Quote · revision ${quote.sequence}`}</h2><p className={styles.status}>{quote.declined?'Declined':inactive?'Withdrawn or superseded':signature?'Accepted':expired?'Expired':'Awaiting your decision'}</p>
    <Scope json={quote.source_json}/><p>Valid until {sast(quote.expires_at)} SAST.</p><p><a href={file(quote.terms_id)}>Read terms · {quote.terms_title}, {quote.terms_version} (PDF)</a></p>
    {!operations&&!inactive&&!expired&&!signature&&<>
     <form className={styles.form} onSubmit={event=>{event.preventDefault();void send({action:'accept',quoteId:quote.id,offerHash:quote.offer_hash,affirmative:checked[quote.id]===true});}}>
      <label className={styles.checkbox}><input type="checkbox" required checked={checked[quote.id]??false} onChange={event=>setChecked({...checked,[quote.id]:event.target.checked})}/><span>{data.acknowledgement}</span></label><button className={styles.primary} disabled={busy||stale||!checked[quote.id]}>Accept and sign</button>
     </form><ConfirmAction label="Decline quote" reason="Tell us why" disabled={busy||stale} onConfirm={reason=>send({action:'decline',quoteId:quote.id,offerHash:quote.offer_hash,reason})}/>
    </>}
    {signature&&<><p>Signed by {signature.signerName??JSON.parse(quote.source_json).contactName} on {sast(signature.acceptedAt)} SAST.</p><a className={styles.documentLink} href={receipt(quote.id)}>View signed agreement</a></>}
    {quote.email_delivery_state&&<p>Email: {quote.email_delivery_state==='sent'?'sent':quote.email_delivery_state==='queued'||quote.email_delivery_state==='retry_wait'?'awaiting delivery':quote.email_delivery_state==='dispatching'?'sending':quote.email_delivery_state==='uncertain'?'delivery unconfirmed':'could not be sent'}.</p>}
    {quote.email_delivery_error&&<p className={styles.error} role="status">{quote.email_delivery_error}</p>}
    {quote.email_delivery_state==='blocked'&&<button disabled={busy||stale} onClick={()=>void send({action:'retry_email',quoteId:quote.id})}>Retry email</button>}
    {operations&&!quote.cancelled&&<ConfirmAction label="Withdraw quote" reason="Reason" disabled={busy||stale} acknowledgement="I understand that a replacement quote needs fresh client acceptance." onConfirm={reason=>send({action:'cancel',quoteId:quote.id,reason})}/>}
   </article>;
  })}
  {!operations&&<><ClientAgreementPanel focusId={focusId}/><p><Link href="/client/agreements/records">Earlier signed agreements</Link></p></>}
 </section>;
}

export default function ClientQuotesPanel(props:{operations?:boolean;focusId?:string}){return <ClientQuotesPanelState key={String(Boolean(props.operations))} {...props}/>;}
