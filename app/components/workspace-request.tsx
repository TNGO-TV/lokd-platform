'use client';
import {usePathname,useSearchParams} from 'next/navigation';
import styles from './signup-portal.module.css';

const guidance:Record<number,string>={
  401:'Your session has expired. Sign in again, then refresh this page.',
  403:'This account cannot perform this action. Ask Operations to check the account and its assigned access.',
  409:'The record or its evidence has changed. Keep a copy of unsaved details, refresh the current status and review it before acting again.',
  423:'This action is locked. Review the outstanding requirements with Operations before continuing.',
  503:'The service is temporarily unavailable. The outcome may be unknown. Refresh the saved status before repeating an action; keep the original payment or request reference.',
};
export class WorkspaceResponseError extends Error {constructor(message:string,public status:number){super(message);this.name='WorkspaceResponseError';}}
export const workspaceAccessDenied=(cause:unknown)=>cause instanceof WorkspaceResponseError&&[401,403].includes(cause.status);
export async function readWorkspaceResponse<T>(response:Response):Promise<T>{
  let body:unknown;
  try{body=await response.json();}catch{throw new WorkspaceResponseError(guidance[response.status]??'The server returned an unreadable response. The outcome may be unknown. Refresh the saved status before repeating an action; keep the original request reference.',response.status);}
  if(!response.ok){
    const detail=body&&typeof body==='object'&&'error' in body&&typeof body.error==='string'?body.error:'';
    throw new WorkspaceResponseError([detail,guidance[response.status]??'Refresh the saved status and review it before acting again.'].filter(Boolean).join(' '),response.status);
  }
  return body as T;
}
export function workspaceFailure(cause:unknown,fallback:string){return cause instanceof TypeError?'The connection failed. The outcome may be unknown. Refresh the saved status before repeating an action; keep the original request reference.':cause instanceof Error?cause.message:fallback;}
export function WorkspaceRequestError({message}:{message:string}){
  const path=usePathname(),query=useSearchParams().toString();
  return <div className={styles.error} role="alert"><p>{message}</p>{message.includes(guidance[401])&&<a href={`/sign-in?return_to=${encodeURIComponent(path+(query?'?'+query:''))}`}>Sign in again</a>}<p>A failed write is not proof that nothing was saved. Check current access and the original record before retrying.</p></div>;
}

export function WorkspaceAccessLost({message,refresh,loading}:{message:string;refresh:()=>void;loading:boolean}){return <main className={styles.shell}><h1>Workspace access unavailable</h1><WorkspaceRequestError message={message}/><p>Private records and source-bound drafts were cleared. After access returns, inspect the original records before preparing another request.</p><button disabled={loading} onClick={refresh}>Refresh workspace access</button></main>;}
