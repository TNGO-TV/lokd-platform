import {fetchWithoutRedirect} from './provider-fetch';
import {readRequestText} from './request-body';

export type OperationalRuntime = {
 LOKD_OPERATIONAL_DELIVERY_ENABLED?:string;
 LOKD_TEAM_EMAIL?:string;
 LOKD_EMAIL_PROVIDER?:string;
 LOKD_EMAIL_FROM?:string;
 LOKD_QUOTE_EMAIL_FROM?:string;
 RESEND_API_KEY?:string;
};
export class DeliveryError extends Error {
 code:string;
 disposition:'blocked'|'failed'|'retry_wait'|'cancelled'|'uncertain';
 constructor(code:string,disposition:DeliveryError['disposition']='blocked'){super(code);this.code=code;this.disposition=disposition;}
}
export const emailValid=(v:unknown):v is string=>typeof v==='string'&&v.length<=254&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v);

export async function providerJson(url:string,init:RequestInit,transport:typeof fetch=fetch):Promise<Record<string,unknown>>{
 let response:Response;
 try{response=await fetchWithoutRedirect(transport,url,{...init,signal:AbortSignal.timeout(15000)});}
 catch{throw new DeliveryError('provider_transport_unknown','retry_wait');}
 if(!response.ok){await response.body?.cancel();throw new DeliveryError(`provider_http_${response.status}`,response.status===401||response.status===403?'blocked':response.status===429||response.status>=500?'retry_wait':'failed');}
 try{const value:unknown=JSON.parse(await readRequestText(response,512_000));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value as Record<string,unknown>;}
 catch{throw new DeliveryError('provider_response_unknown','retry_wait');}
}
// Freeze provider selection inside the immutable request, never in mutable runtime alone.
// Each saved delivery keeps its selected provider and immutable message.
export function configuredEmailProvider(runtime:OperationalRuntime){
 if((!runtime.LOKD_EMAIL_PROVIDER||runtime.LOKD_EMAIL_PROVIDER==='resend')&&runtime.RESEND_API_KEY)return 'resend';
 throw new DeliveryError('email_provider_not_configured');
}
export async function sendEmail(runtime:OperationalRuntime,id:string,body:Record<string,unknown>,transport:typeof fetch){
 const provider=configuredEmailProvider(runtime);
 if(body._lokdProvider!==provider)throw new DeliveryError('email_provider_changed');
  const ids=[await sendResend(runtime,id,body,transport)];
  if(body._lokdConfirmation){
   if(typeof body._lokdConfirmation!=='object'||Array.isArray(body._lokdConfirmation))throw new DeliveryError('email_confirmation_invalid');
   ids.push(await sendResend(runtime,id+':confirmation',body._lokdConfirmation as Record<string,unknown>,transport));
  }
  return 'resend:'+ids.join(':');
}
async function sendResend(runtime:OperationalRuntime,id:string,body:Record<string,unknown>,transport:typeof fetch){
 if(!runtime.RESEND_API_KEY||!emailValid(body.from)||!Array.isArray(body.to)||body.to.length!==1||!emailValid(body.to[0])||typeof body.subject!=='string'||!body.subject.trim()||body.subject.length>200||/[\r\n]/.test(body.subject)||typeof body.text!=='string'||body.text.length>20000||!id||id.length>200)throw new DeliveryError('email_request_invalid');
 const result=await providerJson('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+runtime.RESEND_API_KEY,'content-type':'application/json','idempotency-key':id},body:JSON.stringify({from:body.from,to:body.to,subject:body.subject,text:body.text})},transport);
 if(typeof result.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(result.id))throw new DeliveryError('email_acceptance_unknown','uncertain');
 return result.id;
}
export async function emailReceipt(runtime:OperationalRuntime,body:Record<string,unknown>,id:string,providerId:string,recipient:string,transport:typeof fetch):Promise<'sent'|'delivered'|'failed'>{
 void id;void recipient;void transport;
 const provider=configuredEmailProvider(runtime);
 if(body._lokdProvider!==provider)throw new DeliveryError('email_provider_changed');
  const ids=providerId.split(':');
  if(ids.shift()!=='resend'||ids.length!==(body._lokdConfirmation?2:1)||ids.some(value=>!/^[a-zA-Z0-9_-]{1,100}$/.test(value)))throw new DeliveryError('email_receipt_mismatch');
  const messages=[body,...(body._lokdConfirmation?[body._lokdConfirmation as Record<string,unknown>]:[])];
  let delivered=true;
  for(let index=0;index<ids.length;index++){
   const result=await providerJson('https://api.resend.com/emails/'+ids[index],{headers:{authorization:'Bearer '+runtime.RESEND_API_KEY}},transport);
   const expected=messages[index];
   if(result.id!==ids[index]||result.from!==expected.from||!Array.isArray(result.to)||JSON.stringify(result.to)!==JSON.stringify(expected.to)||result.subject!==expected.subject)throw new DeliveryError('email_receipt_mismatch');
   if(['bounced','complained','failed','suppressed'].includes(String(result.last_event)))throw new DeliveryError('email_delivery_failed','failed');
   delivered=delivered&&['delivered','opened','clicked'].includes(String(result.last_event));
  }
  return delivered?'delivered':'sent';
}
