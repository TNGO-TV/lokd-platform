'use client';
import { useAuth, useClerk, useReverification } from '@clerk/react';
import { useState,useRef } from 'react';
import Link from 'next/link';
export default function OperationsSecurity({mfaRequired = true}: {mfaRequired?: boolean}) {
  const {openUserProfile} = useClerk();
  const {getToken,isLoaded} = useAuth();
  const [message,setMessage] = useState(mfaRequired ? 'Enrol an authenticator, then verify your second factor before changing live Operations records.' : 'MFA is temporarily not required by the owner. Sign-in, assigned roles, approval limits and independent reviewers are still required.');
  const requestLock=useRef(false);
  const [busy,setBusy] = useState(false);
  const verify = useReverification(async () => {
    const token = await getToken({skipCache:true});
    const response = await fetch('/api/operations/security?verify=1',{headers:{authorization:`Bearer ${token}`},cache:'no-store'});
    const result:unknown=await response.json();
    // Clerk must receive its 403 challenge unchanged so it can prompt and retry.
    if(response.status===403&&result&&typeof result==='object'&&'clerk_error' in result){const hint=result.clerk_error;if(hint&&typeof hint==='object'&&'type' in hint&&hint.type==='forbidden'&&'reason' in hint&&hint.reason==='reverification-error')return result;}
    if(!response.ok)throw new Error('Verification did not complete.');
    if(!result||typeof result!=='object'||!('fresh' in result)||typeof result.fresh!=='boolean'||!('enrolled' in result)||typeof result.enrolled!=='boolean'||!('required' in result)||typeof result.required!=='boolean'||!('maxAgeMinutes' in result)||result.maxAgeMinutes!==5||!('verifiedAt' in result)||(result.verifiedAt!==null&&typeof result.verifiedAt!=='string'))throw new Error('Verification response is incomplete.');
    return result;
  });
  async function refresh() {
    if(requestLock.current||!isLoaded)return;requestLock.current=true;setBusy(true);
    try {
      const result = await verify();
      setMessage(result&&typeof result==='object'&&'fresh' in result&&result.fresh===true&&'enrolled' in result&&result.enrolled===true&&'verifiedAt' in result&&typeof result.verifiedAt==='string'&&Date.now()-Date.parse(result.verifiedAt)>=0&&Date.now()-Date.parse(result.verifiedAt)<5*60_000 ? 'Second factor verified. Live Operations changes are available while this proof is current; your assigned permissions still apply.' : 'Verification did not complete. Live changes remain blocked.');
    } catch {setMessage('Verification cancelled or unavailable. Live changes remain blocked.');}
    finally {requestLock.current=false;setBusy(false);}
  }
  return <main style={{maxWidth:720,margin:'4rem auto',padding:'1.5rem'}}>
    <Link href="/ops">← Operations</Link><h1>Operations account security</h1>
    <p>{mfaRequired ? "Use an authenticator app and keep your recovery codes somewhere secure. An email sign-in code alone does not satisfy Operations MFA." : "Operations MFA is temporarily off. This does not mark your account as MFA-verified or unlock payments or service activation."}</p>
    <p role="status">{message}</p>
    <button className="public-button public-button--dark" onClick={()=>openUserProfile()}>{mfaRequired ? "Manage authenticator and recovery codes" : "Manage account security"}</button>{' '}
    {mfaRequired && <button className="public-button public-button--outline-dark" disabled={busy || !isLoaded} onClick={()=>void refresh()}>{busy?'Checking…':'Verify second factor'}</button>}
    <p>{mfaRequired ? "Verification expires within five minutes. " : ""} Financial approvals also require the assigned role, approval limits and independent reviewers. Demo rehearsals do not prove live approval.</p>
  </main>;
}
