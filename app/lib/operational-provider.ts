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
// A single '*' entry opens the list (owner decision: deliver to every real applicant and client).
export function allowlisted(list:string|undefined,value:string){const entries=(list??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);return entries.includes('*')||entries.includes(value.toLowerCase());}
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
async function smtpReadLine(reader:ReadableStreamDefaultReader<Uint8Array>,buffer:{chunks:Uint8Array[]}):Promise<string>{
 const decoder=new TextDecoder();
 while(true){
  const joined=new Uint8Array(buffer.chunks.reduce((n,c)=>n+c.length,0));
  let offset=0;for(const chunk of buffer.chunks){joined.set(chunk,offset);offset+=chunk.length;}
  const text=decoder.decode(joined);
  const idx=text.indexOf('\r\n');
  if(idx>=0){
   const line=text.slice(0,idx);
   const rest=joined.slice(idx+2);
   buffer.chunks=rest.length?[rest]:[];
   return line;
  }
  const {value,done}=await reader.read();
  if(done)throw new DeliveryError('smtp_connection_closed','uncertain');
  if(value)buffer.chunks.push(value);
 }
}
async function smtpExpect(reader:ReadableStreamDefaultReader<Uint8Array>,buffer:{chunks:Uint8Array[]},codes:number[]){
 let line=await smtpReadLine(reader,buffer);
 const code=Number(line.slice(0,3));
 while(line.length>=4&&line[3]==='-')line=await smtpReadLine(reader,buffer);
 if(!codes.includes(code))throw new DeliveryError(`smtp_reject_${code||'unknown'}`,code===421||code===450||code===451?'retry_wait':'failed');
 return line;
}
async function smtpWrite(writer:WritableStreamDefaultWriter<Uint8Array>,line:string){
 await writer.write(new TextEncoder().encode(line+'\r\n'));
}
async function sendSmtpOverSocket(runtime:OperationalRuntime,id:string,body:Record<string,unknown>):Promise<string>{
 const {connect}=await import('cloudflare:sockets');
 const host=runtime.LOKD_SMTP_HOST!;
 const port=Number(runtime.LOKD_SMTP_PORT||'465');
 if(!Number.isFinite(port)||port===25)throw new DeliveryError('smtp_port_not_allowed');
 const user=runtime.LOKD_SMTP_USER!;
 const pass=runtime.LOKD_SMTP_PASSWORD!;
 const from=String(body.from??'');
 const recipients=Array.isArray(body.to)?body.to.map(String):[];
 if(!emailValid(from)||recipients.length!==1||!emailValid(recipients[0]))throw new DeliveryError('smtp_envelope_invalid');
 const subject=String(body.subject??'');
 const text=String(body.text??'');
 const useStartTls=port===587;
 let socket=connect({hostname:host,port},{secureTransport:useStartTls?'starttls':'on',allowHalfOpen:false});
 await socket.opened;
 let writer=socket.writable.getWriter();
 let reader=socket.readable.getReader();
 const buffer:{chunks:Uint8Array[]}={chunks:[]};
 try{
  await smtpExpect(reader,buffer,[220]);
  await smtpWrite(writer,`EHLO lokd-security.workers.dev`);
  await smtpExpect(reader,buffer,[250]);
  if(useStartTls){
   await smtpWrite(writer,'STARTTLS');
   await smtpExpect(reader,buffer,[220]);
   writer.releaseLock();
   reader.releaseLock();
   socket=socket.startTls();
   await socket.opened;
   writer=socket.writable.getWriter();
   reader=socket.readable.getReader();
   buffer.chunks=[];
   await smtpWrite(writer,`EHLO lokd-security.workers.dev`);
   await smtpExpect(reader,buffer,[250]);
  }
  await smtpWrite(writer,'AUTH LOGIN');
  await smtpExpect(reader,buffer,[334]);
  await smtpWrite(writer,b64(user));
  await smtpExpect(reader,buffer,[334]);
  await smtpWrite(writer,b64(pass));
  await smtpExpect(reader,buffer,[235]);
  await smtpWrite(writer,`MAIL FROM:<${from}>`);
  await smtpExpect(reader,buffer,[250]);
  await smtpWrite(writer,`RCPT TO:<${recipients[0]}>`);
  await smtpExpect(reader,buffer,[250,251]);
  await smtpWrite(writer,'DATA');
  await smtpExpect(reader,buffer,[354]);
  const marker=`LOKD-WORKER-SMTP-${id}`;
  const mime=[
   `From: ${from}`,
   `To: ${recipients[0]}`,
   `Subject: ${subject.replace(/[\r\n]+/g,' ')}`,
   'MIME-Version: 1.0',
   'Content-Type: text/plain; charset=utf-8',
   `Message-ID: <${id.replace(/[^A-Za-z0-9_-]/g,'_')}@lokd.co.za>`,
   `X-LOKD-Delivery-Id: ${id}`,
   `X-LOKD-Marker: ${marker}`,
   '',
   smtpDotStuff(text),
   ''
  ].join('\r\n');
  await smtpWrite(writer,mime+'.');
  const accepted=await smtpExpect(reader,buffer,[250]);
  await smtpWrite(writer,'QUIT').catch(()=>undefined);
  const providerId=`smtp:${id}:${accepted.slice(0,80)}`;
  return providerId.slice(0,200);
 }finally{
  try{reader.releaseLock();}catch{/* ignore */}
  try{await writer.close();}catch{/* ignore */}
  try{await socket.close();}catch{/* ignore */}
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
