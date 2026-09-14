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
export async function readWorkspaceResponse<T>(response:Response):Promise<T>{
  let body:unknown;
  try{body=await response.json();}catch{throw new Error(guidance[response.status]??'The server returned an unreadable response. The outcome may be unknown. Refresh the saved status before repeating an action; keep the original request reference.');}
  if(!response.ok){
    const detail=body&&typeof body==='object'&&'error' in body&&typeof body.error==='string'?body.error:'';
    throw new Error([detail,guidance[response.status]??'Refresh the saved status and review it before acting again.'].filter(Boolean).join(' '));
  }
  return body as T;
}
export function workspaceFailure(cause:unknown,fallback:string){return cause instanceof TypeError?'The connection failed. The outcome may be unknown. Refresh the saved status before repeating an action; keep the original request reference.':cause instanceof Error?cause.message:fallback;}
export function WorkspaceRequestError({message}:{message:string}){
  const path=usePathname(),query=useSearchParams().toString();
  return <div className={styles.error} role="alert"><p>{message}</p>{message.includes(guidance[401])&&<a href={`/sign-in?return_to=${encodeURIComponent(path+(query?'?'+query:''))}`}>Sign in again</a>}<p>A failed request does not clear these forms. Copy unsaved inputs before leaving or loading a newer record.</p></div>;
}
