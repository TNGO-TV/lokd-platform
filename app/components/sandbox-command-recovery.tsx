'use client';
import {useState} from 'react';
import {readWorkspaceResponse,workspaceAccessDenied,workspaceFailure} from './workspace-request';
export default function SandboxCommandRecovery({scope,getBody,endpoint,onRecovered,onDenied,onRejected}:{scope:string;getBody:()=>string|null;endpoint:string;onRecovered:(result:Record<string,unknown>)=>void;onDenied:()=>void;onRejected:()=>void}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function recover(retry=false){const body=getBody();if(busy||!body)return;setBusy(true);setMessage('');try{
 const original=JSON.parse(body) as {requestKey:string};
 const response=await fetch(retry?endpoint:'/api/sandbox/discovery?'+new URLSearchParams({view:'command',scope,requestKey:original.requestKey}),retry?{method:'POST',headers:{'content-type':'application/json'},body}:{cache:'no-store'});
 const envelope=await readWorkspaceResponse<{mode:string;policyVersion:string;productionWorkEligible:boolean;commandStatus?:string;data:Record<string,unknown>|null}>(response);
 if(!['sandbox','simulator'].includes(envelope.mode)||envelope.policyVersion!=='lokd-sandbox-completion-v1'||envelope.productionWorkEligible!==false)throw Error('The isolated recovery boundary could not be verified.');
 if(retry){if(response.status===202||envelope.commandStatus==='pending'||!envelope.data){setMessage('The original command is pending. Refresh its receipt; a replacement cannot be submitted.');return;}onRecovered(envelope.data);return;}
 if(!envelope.data)throw Error('No original command receipt was returned.');
 if(envelope.data.status==='failed'){onRejected();return;}
 if(envelope.data.status==='completed'&&envelope.data.result){onRecovered(envelope.data.result as Record<string,unknown>);return;}
 setMessage('The original command is pending. Refresh its receipt; a replacement cannot be submitted.');
 }catch(cause){if(workspaceAccessDenied(cause))onDenied();setMessage(workspaceFailure(cause,'Unable to recover the original receipt.'));}finally{setBusy(false);}}
 return <div><button type="button" disabled={busy} onClick={()=>void recover()}>Recover original submission</button><button type="button" disabled={busy} onClick={()=>void recover(true)}>Retry exact original submission</button>{message&&<p role="status">{message}</p>}</div>;
}
