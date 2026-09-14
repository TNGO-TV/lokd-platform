import type {IdentityBinding, IdentityResult, ProductionIdentityProvider} from './production-identity';

// Server-owned dependencies only. Never pass request JSON as configuration.
export type CaptureRequest = {applicantId:string; applicantVersion:number; ownerUserId:string; captureReference:string; consentVersion:string};
export type PrivateIdentityCapture = CaptureRequest & {
 environment:'production'; idNumber:string; capturedAt:string; expiresAt:string;
 consentEvidenceReference:string;
};
export interface VerifyNowCaptureStore {
 // Authenticated private storage must enforce immutable references, withdrawal,
 // current applicant version and consent. This is NOT a browser assertion.
 read(reference:string):Promise<PrivateIdentityCapture|null>;
}
export interface VerifyNowReceiptStore {
 // Atomic insert-if-absent, committed BEFORE network I/O. Claims never expire.
 claim(binding:IdentityBinding, requestHash:string, policyReference:string, evidenceLifetimeMs:number):Promise<boolean>;
 // Append once; must reject a conflicting result or mismatched claim.
 save(binding:IdentityBinding, result:IdentityResult):Promise<void>;
 read(binding:IdentityBinding):Promise<IdentityResult|null>;
}
export interface VerifyNowEvidenceVault {
 // Private immutable object, accessible only through authorised server review.
 // Must persist bytes before resolving; return an opaque reference, never a URL.
 put(caseId:string, response:Uint8Array, digest:string):Promise<string>;
}
export type VerifyNowProductionConfig = {
 apiKey:string; captures:VerifyNowCaptureStore; receipts:VerifyNowReceiptStore;
 evidence:VerifyNowEvidenceVault;
 // Explicit accepted local retention/currentness policy, not provider-supplied TTL.
 policyReference:string; evidenceLifetimeMs:number;
 transport?:typeof fetch; now?:()=>number;
};
const endpoint='https://www.verifynow.co.za/api/external/verify';
const provider='verifynow-said-production-v1';
const maxBytes=1024*1024;
const opaque=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,299}$/.test(value);
const fail=():never=>{throw new Error('VerifyNow production evidence is unavailable or unsupported.');};
export async function identityDigest(value:string|Uint8Array){
 const bytes=typeof value==='string'?new TextEncoder().encode(value):value;
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes)))).map(n=>n.toString(16).padStart(2,'0')).join('');
}
const fields=['caseId','applicantId','applicantVersion','ownerUserId','bindingHash','captureReference'] as const;
export const sameIdentityBinding=(a:IdentityBinding,b:IdentityBinding)=>fields.every(k=>a[k]===b[k]);
function captureJson(c:PrivateIdentityCapture){
 // Fixed field ordering commits every accepted input, including consent and ID.
 return JSON.stringify([c.environment,c.applicantId,c.applicantVersion,c.ownerUserId,c.captureReference,c.consentVersion,c.idNumber,c.capturedAt,c.expiresAt,c.consentEvidenceReference]);
}
async function boundedBody(response:Response){
 if(!response.body) return fail();
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>maxBytes){await reader.cancel();return fail();}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;
}

/** Documented SAID transport, intentionally NOT a remote-person verifier.
 * Registry matches yield manual_review. No undocumented negative envelope,
 * biometric status, sandbox result, or local reviewer can turn this into verified.
 */
