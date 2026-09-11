import {SignupError} from './signup-server';
import {applicationPsiraDeclaration} from './psira-pathway';
import {dispatchVerifyNow,scenarioSignal} from './verifynow-adapter';
type Runtime={DB?:D1Database;VERIFYNOW_API_KEY?:string;VERIFYNOW_SANDBOX_ENABLED?:string};
type CaseRow={source_id:string;owner_user_id:string;version:number;status:string;pathway:string;psiraStatus:string;corrections:string};
export async function identityCase(db:D1Database,userId:string,id:string){
 const c=await db.prepare(`SELECT c.source_id,c.owner_user_id,c.version,c.status,s.pathway,s.psira_status AS psiraStatus,c.corrections_json AS corrections
 FROM signup_cases c JOIN officer_applications s ON s.id=c.source_id WHERE c.kind='officer' AND c.source_id=? AND c.owner_user_id=? AND s.environment='prelaunch' AND s.integrity_state='user_submitted'`).bind(id,userId).first<CaseRow>();
 if(!c)throw new SignupError('Link your own officer application first.',404);
 if(c.status==='withdrawn')throw new SignupError('This application is withdrawn.',409);
 const changes=JSON.parse(c.corrections);return {...c,pathway:changes.pathway??c.pathway,psiraStatus:changes.psiraStatus??c.psiraStatus};
}
export async function readApplicantIdentity(db:D1Database,userId:string,id:string){
 const c=await identityCase(db,userId,id);
 const checks=await db.prepare(`SELECT id,scenario,signal,state,http_status AS httpStatus,retry_at AS retryAt,created_at AS createdAt,updated_at AS updatedAt
 FROM applicant_verification_checks WHERE case_id=? AND owner_user_id=? AND case_version=? ORDER BY created_at DESC,rowid DESC`).bind(id,userId,c.version).all<{signal:string;state:string}>();
 const entry=checks.results.find(r=>r.signal==='id');
 return {caseId:id,caseVersion:c.version,mode:'sandbox',identityVerified:false,workEligible:false,checks:checks.results,
  nextStep:entry?.state==='mock_approved'?(applicationPsiraDeclaration(c.pathway,c.psiraStatus)==='registered'?'registered_enrolment':'training_options'):'entry_id',
  enrolment:{applicable:applicationPsiraDeclaration(c.pathway,c.psiraStatus)==='registered',amountMinor:applicationPsiraDeclaration(c.pathway,c.psiraStatus)==='registered'?35000:null,currency:'ZAR',priceApproved:true,paymentState:'not_started',liveChargingEnabled:false},
  independentStates:{face:checks.results.find(r=>r.signal==='face')?.state??'not_started',bank:checks.results.find(r=>r.signal==='bank')?.state??'not_started',psira:'separate_workflow',training:'options_pending',activation:'not_approved'}};
}
export async function runApplicantIdentity(runtime:Runtime,userId:string,input:Record<string,unknown>,transport:typeof fetch=fetch){
 if(!runtime.DB||runtime.VERIFYNOW_SANDBOX_ENABLED!=='true'||!runtime.VERIFYNOW_API_KEY)throw new SignupError('Verification testing is not configured.',503);
 if(typeof input.caseId!=='string'||input.caseId.length>100||typeof input.scenario!=='string'||!scenarioSignal[input.scenario]||Object.keys(input).some(k=>!['caseId','caseVersion','scenario'].includes(k)))throw new SignupError('Choose a supported sandbox check. Real identity data is not accepted here.');
 const c=await identityCase(runtime.DB,userId,input.caseId);if(input.caseVersion!==c.version)throw new SignupError('Application changed. Refresh before checking.',409);
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const claimed=await runtime.DB.prepare(`INSERT OR IGNORE INTO applicant_verification_checks
 (id,case_id,owner_user_id,case_version,scenario,signal,mode,state,attempts,created_at,updated_at) VALUES (?,?,?,?,?,?,'sandbox','pending',1,?,?)`).bind(id,input.caseId,userId,c.version,input.scenario,scenarioSignal[input.scenario],now,now).run();
 // Atomic claim before network IO: simultaneous requests/reloads reuse the record.
 if(claimed.meta.changes){
  try{
   const result=await dispatchVerifyNow(input.scenario,runtime.VERIFYNOW_API_KEY,id,transport);
   await runtime.DB.prepare(`UPDATE applicant_verification_checks SET state=?,response_hash=?,http_status=?,retry_at=?,updated_at=? WHERE id=? AND state='pending'`).bind(result.outcome,result.responseHash,result.httpStatus,['rate_limited','unavailable'].includes(result.outcome)?result.retryAt:null,new Date().toISOString(),id).run();
  }catch{
   // Timeout may mean provider completed it. Never silently dispatch again.
   await runtime.DB.prepare("UPDATE applicant_verification_checks SET state='delivery_unknown',updated_at=? WHERE id=? AND state='pending'").bind(new Date().toISOString(),id).run();
  }
 }
 return readApplicantIdentity(runtime.DB,userId,input.caseId);
}
