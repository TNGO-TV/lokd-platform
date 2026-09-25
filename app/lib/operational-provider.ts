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
 RESEND_API_KEY?:string;
 ZEPTOMAIL_SEND_TOKEN?:string;
 LOKD_ZEPTOMAIL_API_ORIGIN?:string;
 CLERK_SECRET_KEY?:string;
 LOKD_ZOHO_ACCOUNTS_ORIGIN?:string;
 LOKD_ZOHO_API_ORIGIN?:string;
 LOKD_ZOHO_CLIENT_ID?:string;
 LOKD_ZOHO_CLIENT_SECRET?:string;
 LOKD_ZOHO_REFRESH_TOKEN?:string;
 LOKD_ZOHO_CRM_ORG_ID?:string;
 LOKD_ZOHO_CRM_OWNER_ID?:string;
 LOKD_ZOHO_BOOKS_ORG_ID?:string;
};
export class DeliveryError extends Error {
 code:string;
 disposition:'blocked'|'failed'|'retry_wait'|'cancelled'|'uncertain';
 constructor(code:string,disposition:DeliveryError['disposition']='blocked'){super(code);this.code=code;this.disposition=disposition;}
}
export function allowlisted(list:string|undefined,value:string){return (list??'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(value.toLowerCase());}
export const emailValid=(v:unknown):v is string=>typeof v==='string'&&v.length<=254&&/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v);

// Explicit verified data-centre pair. Never infer this from company country.
const regions=[['https://accounts.zoho.com','https://www.zohoapis.com'],['https://accounts.zoho.eu','https://www.zohoapis.eu'],['https://accounts.zoho.in','https://www.zohoapis.in'],['https://accounts.zoho.com.au','https://www.zohoapis.com.au'],['https://accounts.zoho.jp','https://www.zohoapis.jp'],['https://accounts.zohocloud.ca','https://www.zohoapis.ca'],['https://accounts.zoho.sa','https://www.zohoapis.sa']];
export async function providerJson(url:string,init:RequestInit,transport:typeof fetch=fetch):Promise<Record<string,unknown>>{
 let response:Response;
 try{response=await fetchWithoutRedirect(transport,url,{...init,signal:AbortSignal.timeout(15000)});}
 catch{throw new DeliveryError('provider_transport_unknown','retry_wait');}
 if(!response.ok){await response.body?.cancel();throw new DeliveryError(`provider_http_${response.status}`,response.status===401||response.status===403?'blocked':response.status===429||response.status>=500?'retry_wait':'failed');}
 try{const value:unknown=JSON.parse(await readRequestText(response,512_000));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value as Record<string,unknown>;}
 catch{throw new DeliveryError('provider_response_unknown','retry_wait');}
}
export async function zohoSession(runtime:OperationalRuntime,transport:typeof fetch=fetch){
 if(!regions.some(([a,b])=>a===runtime.LOKD_ZOHO_ACCOUNTS_ORIGIN&&b===runtime.LOKD_ZOHO_API_ORIGIN)||!runtime.LOKD_ZOHO_CLIENT_ID||!runtime.LOKD_ZOHO_CLIENT_SECRET||!runtime.LOKD_ZOHO_REFRESH_TOKEN)throw new DeliveryError('zoho_runtime_authorization_missing');
 const token=await providerJson(runtime.LOKD_ZOHO_ACCOUNTS_ORIGIN+'/oauth/v2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:runtime.LOKD_ZOHO_CLIENT_ID,client_secret:runtime.LOKD_ZOHO_CLIENT_SECRET,refresh_token:runtime.LOKD_ZOHO_REFRESH_TOKEN}).toString()},transport);
 if(typeof token.access_token!=='string'||!token.access_token||token.api_domain!==runtime.LOKD_ZOHO_API_ORIGIN)throw new DeliveryError('zoho_authorization_or_region_mismatch');
 return {origin:runtime.LOKD_ZOHO_API_ORIGIN!,headers:{Authorization:'Zoho-oauthtoken '+token.access_token,'content-type':'application/json'}};
}
export function crmEnquiryBody(enquiry:{id:string;contact_name:string;organisation_name:string;email_normalized:string},ownerId:string){
 if(enquiry.email_normalized.length>100)throw new DeliveryError('crm_email_field_length_exceeded');
 return {data:[{LOKD_Enquiry_Reference:enquiry.id,Last_Name:enquiry.contact_name.slice(0,80),Company:enquiry.organisation_name,Email:enquiry.email_normalized,Owner:{id:ownerId},Description:'LOKD enquiry '+enquiry.id+'. Review the private LOKD Operations intake for service details.'}],duplicate_check_fields:['LOKD_Enquiry_Reference'],trigger:[],skip_feature_execution:[{name:'cadences',action:'insert'},{name:'cadences',action:'update'}]};
}
export async function sendCrm(runtime:OperationalRuntime,body:Record<string,unknown>,transport:typeof fetch){
 if(!runtime.LOKD_ZOHO_CRM_ORG_ID)throw new DeliveryError('zoho_crm_org_missing');
 const session=await zohoSession(runtime,transport);
 const org=await providerJson(session.origin+'/crm/v8/org',{headers:session.headers},transport);
 if(!Array.isArray(org.org)||org.org.length!==1||org.org[0].id!==runtime.LOKD_ZOHO_CRM_ORG_ID)throw new DeliveryError('zoho_crm_org_mismatch');
 const response=await providerJson(session.origin+'/crm/v8/Leads/upsert',{method:'POST',headers:session.headers,body:JSON.stringify(body)},transport);
 const record=Array.isArray(response.data)&&response.data.length===1?response.data[0]:null;
 if(record?.status!=='success'||record?.code!=='SUCCESS'||typeof record.details?.id!=='string')throw new DeliveryError('zoho_record_not_accepted','failed');
 return record.details.id as string;
}
// Freeze provider selection inside the immutable request, never in mutable runtime alone.
export function configuredEmailProvider(runtime:OperationalRuntime){
 if(runtime.LOKD_EMAIL_PROVIDER==='resend'&&runtime.RESEND_API_KEY)return 'resend';
 // Enable additional data centres only after verifying their documented endpoint.
 if(runtime.LOKD_EMAIL_PROVIDER==='zeptomail'&&runtime.ZEPTOMAIL_SEND_TOKEN&&runtime.LOKD_ZEPTOMAIL_API_ORIGIN==='https://api.zeptomail.com')return 'zeptomail';
 throw new DeliveryError('email_provider_not_configured');
}
export async function sendEmail(runtime:OperationalRuntime,id:string,body:Record<string,unknown>,transport:typeof fetch){
 const provider=configuredEmailProvider(runtime);
 if(body._lokdProvider!==provider)throw new DeliveryError('email_provider_changed');
 if(provider==='zeptomail'){
  try{
   const result=await providerJson(runtime.LOKD_ZEPTOMAIL_API_ORIGIN+'/v1.1/email',{method:'POST',headers:{Authorization:'Zoho-enczapikey '+runtime.ZEPTOMAIL_SEND_TOKEN,'content-type':'application/json'},body:JSON.stringify({from:{address:body.from},to:(body.to as string[]).map(address=>({email_address:{address}})),subject:body.subject,textbody:body.text,client_reference:id,track_opens:false,track_clicks:false})},transport);
   if(!Array.isArray(result.data)||result.data.length!==1||result.data[0]?.code!=='EM_104'||typeof result.request_id!=='string'||!result.request_id)throw new DeliveryError('email_acceptance_unknown','uncertain');
   return result.request_id;
  }catch(error){
   // client_reference is correlation, not documented provider idempotency.
   // Never resend after a timeout, malformed success, throttling or server failure.
   if(error instanceof DeliveryError&&error.disposition!=='retry_wait')throw error;
   throw new DeliveryError('zeptomail_acceptance_unknown','uncertain');
  }
 }
 const payload={...body};delete payload._lokdProvider;
 const result=await providerJson('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+runtime.RESEND_API_KEY,'content-type':'application/json','Idempotency-Key':id},body:JSON.stringify(payload)},transport);
 if(typeof result.id!=='string'||!result.id)throw new DeliveryError('email_acceptance_unknown','retry_wait');
 return result.id;
}
const recordObject=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
function boundZeptoLog(value:unknown,body:Record<string,unknown>,providerId:string,recipient:string){
 const record=recordObject(value),nested=recordObject(record.email_info),info=record.email_info?nested:record;
 const from=typeof info.from==='string'?info.from:recordObject(info.from).address;
 const to=typeof info.to==='string'?info.to:Array.isArray(info.to)&&info.to.length===1?recordObject(info.to[0]).address:null;
 if(record.request_id!==providerId||typeof to!=='string'||to.toLowerCase()!==recipient.toLowerCase()||from!==body.from||info.subject!==body.subject)throw new DeliveryError('email_receipt_mismatch');
 return {record,info};
}
export async function emailReceipt(runtime:OperationalRuntime,body:Record<string,unknown>,id:string,providerId:string,recipient:string,transport:typeof fetch){
 const provider=configuredEmailProvider(runtime);
 if(body._lokdProvider!==provider)throw new DeliveryError('email_provider_changed');
 if(provider==='zeptomail'){
  const session=await zohoSession(runtime,transport);
  if(session.origin!=='https://www.zohoapis.com')throw new DeliveryError('zeptomail_region_mismatch');
  const query=new URLSearchParams({request_id:providerId,client_reference:id,limit:'2'});
  const result=await providerJson(runtime.LOKD_ZEPTOMAIL_API_ORIGIN+'/v1.1/email?'+query,{headers:session.headers},transport);
  if(result.status!=='success')throw new DeliveryError('email_receipt_mismatch');
  const logs=Array.isArray(result.data)?result.data:recordObject(result.data).logs;
  if(!Array.isArray(logs))throw new DeliveryError('email_receipt_mismatch');
  // Acceptance can precede searchable logs. Absence never proves delivery or permits resend.
  if(logs.length===0)return 'sent';
  if(logs.length!==1)throw new DeliveryError('email_receipt_mismatch');
  const listed=boundZeptoLog(logs[0],body,providerId,recipient);
  if(!listed.record.email_info)return listed.info.status==='delivered'?'delivered':['bounced','failed'].includes(String(listed.info.status))?'failed':'sent';
  // The real list endpoint reports processing, not per-recipient delivery.
  const reference=listed.info.email_reference;
  if(typeof reference!=='string'||!reference)throw new DeliveryError('email_receipt_mismatch');
  const detail=await providerJson(runtime.LOKD_ZEPTOMAIL_API_ORIGIN+'/v1.1/email/email-reference/'+encodeURIComponent(reference),{headers:session.headers},transport);
  if(detail.status!=='success')throw new DeliveryError('email_receipt_mismatch');
  const matched=boundZeptoLog(detail.data,body,providerId,recipient);
  if(matched.info.email_reference!==reference)throw new DeliveryError('email_receipt_mismatch');
  if(['bounced','failed'].includes(String(matched.info.status)))return 'failed';
  const events=recordObject(matched.record.email_delivery_details),deliveries=events.delivery;
  // Unknown event categories may be later failures; leave them for review.
  if(Object.keys(events).some(key=>key!=='delivery'))return 'sent';
  if(!Array.isArray(deliveries)||deliveries.length!==1)return 'sent';
  const delivery=recordObject(deliveries[0]);
  if(typeof delivery.recipient!=='string'||delivery.recipient.toLowerCase()!==recipient.toLowerCase()||typeof delivery.delivery_time!=='string'||!Number.isFinite(Date.parse(delivery.delivery_time)))throw new DeliveryError('email_receipt_mismatch');
  return 'delivered';
 }
 const result=await providerJson('https://api.resend.com/emails/'+encodeURIComponent(providerId),{headers:{Authorization:'Bearer '+runtime.RESEND_API_KEY}},transport);
 if(result.id!==providerId||!Array.isArray(result.to)||result.to.length!==1||result.to[0]?.toLowerCase()!==recipient.toLowerCase())throw new DeliveryError('email_receipt_mismatch');
 return ['delivered','opened','clicked'].includes(String(result.last_event))?'delivered':['bounced','complained','failed','suppressed'].includes(String(result.last_event))?'failed':'sent';
}