export function createVerifyNowProductionProvider(config:VerifyNowProductionConfig):ProductionIdentityProvider {
 if(!config.apiKey?.trim()||!config.policyReference?.trim()||!Number.isSafeInteger(config.evidenceLifetimeMs)||config.evidenceLifetimeMs<=0)throw new Error('Accepted VerifyNow production configuration required.');
 const now=config.now??Date.now,transport=config.transport??fetch;
 async function capture(reference:string){
  const c=await config.captures.read(reference),at=now();
  if(!c||c.environment!=='production'||c.captureReference!==reference||!c.applicantId||!c.ownerUserId||!Number.isSafeInteger(c.applicantVersion)||c.applicantVersion<1||!c.consentVersion||!c.consentEvidenceReference||!/^\d{13}$/.test(c.idNumber)||!Number.isFinite(Date.parse(c.capturedAt))||Date.parse(c.capturedAt)>at||!Number.isFinite(Date.parse(c.expiresAt))||Date.parse(c.expiresAt)<=at)return fail();
  return c;
 }
 async function bound(b:IdentityBinding){
  const c=await capture(b.captureReference);
  if(!b.caseId||c.applicantId!==b.applicantId||c.applicantVersion!==b.applicantVersion||c.ownerUserId!==b.ownerUserId||await identityDigest(captureJson(c))!==b.bindingHash)return fail();
  return c;
 }
 function validReceipt(b:IdentityBinding,r:IdentityResult){
  if(!sameIdentityBinding(b,r)||r.provider!==provider||r.environment!=='production'||r.outcome!=='manual_review'||!opaque(r.providerReference)||!opaque(r.evidenceReference)||!/^[a-f0-9]{64}$/.test(r.evidenceHash)||!Number.isFinite(Date.parse(r.checkedAt))||Date.parse(r.checkedAt)>now()||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=now())return fail();
  return r;
 }
 return {
  key:provider,
  async capture(input){const c=await capture(input.captureReference);if(Object.entries(input).some(([k,v])=>c[k as keyof PrivateIdentityCapture]!==v))return fail();return {environment:'production',bindingHash:await identityDigest(captureJson(c))};},
  async submit(b){
   const c=await bound(b);
   const body=JSON.stringify({reportType:'said_verification',idNumber:c.idNumber,mode:'production'});
   const requestHash=await identityDigest(JSON.stringify([body,config.policyReference,config.evidenceLifetimeMs]));
   // A failed/crashed claim is held forever pending read-only recovery. Never POST again.
   if(!await config.receipts.claim(b,requestHash,config.policyReference,config.evidenceLifetimeMs))return fail();
   const sentAt=now();
   const response=await transport(endpoint,{method:'POST',headers:{'x-api-key':config.apiKey,'Content-Type':'application/json','Idempotency-Key':b.caseId},body,redirect:'error',signal:AbortSignal.timeout(25000)});
   const bytes=await boundedBody(response),evidenceHash=await identityDigest(bytes);
   // Preserve even unsupported responses privately for reconciliation; no PII in errors.
   const evidenceReference=await config.evidence.put(b.caseId,bytes,evidenceHash);
   if(!opaque(evidenceReference))return fail();
   let envelope;try{envelope=JSON.parse(new TextDecoder().decode(bytes));}catch{return fail();}
   const result=envelope?.results?.said_verification;
   const checkedAt=result?.meta?.timestamp,checked=Date.parse(checkedAt);
   if(response.status!==200||envelope?.success!==true||envelope?.mode!=='production'||envelope?.reportType!=='said_verification'||envelope?.input?.idNumber!==c.idNumber||!opaque(envelope?.requestId)||result?.Status!=='Success'||result?.realTimeResults?.Status!=='ID Number Valid'||result?.meta?.environment!=='production'||typeof checkedAt!=='string'||!Number.isFinite(checked)||checked<sentAt||checked>now())return fail();
   // Re-read private capture after I/O: withdrawal/mutation/version changes fail closed.
   await bound(b);
   const expiresAt=new Date(Math.min(Date.parse(c.expiresAt),checked+config.evidenceLifetimeMs)).toISOString();
   const receipt:IdentityResult={...b,environment:'production',provider,outcome:'manual_review',providerReference:envelope.requestId,evidenceReference,evidenceHash,checkedAt:new Date(checked).toISOString(),expiresAt};
   validReceipt(b,receipt);await config.receipts.save(b,receipt);return receipt;
  },
  async lookup(b){
   await bound(b);
   // Local durable receipt recovery only. No documented SAID provider GET is assumed.
   const r=await config.receipts.read(b);return r?validReceipt(b,r):null;
  },
 };
}
