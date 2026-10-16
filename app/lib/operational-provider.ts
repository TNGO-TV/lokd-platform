import {fetchWithoutRedirect} from './provider-fetch';
import {readRequestText} from './request-body';

export type OperationalRuntime = {
 LOKD_OPERATIONAL_DELIVERY_ENABLED?:string;
 LOKD_DELIVERY_SOURCE_ALLOWLIST?:string;
 LOKD_DELIVERY_EMAIL_ALLOWLIST?:string;
 LOKD_TEAM_EMAIL?:string;
 LOKD_EMAIL_PROVIDER?:string;
 LOKD_EMAIL_FROM?:string;
 LOKD_QUOTE_EMAIL_FROM?:string;
 CLERK_SECRET_KEY?:string;
 LOKD_ODOO_API_KEY?:string;
 LOKD_ODOO_COMPANY_ID?:string;
 LOKD_ODOO_JSON2_ORIGIN?:string;
 LOKD_SMTP_HOST?:string;
 LOKD_SMTP_PORT?:string;
 LOKD_SMTP_USER?:string;
 LOKD_SMTP_PASSWORD?:string;
 // Optional authenticated HTTPS relay on ZA when Workers TCP to cPanel is blocked.
 LOKD_SMTP_RELAY_URL?:string;
 LOKD_SMTP_RELAY_TOKEN?:string;
};
export class DeliveryError extends Error {
 code:string;
 disposition:'blocked'|'failed'|'retry_wait'|'cancelled'|'uncertain';
 constructor(code:string,disposition:DeliveryError['disposition']='blocked'){super(code);this.code=code;this.disposition=disposition;}
}
export function allowlisted(list:string|undefined,value:string){return (list??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(value.toLowerCase());}
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
// Product email is SMTP (mail.lokd.co.za) or disabled. cpanel is the same SMTP submission.
function smtpConfigured(runtime:OperationalRuntime){
 return Boolean(runtime.LOKD_SMTP_HOST&&runtime.LOKD_SMTP_USER&&runtime.LOKD_SMTP_PASSWORD&&(runtime.LOKD_SMTP_RELAY_URL?runtime.LOKD_SMTP_RELAY_TOKEN:true));
}
export function configuredEmailProvider(runtime:OperationalRuntime){
 if((runtime.LOKD_EMAIL_PROVIDER==='smtp'||runtime.LOKD_EMAIL_PROVIDER==='cpanel')&&smtpConfigured(runtime))return runtime.LOKD_EMAIL_PROVIDER;
 throw new DeliveryError('email_provider_not_configured');
}
function b64(value:string){return btoa(value);}
function smtpDotStuff(text:string){return text.replace(/\r?\n/g,'\r\n').split('\r\n').map(line=>line.startsWith('.')?'.'+line:line).join('\r\n');}
export const SMTP_LIMITS=Object.freeze({connectMs:10_000,readMs:10_000,writeMs:10_000,totalMs:45_000,lineBytes:4096,responseLines:64,responseBytes:65_536,totalBytes:131_072,messageBytes:1_048_576});
type SmtpConnect=typeof import('cloudflare:sockets')['connect'];
// Connector and limits are injectable only by in-process tests, never by request input.
export async function sendSmtpOverSocket(runtime:OperationalRuntime,id:string,body:Record<string,unknown>,connector?:SmtpConnect,limits=SMTP_LIMITS):Promise<string>{
 const host=runtime.LOKD_SMTP_HOST!;
 const port=Number(runtime.LOKD_SMTP_PORT||'465');
 if(!Number.isInteger(port)||port<1||port>65535||port===25)throw new DeliveryError('smtp_port_not_allowed');
 const user=runtime.LOKD_SMTP_USER!;
 const pass=runtime.LOKD_SMTP_PASSWORD!;
 const from=String(body.from??'');
 const recipients=Array.isArray(body.to)?body.to.map(String):[];
 if(!emailValid(from)||recipients.length!==1||!emailValid(recipients[0]))throw new DeliveryError('smtp_envelope_invalid');
 const subject=String(body.subject??'');
 const text=String(body.text??'');
 if(!/^[A-Za-z0-9:_-]{1,160}$/.test(id)||subject.length>998||text.length>limits.messageBytes||user.length>254||pass.length>4096)throw new DeliveryError('smtp_message_too_large');
 const marker=`LOKD-WORKER-SMTP-${id}`;
 const mime=[`From: ${from}`,`To: ${recipients[0]}`,`Subject: ${subject.replace(/[\r\n]+/g,' ')}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8',
  `Message-ID: <${id.replace(/[^A-Za-z0-9_-]/g,'_')}@lokd.co.za>`,`X-LOKD-Delivery-Id: ${id}`,`X-LOKD-Marker: ${marker}`,'',smtpDotStuff(text),''].join('\r\n');
 const encoder=new TextEncoder();
 if(encoder.encode(mime+'.\r\n').byteLength>limits.messageBytes)throw new DeliveryError('smtp_message_too_large');
 const connect=connector??(await import('cloudflare:sockets')).connect;
 const useStartTls=port===587;
 const deadline=performance.now()+limits.totalMs;
 let socket:ReturnType<SmtpConnect>|undefined;
 let writer:WritableStreamDefaultWriter<Uint8Array>|undefined;
 let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
 let buffered=new Uint8Array(0),received=0;
 const uncertain=(code:string)=>new DeliveryError(code,'uncertain');
 async function bounded<T>(operation:Promise<T>,ms:number,code:string):Promise<T>{
  const remaining=deadline-performance.now();
  // Observe rejection even if the total deadline has already elapsed.
  if(remaining<=0){void operation.catch(()=>undefined);throw uncertain('smtp_total_timeout');}
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([operation,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(uncertain(remaining<=ms?'smtp_total_timeout':code)),Math.min(remaining,ms));})]);}
  finally{clearTimeout(timer);}
 }
 async function readLine():Promise<string>{
  while(true){
   let end=-1;for(let i=0;i+1<buffered.length;i++)if(buffered[i]===13&&buffered[i+1]===10){end=i;break;}
   if(end>=0){
    if(end+2>limits.lineBytes)throw uncertain('smtp_line_too_large');
    const line=new TextDecoder().decode(buffered.subarray(0,end));buffered=buffered.slice(end+2);return line;
   }
   if(buffered.length>=limits.lineBytes)throw uncertain('smtp_line_too_large');
   const result=await bounded(reader!.read(),limits.readMs,'smtp_read_timeout');
   if(result.done)throw uncertain('smtp_connection_closed');
   received+=result.value.byteLength;
   if(received>limits.totalBytes)throw uncertain('smtp_protocol_too_large');
   const joined=new Uint8Array(buffered.length+result.value.length);joined.set(buffered);joined.set(result.value,buffered.length);buffered=joined;
  }
 }
 async function expect(codes:number[]):Promise<string>{
  let code:number|undefined,bytes=0;
  for(let count=0;count<limits.responseLines;count++){
   const line=await readLine();bytes+=encoder.encode(line).byteLength+2;
   if(bytes>limits.responseBytes)throw uncertain('smtp_response_too_large');
   const match=/^(\d{3})([ -])/.exec(line);
   if(!match||(code!==undefined&&code!==Number(match[1])))throw uncertain('smtp_protocol_invalid');
   code=Number(match[1]);
   if(match[2]==='-')continue;
   if(!codes.includes(code))throw new DeliveryError(`smtp_reject_${code}`,code===421||code===450||code===451?'uncertain':'failed');
   return line;
  }
  throw uncertain('smtp_response_too_many_lines');
 }
 const write=(line:string)=>bounded(writer!.write(encoder.encode(line+'\r\n')),limits.writeMs,'smtp_write_timeout');
 try{
  socket=connect({hostname:host,port},{secureTransport:useStartTls?'starttls':'on',allowHalfOpen:false});
  await bounded(socket.opened,limits.connectMs,'smtp_connect_timeout');
  writer=socket.writable.getWriter();reader=socket.readable.getReader();
  await expect([220]);
  await write('EHLO lokd-security.workers.dev');
  await expect([250]);
  if(useStartTls){
   await write('STARTTLS');
   await expect([220]);
   writer.releaseLock();
   reader.releaseLock();
   socket=socket.startTls();
   await bounded(socket.opened,limits.connectMs,'smtp_connect_timeout');
   writer=socket.writable.getWriter();
   reader=socket.readable.getReader();
   buffered=new Uint8Array(0);
   await write('EHLO lokd-security.workers.dev');
   await expect([250]);
  }
  await write('AUTH LOGIN');await expect([334]);
  await write(b64(user));await expect([334]);
  await write(b64(pass));await expect([235]);
  await write(`MAIL FROM:<${from}>`);await expect([250]);
  await write(`RCPT TO:<${recipients[0]}>`);await expect([250,251]);
  await write('DATA');await expect([354]);
  await write(mime+'.');
  const accepted=await expect([250]);
  // A confirmed 250 remains accepted even if QUIT or socket cleanup fails.
  await write('QUIT').catch(()=>undefined);
  const providerId=`smtp:${id}:${accepted.slice(0,80)}`;
  return providerId.slice(0,200);
 }finally{
  // Cleanup is best-effort and cannot extend the transaction deadline.
  try{void reader?.cancel().catch(()=>undefined);reader?.releaseLock();}catch{/* ignore */}
  try{void writer?.abort().catch(()=>undefined);writer?.releaseLock();}catch{/* ignore */}
  try{void socket?.close().catch(()=>undefined);}catch{/* ignore */}
 }
}
async function sendSmtpViaRelay(runtime:OperationalRuntime,id:string,body:Record<string,unknown>,transport:typeof fetch):Promise<string>{
 const result=await providerJson(runtime.LOKD_SMTP_RELAY_URL!,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+runtime.LOKD_SMTP_RELAY_TOKEN},body:JSON.stringify({id,from:body.from,to:body.to,subject:body.subject,text:body.text,host:runtime.LOKD_SMTP_HOST,port:Number(runtime.LOKD_SMTP_PORT||'587'),user:runtime.LOKD_SMTP_USER})},transport);
 if(typeof result.provider_id!=='string'||!result.provider_id)throw new DeliveryError('smtp_relay_acceptance_unknown','uncertain');
 return result.provider_id;
}
async function sendSmtpEmail(runtime:OperationalRuntime,id:string,body:Record<string,unknown>,transport:typeof fetch):Promise<string>{
 try{
  if(runtime.LOKD_SMTP_RELAY_URL)return await sendSmtpViaRelay(runtime,id,body,transport);
  return await sendSmtpOverSocket(runtime,id,body);
 }catch(error){
  if(error instanceof DeliveryError&&error.disposition!=='retry_wait')throw error;
  // No provider idempotency on cPanel SMTP — never treat lost response as safe to resend.
  throw new DeliveryError('smtp_acceptance_unknown','uncertain');
 }
}
export async function sendEmail(runtime:OperationalRuntime,id:string,body:Record<string,unknown>,transport:typeof fetch){
 const provider=configuredEmailProvider(runtime);
 if(body._lokdProvider!==provider)throw new DeliveryError('email_provider_changed');
 return sendSmtpEmail(runtime,id,body,transport);
}
export async function emailReceipt(runtime:OperationalRuntime,body:Record<string,unknown>,id:string,providerId:string,recipient:string,transport:typeof fetch){
 void id;void recipient;void transport;
 const provider=configuredEmailProvider(runtime);
 if(body._lokdProvider!==provider)throw new DeliveryError('email_provider_changed');
 // SMTP has no later receipt API. Acceptance ends at SMTP 250 / relay provider id.
 if(typeof providerId!=='string'||!providerId.startsWith('smtp:'))throw new DeliveryError('email_receipt_mismatch');
 return 'sent';
}
