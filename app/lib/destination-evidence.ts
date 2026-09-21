import {readFinanceProviderJson} from './finance-body';
import {SignupError} from './signup-server';
export type DestinationMode='test'|'live';
export type DestinationRuntime={PAYSTACK_TEST_SECRET_KEY?:string;PAYSTACK_LIVE_SECRET_KEY?:string};
export function destinationKey(runtime:DestinationRuntime,mode:DestinationMode){
 const key=mode==='test'?runtime.PAYSTACK_TEST_SECRET_KEY:runtime.PAYSTACK_LIVE_SECRET_KEY;
 if(!key?.startsWith('sk_'+mode+'_'))throw new SignupError('The selected provider mode is not configured for recipient verification.',409);
 return key;
}
export async function accountFingerprint(secret:string,bank:string,account:string){
 const encoder=new TextEncoder(),key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(JSON.stringify(['LOKD-destination-v1',bank,account])))),b=>b.toString(16).padStart(2,'0')).join('');
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const identifier=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v)?v:null;
export async function recipientEvidence(raw:unknown,code:string,mode:DestinationMode,secret:string){
 if(!object(raw)||!object(raw.details))return null;
 const d=raw.details,id=identifier(raw.id),integration=identifier(raw.integration);
 if(!id||!integration||raw.recipient_code!==code||raw.domain!==mode||raw.type!=='basa'||raw.currency!=='ZAR'||raw.active!==true||raw.is_deleted!==false||typeof raw.updatedAt!=='string'||!Number.isFinite(Date.parse(raw.updatedAt))||Date.parse(raw.updatedAt)>Date.now()||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>200||typeof d.bank_code!=='string'||!/^\d{3,10}$/.test(d.bank_code)||typeof d.account_number!=='string'||!/^\d{6,20}$/.test(d.account_number)||typeof d.bank_name!=='string'||d.bank_name.length>200||!(d.account_name===null||typeof d.account_name==='string'&&d.account_name.length<=200))return null;
 // Names and full account numbers stay transient; keyed hashes resist enumeration.
 const accountHash=await accountFingerprint(secret,d.bank_code,d.account_number);
 const nameHash=await accountFingerprint(secret,'name',JSON.stringify([raw.name,d.account_name]));
 return {id,integration,code,mode,type:'basa',currency:'ZAR',bankCode:d.bank_code,bankName:d.bank_name,last4:d.account_number.slice(-4),accountHash,nameHash,updatedAt:new Date(raw.updatedAt).toISOString()};
}
export async function fetchRecipient(secret:string,code:string,mode:DestinationMode,transport:typeof fetch=fetch){
 if(!/^RCP_[a-zA-Z0-9]{6,60}$/.test(code))throw new SignupError('Use an existing Paystack recipient code.');
 try{
  const response=await transport('https://api.paystack.co/transferrecipient/'+code,{method:'GET',headers:{Authorization:'Bearer '+secret},redirect:'error',signal:AbortSignal.timeout(20000)});
  const payload=await readFinanceProviderJson(response);
  if(!response.ok||payload.status!==true)throw new Error('unavailable');
  return await recipientEvidence(payload.data,code,mode,secret);
 }catch{throw new SignupError('Recipient retrieval is unavailable. Refresh and retry the read-only check; no payment was sent.',503);}
}
