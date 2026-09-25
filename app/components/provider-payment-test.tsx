'use client';
import {useEffect,useRef,useState} from 'react';
import type {ProviderTest} from '../lib/provider-acceptance-test';
import ActionConfirmation from './action-confirmation';
import styles from './signup-portal.module.css';
type Snapshot={rows:ProviderTest[];version:string;amountMinor:number;currency:string;mode:'test';financialEffect:false};
const scenarios=[{id:'success',title:'Successful test payment'},{id:'decline',title:'Declined test payment'},{id:'cancel',title:'Cancelled checkout'}];
export default function ProviderPaymentTest(){
 const [data,setData]=useState<Snapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const lock=useRef(false);
 useEffect(()=>{let active=true;fetch('/api/provider-test',{cache:'no-store'}).then(async r=>{const b=await r.json() as Snapshot & {error?:string};if(!active)return;if(!r.ok)throw Error(b.error);setData(b);}).catch(e=>{if(active)setError(e.message||'The saved checks could not be loaded.');});return()=>{active=false;};},[]);
 async function act(input:Record<string,unknown>){
  if(lock.current)return false;lock.current=true;setBusy(true);setError('');
  try{const r=await fetch('/api/provider-test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});const b=await r.json() as Snapshot & {error?:string};if(!r.ok){if(r.status===401||r.status===403)setData(null);throw Error(b.error);}setData(b);return true;}
  catch(e){setError(e instanceof Error?e.message:'The check failed. Keep the existing reference.');return false;}
  finally{lock.current=false;setBusy(false);}
 }
 return <main className={styles.shell}><div className={styles.heading}><p>OWNER · PROVIDER ACCEPTANCE</p><h1>Paystack TEST checkout</h1><p>Check the real provider connection using R1.00 in TEST mode. Use Paystack test cards only. These checks do not fund an order, issue an invoice or approve service.</p></div>
 <p className={styles.boundary}>A browser return is not proof of payment. A successful check requires Paystack verification and a matching signed webhook. One saved checkout per scenario prevents duplicate requests.</p>
 {error&&<p role="alert" className={styles.error}>{error}</p>}{!data&&!error&&<p role="status">Loading saved checks…</p>}
 {data&&scenarios.map(s=>{const row=data.rows.find(r=>r.scenario===s.id);return <section key={s.id} className={styles.card}><h2>{s.title}</h2>{row?<><p><strong>{row.state.replaceAll('_',' ')}</strong></p><p>{row.note||'The original checkout request is saved.'}</p><dl className={styles.details}><div><dt>Test reference</dt><dd>{row.reference}</dd></div><div><dt>Provider status</dt><dd>{row.provider_status||'Not checked'}</dd></div><div><dt>Signed success webhook</dt><dd>{row.webhook_hash?'Matched':'Not matched'}</dd></div><div><dt>Last update</dt><dd>{row.updated_at}</dd></div></dl><div className={styles.actions}>{row.checkout_url&&!['verified_test','review_required','reversed'].includes(row.state)&&<a className={styles.primary} href={row.checkout_url} target="_blank" rel="noopener noreferrer">Open {s.id} TEST checkout</a>}<button disabled={busy} onClick={()=>void act({action:'reconcile',reference:row.reference,expectedRevision:row.revision})}>{busy?'Checking…':'Check '+s.id+' provider result'}</button></div></>:<ActionConfirmation disabled={busy} label={'Prepare '+s.id+' TEST checkout'} acknowledgement="I will use Paystack test cards only. This R1.00 TEST check has no live financial or service effect." onConfirm={()=>act({action:'initialize',scenario:s.id,version:data.version,testOnlyAcknowledged:true})}/>}</section>;})}
 <p><a href="https://paystack.com/docs/payments/test-payments/" target="_blank" rel="noopener noreferrer">Paystack’s official test cards</a></p></main>;
}
