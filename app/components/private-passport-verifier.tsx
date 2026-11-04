'use client';
import type {PublicPassport} from '../lib/passport-server';
import {publicPassportResponse} from '../lib/workspace-response-contracts';
export type PassportResponse={passport:PublicPassport};
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
export default function PrivatePassportVerifier(){
 const token=useRef('');const [result,setResult]=useState<PublicPassport|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[valid,setValid]=useState(false);
 useEffect(()=>{
  if(location.hash){token.current=new URLSearchParams(location.hash.slice(1)).get('token')??'';history.replaceState(history.state,'',location.pathname);}
  const controller=new AbortController();let active=true;
  const timer=setTimeout(()=>{
   setResult(null);
   if(!/^lokd_live_[0-9a-f]{64}$/.test(token.current)){setError('Open a LOKD Passport link or scan the officer’s QR code.');return;}
   setValid(true);setBusy(true);setError('');
   void fetch('/api/passport/verify',{method:'POST',headers:{'content-type':'application/json'},cache:'no-store',signal:controller.signal,body:JSON.stringify({token:token.current})}).then(async response=>{
    if(!response.ok)throw new Error(response.status===503?'Verification is temporarily unavailable. Try again.':'This passport could not be verified. Contact LOKD Operations.');
    const payload:unknown=await response.json();if(!publicPassportResponse(payload))throw new Error('Verification is temporarily unavailable. Try again.');
    return payload as PassportResponse;
   }).then(payload=>{if(active)setResult(payload.passport);}).catch(cause=>{if(active)setError(cause instanceof TypeError?'The connection failed. Try again.':cause instanceof Error?cause.message:'Passport verification is unavailable.');}).finally(()=>{if(active)setBusy(false);});
  },0);
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[attempt]);
 return <main className="passport-verify-shell"><header><Link href="/">LOKD</Link><span>Officer verification</span></header><section className="officer-section-card"><h1>LOKD Passport</h1>{busy&&<p role="status">Checking current passport…</p>}{error&&<p role="alert">{error}</p>}{result&&<><p role="status"><strong>{result.result==='green'?'Current':result.status==='revoked'?'Revoked':result.status==='suspended'?'Suspended':'Review required'}</strong></p><h2>{result.officerName}</h2><p>{result.passportNumber}</p><dl><dt>Passport status</dt><dd>{result.status.replaceAll('_',' ')}</dd><dt>Your PSIRA status</dt><dd>{result.psiraGrade} · {result.psiraCurrent?'Current':'Expired'}</dd><dt>Last reviewed</dt><dd>{result.lastReviewedAt?.slice(0,10)??'Not recorded'}</dd><dt>Next review</dt><dd>{result.nextReviewAt?.slice(0,10)??'Not recorded'}</dd></dl><p>{result.message}</p>{result.endorsements.length>0&&<><h3>Qualifications</h3><ul>{result.endorsements.map(item=><li key={item.id}>{item.label}{item.expiresAt?` · Expires ${item.expiresAt.slice(0,10)}`:''}</li>)}</ul></>}<p>Check the officer’s photo identification and assignment with LOKD Operations before work starts.</p></>}<button className="public-button public-button--dark" disabled={busy||!valid} onClick={()=>setAttempt(a=>a+1)}>Refresh verification</button><p><Link href="/">Return to LOKD</Link></p></section></main>;
}
