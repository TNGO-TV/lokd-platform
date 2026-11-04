'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
type Application={id:string;fullName:string;status:string;createdAt:string;enrolmentStatus?:string|null;confirmationEmailStatus?:string;confirmationEmailError?:string|null};
export function OnboardingControl({flash}:{flash:(message:string)=>void}){
 const [applications,setApplications]=useState<Application[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState('');
 const generation=useRef(0),lock=useRef(false);
 const refresh=useCallback(async()=>{
  const current=++generation.current;setLoading(true);setError('');
  try{const response=await fetch('/api/applications',{cache:'no-store'});const body=await response.json() as {applications?:Application[];error?:string;sent?:boolean};if(!response.ok||!Array.isArray(body.applications))throw Error(body.error??'Applications could not be loaded.');if(current===generation.current)setApplications(body.applications);}
  catch(cause){if(current===generation.current){setApplications([]);setError(cause instanceof Error?cause.message:'Applications could not be loaded.');}}
  finally{if(current===generation.current)setLoading(false);}
 },[]);
 useEffect(()=>{
  const lifecycle=generation;
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void refresh();return()=>{lifecycle.current++;};
 },[refresh]);
 async function retry(id:string){
  if(lock.current)return;lock.current=true;setBusy(id);setError('');
  try{const response=await fetch('/api/applications',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,action:'retry_confirmation'})});const body=await response.json() as {applications?:Application[];error?:string;sent?:boolean};if(!response.ok||body.sent!==true)throw Error(body.error??'Email delivery could not be confirmed.');flash('Confirmation email sent.');await refresh();}
  catch(cause){setError(cause instanceof Error?cause.message:'Email delivery could not be confirmed.');}
  finally{lock.current=false;setBusy('');}
 }
 return <section className="onboarding-control"><h1>Officer applications</h1><p>Review applications and follow up on missing information.</p>{error&&<p role="alert">{error}</p>}<button disabled={loading||!!busy} onClick={()=>void refresh()}>Refresh applications</button>{loading?<p role="status">Loading applications…</p>:!applications.length&&!error?<p>No officer applications yet.</p>:<ul>{applications.map(item=><li key={item.id}><h2>{item.fullName}</h2><p>{item.status.replaceAll('_',' ')} · {new Date(item.createdAt).toLocaleDateString('en-ZA')}</p><a href={'/ops/intake?kind=officer&id='+encodeURIComponent(item.id)}>Review application</a>{item.enrolmentStatus&&<p>Enrolment: {item.enrolmentStatus}</p>}{item.confirmationEmailStatus&&<p>Confirmation email: {item.confirmationEmailStatus}</p>}{item.confirmationEmailError&&<p role="alert">{item.confirmationEmailError}</p>}{item.confirmationEmailStatus&&item.confirmationEmailStatus!=='sent'&&<button disabled={!!busy||loading} onClick={()=>void retry(item.id)}>{busy===item.id?'Sending…':'Retry confirmation email'}</button>}</li>)}</ul>}</section>;
}
