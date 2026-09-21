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
 const checks=await db.prepare(`SELECT id,scenario,signal,state,attempts,recovery_note AS recoveryNote,recovery_actor AS recoveryActor,http_status AS httpStatus,retry_at AS retryAt,created_at AS createdAt,updated_at AS updatedAt
 FROM applicant_verification_checks WHERE case_id=? AND owner_user_id=? AND case_version=? ORDER BY created_at DESC,rowid DESC`).bind(id,userId,c.version).all<{signal:string;state:string}>();
 const history=await db.prepare('SELECT e.snapshot,e.recorded_at AS recordedAt FROM verification_recovery_events e JOIN applicant_verification_checks c ON c.id=e.check_id WHERE c.case_id=? AND c.owner_user_id=? ORDER BY e.rowid DESC LIMIT 100').bind(id,userId).all();
 const entry=checks.results.find(r=>r.signal==='id');
 return {caseId:id,caseVersion:c.version,mode:'sandbox',identityVerified:false,workEligible:false,checks:checks.results,history:history.results,
  nextStep:entry?.state==='mock_approved'?(applicationPsiraDeclaration(c.pathway,c.psiraStatus)==='registered'?'registered_enrolment':'training_options'):'entry_id',
  enrolment:{applicable:applicationPsiraDeclaration(c.pathway,c.psiraStatus)==='registered',amountMinor:applicationPsiraDeclaration(c.pathway,c.psiraStatus)==='registered'?35000:null,currency:'ZAR',priceApproved:true,paymentState:'not_started',liveChargingEnabled:false},
  independentStates:{face:checks.results.find(r=>r.signal==='face')?.state??'not_started',bank:checks.results.find(r=>r.signal==='bank')?.state??'not_started',psira:'separate_workflow',training:'options_pending',activation:'not_approved'}};
}
const cooldownSql="NOT EXISTS (SELECT 1 FROM applicant_verification_checks WHERE state='pending' OR retry_at>?)";
async function executeCheck(runtime:Runtime,id:string,scenario:string,transport:typeof fetch){
 try{
  const result=await dispatchVerifyNow(scenario,runtime.VERIFYNOW_API_KEY!,id,transport);
  const retryAt=['rate_limited','unavailable'].includes(result.outcome)?result.retryAt:new Date(Date.now()+3000).toISOString();
  await runtime.DB!.prepare(`UPDATE applicant_verification_checks SET state=?,response_hash=?,http_status=?,retry_at=?,updated_at=? WHERE id=? AND state='pending'`).bind(result.outcome,result.responseHash,result.httpStatus,retryAt,new Date().toISOString(),id).run();
 }catch{
  await runtime.DB!.prepare("UPDATE applicant_verification_checks SET state='delivery_unknown',retry_at=?,updated_at=? WHERE id=? AND state='pending'").bind(new Date(Date.now()+60000).toISOString(),new Date().toISOString(),id).run();
 }
}
function configured(runtime:Runtime){if(!runtime.DB||runtime.VERIFYNOW_SANDBOX_ENABLED!=='true'||!runtime.VERIFYNOW_API_KEY)throw new SignupError('Verification testing is not configured.',503);return runtime.DB;}
export async function runApplicantIdentity(runtime:Runtime,userId:string,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const db=configured(runtime);
 if(typeof input.caseId!=='string'||input.caseId.length>100||typeof input.scenario!=='string'||!scenarioSignal[input.scenario]||Object.keys(input).some(k=>!['caseId','caseVersion','scenario'].includes(k)))throw new SignupError('Choose a supported sandbox check. Real identity data is not accepted here.');
 const c=await identityCase(db,userId,input.caseId);if(input.caseVersion!==c.version)throw new SignupError('Application changed. Refresh before checking.',409);
 const existing=await db.prepare('SELECT id FROM applicant_verification_checks WHERE case_id=? AND owner_user_id=? AND case_version=? AND scenario=?').bind(input.caseId,userId,c.version,input.scenario).first();
 if(existing)return readApplicantIdentity(db,userId,input.caseId);
 const id=crypto.randomUUID(),now=new Date().toISOString();
 const claimed=await db.prepare(`INSERT OR IGNORE INTO applicant_verification_checks
 (id,case_id,owner_user_id,case_version,scenario,signal,mode,state,attempts,created_at,updated_at)
 SELECT ?,?,?,?,?,?,'sandbox','pending',1,?,? WHERE ${cooldownSql}`).bind(id,input.caseId,userId,c.version,input.scenario,scenarioSignal[input.scenario],now,now,now).run();
 if(claimed.meta.changes)await executeCheck(runtime,id,input.scenario,transport);
 else if(!await db.prepare('SELECT id FROM applicant_verification_checks WHERE case_id=? AND owner_user_id=? AND case_version=? AND scenario=?').bind(input.caseId,userId,c.version,input.scenario).first())throw new SignupError('Provider check in progress or cooldown active. Wait and refresh; no request was sent.',429);
 return readApplicantIdentity(db,userId,input.caseId);
}
// Only the API's server-verified Operations actor may call this command.
export async function recoverApplicantIdentity(runtime:Runtime,operator:string,input:Record<string,unknown>,transport:typeof fetch=fetch){
 const db=configured(runtime);
 if(typeof input.checkId!=='string'||typeof input.caseId!=='string'||typeof input.note!=='string'||input.note.trim().length<12||input.note.length>1200)throw new SignupError('Provide the check and a specific review/evidence note.');
 const check=await db.prepare('SELECT * FROM applicant_verification_checks WHERE id=? AND case_id=?').bind(input.checkId,input.caseId).first<{id:string;case_id:string;owner_user_id:string;case_version:number;scenario:string;state:string;attempts:number;retry_at:string|null;updated_at:string}>();
 if(!check)throw new SignupError('Check not found.',404);
 if(operator===check.owner_user_id)throw new SignupError('Another Operations reviewer must handle your own check.',403);
 const c=await identityCase(db,check.owner_user_id,check.case_id);
 if(c.version!==input.caseVersion||c.version!==check.case_version||check.attempts!==input.expectedAttempts)throw new SignupError('Check or application changed. Refresh before acting.',409);
 const now=new Date().toISOString();
 if(input.action==='resolve_unknown'){
  if(check.state!=='delivery_unknown'&&!(check.state==='pending'&&Date.parse(check.updated_at)<Date.now()-60000))throw new SignupError('Only unknown or stale pending delivery can be reconciled.',409);
  if(input.noResultConfirmed!==true)throw new SignupError('Confirm external provider review found no completed result before authorising retry.');
  const changed=await db.prepare(`UPDATE applicant_verification_checks SET state='retry_authorized',recovery_actor=?,recovery_note=?,retry_at=?,updated_at=? WHERE id=? AND state=? AND attempts=? AND updated_at=?`).bind(operator,input.note,new Date(Math.max(Date.now()+60000,Date.parse(check.retry_at??now))).toISOString(),now,check.id,check.state,check.attempts,check.updated_at).run();
  if(!changed.meta.changes)throw new SignupError('Check changed. Refresh.',409);
 }else if(input.action==='retry'){
  if(!['rate_limited','unavailable','retry_authorized'].includes(check.state))throw new SignupError('This outcome is not retryable. Review evidence first.',409);
  if(check.attempts>=3)throw new SignupError('Three dispatches reached. Escalate provider review.',409);
  if(!check.retry_at||Date.parse(check.retry_at)>Date.now())throw new SignupError('Provider retry time has not arrived.',429);
  const changed=await db.prepare(`UPDATE applicant_verification_checks SET state='pending',attempts=attempts+1,recovery_actor=?,recovery_note=?,updated_at=? WHERE id=? AND state=? AND attempts=? AND ${cooldownSql}`).bind(operator,input.note,now,check.id,check.state,check.attempts,now).run();
  if(!changed.meta.changes)throw new SignupError('Another request is running, cooldown is active or this check changed.',409);
  // Stable provider idempotency key across retries of the same logical request.
  await executeCheck(runtime,check.id,check.scenario,transport);
 }else throw new SignupError('Choose a valid recovery action.');
 return readApplicantIdentity(db,check.owner_user_id,check.case_id);
}
