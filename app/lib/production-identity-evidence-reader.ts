import {SignupError,type SignupActor} from './signup-server';
import {identityCase} from './applicant-identity';
import {identityDigest,sameIdentityBinding} from './verifynow-production';
import type {IdentityBinding,IdentityResult} from './production-identity';

export type IdentityEvidenceAccess = {
 actor:SignupActor; binding:IdentityBinding; evidenceHash:string;
 purpose:'identity_review';
};
export type IdentityEvidenceReader = {
 // Optional trusted source for isolated adapters; never accepted from request JSON.
 source?:{provider:string;read(binding:IdentityBinding):Promise<IdentityResult|null>};
 // Server-owned approved policy; must check current capture consent/withdrawal,
 // reader assignment and exact case scope. No default or browser attestation.
 authorize(input:IdentityEvidenceAccess):Promise<{allowed:boolean;policyReference:string;decisionReference:string}>;
 // Private backend only. No URL supplied by a browser and no provider API call.
 open(reference:string,signal:AbortSignal):Promise<{caseId:string;reference:string;body:ReadableStream<Uint8Array>}|null>;
};
type CaseRow={id:string;applicant_id:string;applicant_version:number;owner_user_id:string;binding_hash:string;capture_reference:string;provider:string};
const opaque=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,299}$/.test(v);
const unavailable=()=>new SignupError('Private identity evidence is unavailable.',409);
async function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 if(signal.aborted)throw unavailable();
 let listener:()=>void=()=>{};
 try{return await Promise.race([promise,new Promise<never>((_,reject)=>{listener=()=>reject(unavailable());signal.addEventListener('abort',listener,{once:true});})]);}
 finally{signal.removeEventListener('abort',listener);}
}

// Central supplies authenticated/MFA-checked actor and accepted dependencies.
// Reading evidence never changes an identity decision or resolves delivery.
export async function readPrivateIdentityEvidence(db:D1Database,actor:SignupActor,caseId:string,reader?:IdentityEvidenceReader):Promise<Response>{
 if(!actor.operations||!actor.userId)throw new SignupError('Operations evidence access required.',403);
 if(!reader)throw new SignupError('Private identity evidence access is not configured.',503);
 if(!opaque(caseId))throw unavailable();
 const row=await db.prepare('SELECT * FROM production_identity_cases WHERE id=?').bind(caseId).first<CaseRow>();
 if(!row||row.provider!==(reader.source?.provider??'verifynow-said-production-v1'))throw unavailable();
 const binding:IdentityBinding={caseId:row.id,applicantId:row.applicant_id,applicantVersion:row.applicant_version,ownerUserId:row.owner_user_id,bindingHash:row.binding_hash,captureReference:row.capture_reference};
 async function receipt(){
  const source=await identityCase(db,binding.ownerUserId,binding.applicantId).catch(error=>{if(error instanceof SignupError)throw unavailable();throw error;});
  if(source.version!==binding.applicantVersion)throw unavailable();
  if(await db.prepare('SELECT id FROM production_identity_suspensions WHERE case_id=? LIMIT 1').bind(caseId).first())throw unavailable();
  let r:IdentityResult|null;
  if(reader!.source)r=await reader!.source.read(binding);
  else {const saved=await db.prepare('SELECT result_json FROM verifynow_production_receipts WHERE case_id=?').bind(caseId).first<{result_json:string}>();try{r=JSON.parse(saved?.result_json??'null');}catch{throw unavailable();}}
  if(!r||!sameIdentityBinding(binding,r)||r.provider!==row!.provider||r.environment!=='production'||!(reader!.source?['verified','declined','no_record','manual_review','unavailable']:['manual_review']).includes(r.outcome)||!opaque(r.evidenceReference)||!opaque(r.providerReference)||!/^[a-f0-9]{64}$/.test(r.evidenceHash)||!Number.isFinite(Date.parse(r.expiresAt))||Date.parse(r.expiresAt)<=Date.now()||!Number.isFinite(Date.parse(r.checkedAt))||Date.parse(r.checkedAt)>Date.now())throw unavailable();
  return r;
 }
 const r=await receipt();
 const access:IdentityEvidenceAccess={actor,binding,evidenceHash:r.evidenceHash,purpose:'identity_review'};
 async function authorize(){const decision=await reader!.authorize(access);if(decision?.allowed!==true||!opaque(decision.policyReference)||!opaque(decision.decisionReference))throw new SignupError('Private identity evidence access denied.',403);return decision;}
 const decision=await authorize();
 async function audit(event:string,detail:string){await db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.userId,event,'identity_case',caseId,detail,new Date().toISOString()).run();}
 await audit('identity_provider_evidence_read_started',JSON.stringify({policyReference:decision.policyReference,decisionReference:decision.decisionReference}));
 const signal=AbortSignal.timeout(5000);
 let streamReader:ReadableStreamDefaultReader<Uint8Array>|undefined;
 try{
  const object=await abortable(reader.open(r.evidenceReference,signal),signal);
  if(!object||object.caseId!==caseId||object.reference!==r.evidenceReference){if(object)void object.body.cancel().catch(()=>{});throw unavailable();}
  streamReader=object.body.getReader();const chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await abortable(streamReader.read(),signal);if(done)break;length+=value.byteLength;if(length>1024*1024)throw unavailable();chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  if(await identityDigest(bytes)!==r.evidenceHash)throw unavailable();
  // Authorisation and source may change while private storage is being read.
  const current=await receipt();if(JSON.stringify(current)!==JSON.stringify(r))throw unavailable();
  const finalDecision=await authorize();
  await audit('identity_provider_evidence_read_ready',JSON.stringify({policyReference:finalDecision.policyReference,decisionReference:finalDecision.decisionReference}));
  return new Response(bytes,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="identity-evidence.json"','content-length':String(length),'cache-control':'private, no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox"}});
 }catch{
  if(streamReader)void streamReader.cancel().catch(()=>{});
  await audit('identity_provider_evidence_read_failed','No evidence response released.');
  throw unavailable();
 }finally{streamReader?.releaseLock();}
}
