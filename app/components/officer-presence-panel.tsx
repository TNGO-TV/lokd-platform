'use client';
import {useState,useEffect,useRef,useSyncExternalStore} from 'react';
const subscribeToHydration=()=>()=>{};
const clientReady=()=>true;
const serverReady=()=>false;
export default function OfficerPresencePanel(){
 const ready=useSyncExternalStore(subscribeToHydration,clientReady,serverReady);
 const [sharing,setSharing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[consent,setConsent]=useState(false);const inFlight=useRef(false);
 async function request(body:Record<string,unknown>){const r=await fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json() as {error?:string};if(!r.ok)throw Error(d.error);}
 async function update(test=false){if(inFlight.current)return;inFlight.current=true;setBusy(true);try{let coords={latitude:-26.2,longitude:28};if(!test){if(!consent)throw Error('Confirm public approximate-location consent first.');coords=await new Promise<GeolocationCoordinates>((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),()=>reject(Error('Location permission denied or unavailable. Nothing was shared.')),{enableHighAccuracy:false,timeout:10000,maximumAge:30000}));}
 await request({action:'share',mode:test?'test':'live',consent:true,latitude:Math.round(coords.latitude*10)/10,longitude:Math.round(coords.longitude*10)/10});setMessage(test?'Synthetic test signal saved privately. It cannot appear on the public map.':'Approximate presence shared. It expires in three minutes unless refreshed.');if(!test)setSharing(true);
 }catch(e){setMessage(e instanceof Error?e.message:'Sharing failed.');setSharing(false);}finally{inFlight.current=false;setBusy(false);}}
 async function stop(){if(inFlight.current)return;setBusy(true);try{await request({action:'stop',mode:'live'});setSharing(false);setConsent(false);setMessage('Public sharing stopped.');}catch{setMessage('Stop could not be confirmed. The last signal expires within three minutes.');setSharing(false);}finally{setBusy(false);}}
 useEffect(()=>{if(!sharing)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')void update();},60000);return()=>clearInterval(timer);});
 return <section><h2>Officer presence sharing</h2><p>Live sharing publishes only an approximate area, about 11 km across, without your name. It requires an assigned officer account and a current checked-in assignment. While this page is open and visible, sharing refreshes each minute; signals expire after three minutes.</p><label><input type="checkbox" checked={consent} disabled={!ready||sharing||busy} onChange={e=>setConsent(e.target.checked)}/> I consent to publishing my approximate area on the LOKD homepage while sharing is enabled.</label><p><button disabled={!ready||busy||!consent} onClick={()=>void update()}>Share or refresh live presence</button> <button disabled={!ready||busy} onClick={()=>void stop()}>Stop public sharing</button></p>{message&&<p role="status">{message}</p>}</section>;
}
