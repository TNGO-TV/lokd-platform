'use client';
import {useTestSurface} from './test-surface-context';
import {useState,useEffect,useRef,useSyncExternalStore} from 'react';
const subscribeToHydration=()=>()=>{};
const clientReady=()=>true;
const serverReady=()=>false;
type Session={sessionId:string;consentRevision:number};
async function presenceRequest(body:Record<string,unknown>){
 const r=await fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 let d:Record<string,unknown>;
 try{d=await r.json();}catch{throw Error('Sharing could not be confirmed. Stop sharing before trying again.');}
 if(!r.ok)throw Error(typeof d?.error==='string'?d.error:'Sharing could not be confirmed. Stop before trying again.');
 if(!d||d.mode!==body.mode
  ||body.action==='state'&&(!Number.isSafeInteger(d.revision)||Number(d.revision)<0)
  ||body.action==='start'&&(typeof d.sessionId!=='string'||!/^[0-9a-f-]{36}$/i.test(d.sessionId)||d.consentRevision!==Number(body.expectedRevision)+1)
  ||body.action==='share'&&(d.sharing!==true||typeof d.expiresAt!=='string'||!Number.isFinite(Date.parse(d.expiresAt)))
  ||body.action==='stop'&&d.sharing!==false)throw Error('The sharing response could not be verified. Stop before trying again.');
 return d;
}
export default function OfficerPresencePanel(){
 const testTools=useTestSurface(),ready=useSyncExternalStore(subscribeToHydration,clientReady,serverReady);
 const [sharing,setSharing]=useState(false),[busy,setBusy]=useState(false),[stopping,setStopping]=useState(false),[message,setMessage]=useState(''),[consent,setConsent]=useState(false);
 const generation=useRef(0),activeShare=useRef<object|null>(null),stopLock=useRef(false),consentRef=useRef(false),sharingRef=useRef(false),session=useRef<Session|null>(null);
 async function update(test=false){
  if(activeShare.current||stopLock.current||(!test&&!consentRef.current))return;
  const operation={},epoch=generation.current,mode=test?'test':'live';
  const current=()=>generation.current===epoch&&activeShare.current===operation&&(test||consentRef.current);
  activeShare.current=operation;setBusy(true);
  try{
   let bound=test?null:session.current;
   if(!bound){
    const state=await presenceRequest({action:'state',mode});if(!current())return;
    const started=await presenceRequest({action:'start',mode,consent:true,expectedRevision:state.revision});if(!current())return;
    bound={sessionId:String(started.sessionId),consentRevision:Number(started.consentRevision)};
    if(!test)session.current=bound;
   }
   let coords={latitude:-26.2,longitude:28};
   if(!test){
    coords=await new Promise<GeolocationCoordinates>((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),()=>reject(Error('Location permission denied or unavailable. Nothing was shared.')),{enableHighAccuracy:false,timeout:10000,maximumAge:30000}));
    if(!current())return;
   }
   await presenceRequest({action:'share',mode,consent:true,...bound,latitude:Math.round(coords.latitude*10)/10,longitude:Math.round(coords.longitude*10)/10});if(!current())return;
   setMessage(test?'Synthetic test signal saved privately. It cannot appear on the public map.':'Approximate presence shared. It expires in three minutes unless refreshed.');
   if(!test){sharingRef.current=true;setSharing(true);}
  }catch(error){if(!current())return;setMessage(error instanceof Error?error.message:'Sharing could not be confirmed. Stop before trying again.');if(!test){sharingRef.current=false;setSharing(false);}}
  finally{if(activeShare.current===operation){activeShare.current=null;setBusy(false);}}
 }
 async function stop(){
  if(stopLock.current)return;
  // Revoke refresh now; the durable server revision rejects dispatched old writes.
  stopLock.current=true;generation.current++;activeShare.current=null;
  consentRef.current=false;sharingRef.current=false;session.current=null;
  setConsent(false);setSharing(false);setBusy(true);setStopping(true);
  try{await presenceRequest({action:'stop',mode:'live'});setMessage('Public sharing stopped.');}
  catch{setMessage('Stop could not be confirmed. This page has stopped refreshing. Sharing may continue from another open page or session. Retry Stop to confirm public sharing has stopped.');}
  finally{stopLock.current=false;setBusy(false);setStopping(false);}
 }
 useEffect(()=>{if(!sharing)return;const timer=setInterval(()=>{if(document.visibilityState==='visible'&&sharingRef.current&&consentRef.current&&!stopLock.current)void update();},60000);return()=>clearInterval(timer);});
 useEffect(()=>()=>{generation.current++;activeShare.current=null;sharingRef.current=false;consentRef.current=false;},[]);
 return <section><h2>Officer presence sharing</h2><p>Live sharing publishes only an approximate area, about 11 km across, without your name. It requires an assigned officer account and a current checked-in assignment. While this page is open and visible, sharing refreshes each minute; signals expire after three minutes.</p><label><input type="checkbox" checked={consent} disabled={!ready||sharing||busy} onChange={e=>{consentRef.current=e.target.checked;setConsent(e.target.checked);}}/> I consent to publishing my approximate area on the LOKD homepage while sharing is enabled.</label><p><button disabled={!ready||busy||!consent} onClick={()=>void update()}>Share or refresh live presence</button> <button disabled={!ready||stopping} onClick={()=>void stop()}>{stopping?'Stopping…':'Stop public sharing'}</button></p>{testTools&&<details><summary>Presence testing</summary><p>Private synthetic signals never appear on the public map.</p><button disabled={!ready||busy} onClick={()=>void update(true)}>Send a private synthetic test signal</button></details>}{message&&<p role="status">{message}</p>}</section>;
}
