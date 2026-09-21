import {SignupError,type SignupActor} from './signup-server';
import {identityCase} from './applicant-identity';
import {agreementHash} from './agreement-acceptance';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import type {IdentityBinding,IdentityResult,ProductionIdentityProvider} from './production-identity';
import {sameIdentityBinding} from './verifynow-production';
const providerKey='lokd-simulated-person-v1';
const reference=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new SignupError('Valid sandbox reference required.');return v.trim();};
type Capture={id:string;applicant_id:string;applicant_version:number;owner_user_id:string;consent_version:string;policy_version:string;scenario:string;binding_hash:string;captured_at:string;expires_at:string};
export async function createSandboxCapture(runtime:SandboxRuntime,actor:SignupActor,input:Record<string,unknown>){
 const {db,policy}=await requireSandboxCompletion(runtime);
 if(Object.keys(input).some(k=>!['applicantId','applicantVersion','consentVersion','consented','scenario'].includes(k)))throw new SignupError('Only documented synthetic capture inputs are accepted.');
 const applicantId=reference(input.applicantId),source=await identityCase(db,actor.userId,applicantId);
 if(source.version!==input.applicantVersion||input.consentVersion!==policy.consentVersion||input.consented!==true||!policy.scenarios.includes(input.scenario as never))throw new SignupError('Current applicant and explicit versioned sandbox consent required.',409);
 const id='SIMCAP-'+crypto.randomUUID(),now=new Date().toISOString(),expires=new Date(Date.now()+policy.captureMinutes*60000).toISOString();
 const hash=await agreementHash(JSON.stringify({id,applicantId,version:source.version,owner:actor.userId,policy:policy.version,consent:policy.consentVersion,scenario:input.scenario,now,expires}));
 await db.batch([db.prepare('INSERT INTO sandbox_identity_captures VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,applicantId,source.version,actor.userId,policy.consentVersion,policy.version,String(input.scenario),hash,now,expires),db.prepare('INSERT INTO sandbox_identity_consent_events VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,'consent',actor.userId,now)]);
 return {captureReference:id,consentVersion:policy.consentVersion,expiresAt:expires,mode:'simulator',policyVersion:policy.version};
}
export async function withdrawSandboxCapture(runtime:SandboxRuntime,actor:SignupActor,id:string){const {db}=await requireSandboxCompletion(runtime);const c=await db.prepare('SELECT * FROM sandbox_identity_captures WHERE id=? AND owner_user_id=?').bind(reference(id),actor.userId).first<Capture>();if(!c)throw new SignupError('Capture not found.',404);await db.batch([db.prepare('INSERT INTO sandbox_identity_consent_events VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,'withdraw',actor.userId,new Date().toISOString()),db.prepare("INSERT INTO production_identity_suspensions SELECT 'CONSENT-' || id,id,?, 'Sandbox consent withdrawn',? FROM production_identity_cases WHERE capture_reference=? AND NOT EXISTS(SELECT 1 FROM production_identity_suspensions s WHERE s.case_id=production_identity_cases.id)").bind(actor.userId,new Date().toISOString(),id)]);return {withdrawn:true,productionIdentityVerified:false};}
export async function sandboxIdentityProvider(runtime:SandboxRuntime):Promise<ProductionIdentityProvider>{
 const {db,policy}=await requireSandboxCompletion(runtime);
 async function capture(id:string){await requireSandboxCompletion(runtime);const c=await db.prepare('SELECT * FROM sandbox_identity_captures WHERE id=?').bind(id).first<Capture>();if(!c||c.policy_version!==policy.version||c.consent_version!==policy.consentVersion||Date.parse(c.expires_at)<=Date.now()||await db.prepare("SELECT id FROM sandbox_identity_consent_events WHERE capture_id=? AND action='withdraw'").bind(id).first())throw new SignupError('Sandbox capture expired or withdrawn.',409);const source=await identityCase(db,c.owner_user_id,c.applicant_id);if(source.version!==c.applicant_version)throw new SignupError('Sandbox applicant changed.',409);return c;}
 async function bound(b:IdentityBinding){const c=await capture(b.captureReference);if(c.applicant_id!==b.applicantId||c.applicant_version!==b.applicantVersion||c.owner_user_id!==b.ownerUserId||c.binding_hash!==b.bindingHash)throw new SignupError('Sandbox binding mismatch.',409);return c;}
 return {key:providerKey,
  async capture(input){const c=await capture(input.captureReference);if(c.applicant_id!==input.applicantId||c.applicant_version!==input.applicantVersion||c.owner_user_id!==input.ownerUserId||c.consent_version!==input.consentVersion)throw new SignupError('Sandbox capture binding mismatch.',409);return {environment:'production',bindingHash:c.binding_hash};},
  async submit(b){const c=await bound(b);const actual=await db.prepare('SELECT id FROM production_identity_cases WHERE id=? AND provider=? AND binding_hash=?').bind(b.caseId,providerKey,b.bindingHash).first();if(!actual)throw new SignupError('Submission must belong to the isolated sandbox ledger.',409);
   const now=new Date().toISOString();const outcome=['declined','no_record','manual_review'].includes(c.scenario)?c.scenario:'verified';
   const body=JSON.stringify({simulated:true,policyVersion:policy.version,scenario:c.scenario,binding:b,remotePersonSimulation:true,outcome}),hash=await agreementHash(body),ref='SIMOBJ-'+b.caseId;
   const result:IdentityResult={...b,environment:'production',provider:providerKey,outcome:outcome as IdentityResult['outcome'],providerReference:'SIMREQ-'+b.caseId,evidenceReference:ref,evidenceHash:hash,checkedAt:now,expiresAt:new Date(Math.min(Date.parse(c.expires_at),Date.now()+policy.evidenceHours*3600000)).toISOString()};
   if(c.scenario==='wrong_person')result.ownerUserId='SIM-WRONG-PERSON';if(c.scenario==='stale')result.expiresAt='2000-01-01T00:00:00.000Z';
   await db.batch([db.prepare('INSERT INTO sandbox_identity_dispatches VALUES(?,?,?,?)').bind(b.caseId,c.id,JSON.stringify(result),now),db.prepare('INSERT INTO sandbox_identity_objects VALUES(?,?,?,?,?,?)').bind(b.caseId,ref,body,hash,result.expiresAt,policy.version)]);
   if(['pending','lost_response','outage'].includes(c.scenario))throw new SignupError('Simulated uncertain delivery.',409);return result;
  },
  async lookup(b){const c=await bound(b);if(c.scenario==='outage')return null;const row=await db.prepare('SELECT result_json FROM sandbox_identity_dispatches WHERE case_id=?').bind(b.caseId).first<{result_json:string}>();if(!row)return null;const r=JSON.parse(row.result_json) as IdentityResult;if(!sameIdentityBinding(b,r)||Date.parse(r.expiresAt)<=Date.now())throw new SignupError('Simulated receipt mismatched or stale.',409);return r;},
 };
}
