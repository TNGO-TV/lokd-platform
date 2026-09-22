import {fetchWithoutRedirect} from './provider-fetch';
import fixtures from './verifynow-sandbox-fixtures.json' with {type:'json'};
export type IdentitySignal='id'|'bank'|'face'|'liveness'|'document'|'licence';
export type ProviderOutcome='mock_approved'|'no_record'|'declined'|'manual_review'|'unavailable'|'rate_limited'|'unexpected'|'delivery_unknown';
export const scenarioSignal:Record<string,IdentitySignal>={'id-found':'id','id-no-record':'id','id-unavailable':'id','bank-found':'bank','bank-no-record':'bank','bank-unavailable':'bank','face-reference':'face','face-upload':'face','liveness':'liveness','document-ocr':'document','drivers-licence':'licence'};
export function classifyVerifyNow(signal:IdentitySignal,http:number,body:unknown):ProviderOutcome {
 const b=(body&&typeof body==='object'?body:{}) as Record<string,unknown>;
 const at=(path:string)=>path.split('.').reduce<unknown>((v,k)=>v&&typeof v==='object'?(v as Record<string,unknown>)[k]:undefined,b);
 if(http===429)return 'rate_limited';
 if(signal==='id') {
  if(b.code==='NO_RECORD_FOUND')return 'no_record';
  if(b.code==='VERIFICATION_TEMPORARILY_UNAVAILABLE')return 'unavailable';
  if(http===200&&b.success===true&&at('results.said_verification.Status')==='Success'&&at('results.said_verification.realTimeResults.Status')==='ID Number Valid')return 'mock_approved';
 }
 if(signal==='bank') {
  if(http===200&&b.success===false&&b.response_code===4)return 'no_record';
  if(http===200&&b.success===true&&b.response_code===0&&at('results.verification_results.Status')==='VerifiedNoErrors')return 'mock_approved';
 }
 if(['face','liveness','document'].includes(signal)&&http===200&&b.success===true){
  const part=signal==='face'?'face_match':signal==='document'?'id_verification':'liveness';
  const state=at(`results.${part}.status`);
  if(state==='Approved')return 'mock_approved';if(state==='In Review')return 'manual_review';if(state==='Declined')return 'declined';
 }
 if(signal==='licence'&&http===200&&b.success===true&&b.mode==='sandbox'&&b.bundle==='drivers_licence_barcode'&&b.data&&typeof b.data==='object')return 'mock_approved';
 return http>=500?'unavailable':'unexpected';
}
export async function dispatchVerifyNow(scenario:string,key:string,idempotencyKey:string,transport:typeof fetch=fetch){
 const fixture=fixtures[scenario as keyof typeof fixtures];if(!fixture||!scenarioSignal[scenario])throw Error('Unknown sandbox scenario');
 if(!/^vn_live_[a-f0-9]{64}$/i.test(key))throw Error('Verification configuration unavailable');
 // Caller cannot supply URL, mode, identity or image bytes. Only synthetic fixtures.
 const response=await fetchWithoutRedirect(transport,'https://www.verifynow.co.za/api/external'+fixture.path,{method:'POST',signal:AbortSignal.timeout(25000),headers:{'content-type':'application/json','x-api-key':key,'Idempotency-Key':idempotencyKey},body:JSON.stringify({...fixture.payload,mode:'sandbox'})});
 const raw=await response.text();if(raw.length>1048576)throw Error('Provider response too large');
 let body:unknown;try{body=JSON.parse(raw);}catch{body={};}
 const retry=response.headers.get('retry-after');const parsed=retry?(/^\d+$/.test(retry)?Date.now()+Number(retry)*1000:Date.parse(retry)):NaN;
 return {outcome:classifyVerifyNow(scenarioSignal[scenario],response.status,body),httpStatus:response.status,retryAt:new Date(Number.isFinite(parsed)?Math.max(Date.now()+3000,parsed):Date.now()+60000).toISOString(),responseHash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw))),b=>b.toString(16).padStart(2,'0')).join('')};
}
