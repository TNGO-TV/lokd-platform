import {SignupError, type SignupActor} from './signup-server';
import {identityCase} from './applicant-identity';
import {agreementHash} from './agreement-acceptance';

// Server-only port. Never construct this adapter or actor from request JSON.
// No live adapter is installed: provider acceptance is a separate release gate.
export type IdentityBinding = {caseId:string; applicantId:string; applicantVersion:number; ownerUserId:string; bindingHash:string; captureReference:string};
export type IdentityResult = IdentityBinding & {environment:'production'; provider:string; outcome:'verified'|'declined'|'no_record'|'manual_review'|'unavailable'; providerReference:string; evidenceReference:string; evidenceHash:string; checkedAt:string; expiresAt:string};
export interface ProductionIdentityProvider {
 key:string;
 // Validate a private, immutable capture bound to the authenticated applicant and
 // consent; return its digest. Raw identity/biometric data never enters this ledger.
 capture(input:{applicantId:string; applicantVersion:number; ownerUserId:string; captureReference:string; consentVersion:string}):Promise<{environment:'production'; bindingHash:string}>;
 submit(binding:IdentityBinding):Promise<IdentityResult>;
 // Read only, exact stable caseId. Null/404/timeout is never permission to resubmit.
 lookup(binding:IdentityBinding):Promise<IdentityResult|null>;
}
type Case = {id:string;applicant_id:string;applicant_version:number;owner_user_id:string;provider:string;binding_hash:string;capture_reference:string;consent_version:string;created_at:string};
type Outcome = {id:string;sequence:number;outcome:string};
const field=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new SignupError('Provide a valid identity reference.');return v.trim();};
const digest=(v:string)=>/^[a-f0-9]{64}$/.test(v);
const binding=(c:Case):IdentityBinding=>({caseId:c.id,applicantId:c.applicant_id,applicantVersion:c.applicant_version,ownerUserId:c.owner_user_id,bindingHash:c.binding_hash,captureReference:c.capture_reference});
async function get(db:D1Database,actor:SignupActor,id:string){
 const c=await db.prepare('SELECT * FROM production_identity_cases WHERE id=?').bind(id).first<Case>();
 if(!c||(!actor.operations&&c.owner_user_id!==actor.userId))throw new SignupError('Identity case not found.',404);
 return c;
}
async function latest(db:D1Database,id:string){return (await db.prepare('SELECT id,sequence,outcome FROM production_identity_outcomes WHERE case_id=? ORDER BY sequence DESC LIMIT 1').bind(id).first<Outcome>())!;}
async function current(db:D1Database,c:Case){const s=await identityCase(db,c.owner_user_id,c.applicant_id);if(s.version!==c.applicant_version)throw new SignupError('Identity applicant changed.',409);}
async function record(db:D1Database,c:Case,previous:Outcome,result:IdentityResult|null,actorId:string){
 if(result){
  const expected=binding(c);
  if(result.environment!=='production'||result.provider!==c.provider||Object.entries(expected).some(([k,v])=>result[k as keyof IdentityResult]!==v)||!['verified','declined','no_record','manual_review','unavailable'].includes(result.outcome)||!digest(result.evidenceHash)||!result.providerReference||!result.evidenceReference||!Number.isFinite(Date.parse(result.checkedAt))||Date.parse(result.checkedAt)<Date.parse(c.created_at)||Date.parse(result.checkedAt)>Date.now()||!Number.isFinite(Date.parse(result.expiresAt))||Date.parse(result.expiresAt)<=Date.now())throw new SignupError('Provider evidence is mismatched, stale or unsupported.',409);
 }
 await db.prepare('INSERT INTO production_identity_outcomes VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),c.id,previous.sequence+1,result?.outcome??'delivery_unknown',result?.providerReference??null,result?.evidenceReference??null,result?.evidenceHash??null,result?new Date(result.checkedAt).toISOString():null,result?new Date(result.expiresAt).toISOString():null,new Date().toISOString(),actorId).run();
}
export async function readProductionIdentity(db:D1Database,actor:SignupActor,id:string){
 const c=await get(db,actor,id),o=await latest(db,id);
 const evidence=await db.prepare('SELECT outcome_id FROM current_production_identity_evidence WHERE id=?').bind(id).first();
 // Private evidence pointers/digests are intentionally not returned to participants.
 return {id:c.id,applicantId:c.applicant_id,applicantVersion:c.applicant_version,mode:'production',outcome:o.outcome,outcomeId:o.id,identityVerified:!!evidence,workEligible:false};
}
export async function startProductionIdentity(db:D1Database,actor:SignupActor,input:Record<string,unknown>,provider?:ProductionIdentityProvider){
 if(!provider)throw new SignupError('Production identity provider acceptance is not configured.',503);
 if(Object.keys(input).some(k=>!['applicantId','applicantVersion','captureReference','consentVersion'].includes(k)))throw new SignupError('Unsupported identity input.');
 const applicantId=field(input.applicantId),s=await identityCase(db,actor.userId,applicantId);
 if(input.applicantVersion!==s.version)throw new SignupError('Identity applicant changed.',409);
 const old=await db.prepare('SELECT id FROM production_identity_cases WHERE applicant_id=? AND applicant_version=?').bind(applicantId,s.version).first<{id:string}>();
 if(old)return readProductionIdentity(db,actor,old.id);
 const captureReference=field(input.captureReference),consentVersion=field(input.consentVersion);
 const capture=await provider.capture({applicantId,applicantVersion:s.version,ownerUserId:actor.userId,captureReference,consentVersion});
 if(capture.environment!=='production'||!digest(capture.bindingHash))throw new SignupError('Production-bound capture required.',409);
 const c:Case={id:crypto.randomUUID(),applicant_id:applicantId,applicant_version:s.version,owner_user_id:actor.userId,provider:provider.key,binding_hash:capture.bindingHash,capture_reference:captureReference,consent_version:consentVersion,created_at:new Date().toISOString()};
 const claim=crypto.randomUUID();
 try{await db.batch([
  db.prepare('INSERT INTO production_identity_cases VALUES(?,?,?,?,?,?,?,?,?)').bind(c.id,c.applicant_id,c.applicant_version,c.owner_user_id,c.provider,c.binding_hash,c.capture_reference,c.consent_version,c.created_at),
  db.prepare("INSERT INTO production_identity_outcomes(id,case_id,sequence,outcome,recorded_at,recorded_by) VALUES(?,?,1,'pending',?,?)").bind(claim,c.id,c.created_at,actor.userId),
 ]);}catch(error){const winner=await db.prepare('SELECT id FROM production_identity_cases WHERE applicant_id=? AND applicant_version=?').bind(applicantId,s.version).first<{id:string}>();if(winner)return readProductionIdentity(db,actor,winner.id);throw error;}
 let result:IdentityResult|null=null;
 try{result=await provider.submit(binding(c));}catch{/* durable claim survives uncertain delivery */}
 await record(db,c,{id:claim,sequence:1,outcome:'pending'},result,actor.userId);
 return readProductionIdentity(db,actor,c.id);
}
export async function recoverProductionIdentity(db:D1Database,actor:SignupActor,id:string,expectedOutcomeId:string,provider?:ProductionIdentityProvider){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const c=await get(db,actor,id);if(c.owner_user_id===actor.userId)throw new SignupError('Independent recovery required.',403);
 if(!provider||provider.key!==c.provider)throw new SignupError('Accepted provider unavailable.',503);
 const o=await latest(db,id);
 if(o.id!==expectedOutcomeId)throw new SignupError('Identity outcome changed.',409);
 await db.prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),'operations',actor.userId,'production_identity_lookup','identity_case',c.id,'Read-only recovery of outcome '+o.id,new Date().toISOString()).run();
 let result:IdentityResult|null=null;try{result=await provider.lookup(binding(c));}catch{/* unknown remains held */}
 // Missing lookup cannot erase a known decision/result; no dispatch is performed.
 if(result)await record(db,c,o,result,actor.userId);
 return readProductionIdentity(db,actor,id);
}
export async function decideProductionIdentity(db:D1Database,actor:SignupActor,input:{id:string;outcomeId:string;decision:'approve'|'reject';reason:string;independentlyChecked:boolean}){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const c=await get(db,actor,input.id);await current(db,c);
 if(c.owner_user_id===actor.userId||!input.independentlyChecked)throw new SignupError('Independent evidence review required.',403);
 if(!['approve','reject'].includes(input.decision))throw new SignupError('Choose an identity decision.');
 const o=await latest(db,c.id);if(o.id!==input.outcomeId)throw new SignupError('Identity outcome changed.',409);
 await db.prepare('INSERT INTO production_identity_decisions VALUES(?,?,?,?,?)').bind(o.id,input.decision,actor.userId,field(input.reason),new Date().toISOString()).run();
 return readProductionIdentity(db,actor,c.id);
}
export async function suspendProductionIdentity(db:D1Database,actor:SignupActor,id:string,reason:string){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 await get(db,actor,id);
 await db.prepare('INSERT INTO production_identity_suspensions VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,actor.userId,field(reason),new Date().toISOString()).run();
 return {suspended:true,workEligible:false};
}
// ID-02 must join this view inside its commit, with exact owner/version and deadline.
export async function productionIdentityEvidence(db:D1Database,applicantId:string,applicantVersion:number,ownerUserId:string,deadline:string){
 if(!Number.isFinite(Date.parse(deadline))||Date.parse(deadline)<Date.now())throw new SignupError('Valid readiness deadline required.');
 const row=await db.prepare('SELECT * FROM current_production_identity_evidence WHERE applicant_id=? AND applicant_version=? AND owner_user_id=? AND julianday(expires_at)>=julianday(?)').bind(applicantId,applicantVersion,ownerUserId,deadline).first();
 return row?{contract:'lokd.production-identity.v1',...row,contractHash:await agreementHash(JSON.stringify(row)),workEligible:false}:null;
}
