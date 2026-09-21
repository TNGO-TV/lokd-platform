import {importFinanceTraining} from './sandbox-training-finance';
import {SignupError} from './signup-server';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import type {SigningActor} from './production-signing';
import {agreementHash} from './agreement-acceptance';
import {prepareReadinessReview} from './production-readiness';
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new SignupError('Provide a bounded training reference.');return v.trim();};
// Commercial sources come from the authenticated finance sandbox contract.
export async function sandboxTraining(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>){
 const {db,policy}=await requireSandboxCompletion(runtime),now=new Date().toISOString();
 if(input.action==='import_finance')return importFinanceTraining(runtime,actor,input);
 if(!actor.operations)throw new SignupError('Training administration requires Operations.',403);
 if(input.action==='assess'){
  const e=await db.prepare("SELECT e.* FROM sandbox_training_entitlements e JOIN production_entity_links l ON l.entity_id=e.officer_id AND l.kind='officer' AND l.owner_user_id=e.owner_user_id AND l.case_version=e.applicant_version JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed' WHERE e.id=? AND e.expires_at>? AND NOT EXISTS(SELECT 1 FROM sandbox_training_revocations r WHERE r.entitlement_id=e.id)").bind(text(input.entitlementId),now).first<{id:string;officer_id:string;owner_user_id:string;course:string;course_version:string;source_hash:string;expires_at:string;issued_by:string;source_json:string}>();
  if(!e||e.owner_user_id===actor.userId||e.issued_by===actor.userId||JSON.parse(e.source_json).completionReviewer===actor.userId)throw new SignupError('An independent assessor and current entitlement are required.',403);
  const score=input.scorePercent;if(!Number.isSafeInteger(score)||Number(score)<0||Number(score)>100||input.evidenceInspected!==true)throw new SignupError('Inspect the versioned assessment and record a score from 0 to 100.');
  const id=crypto.randomUUID(),source={entitlementHash:e.source_hash,course:e.course,courseVersion:e.course_version,scorePercent:score,passPercent:policy.trainingPassPercent,assessmentReference:text(input.assessmentReference),policyVersion:policy.version},json=JSON.stringify(source),hash=await agreementHash(json),expires=new Date(Math.min(Date.parse(e.expires_at),Date.now()+policy.trainingQualificationDays*86400000)).toISOString();
  await db.prepare('INSERT INTO sandbox_training_assessments VALUES(?,?,?,?,?,?,?,?,?)').bind(id,e.id,score,json,hash,actor.userId,now,expires,policy.version).run();
  if(Number(score)<policy.trainingPassPercent)return {assessmentId:id,passed:false,workEligible:false};
  const review=await prepareReadinessReview(db,actor,{officerId:e.officer_id,officerReviewId:text(input.officerReviewId),ruleId:text(input.ruleId),sourcesActuallyInspected:true,evidence:[{requirement:'training:'+e.course,ownerUserId:e.owner_user_id,reference:'sandbox-training:'+id,sha256:hash,checkedAt:now,expiresAt:expires}]});
  return {...review,assessmentId:id,passed:true,qualified:false};
 }
 if(input.action==='revoke'){
  const id=text(input.entitlementId),reason=text(input.reason);if(!actor.owner)throw new SignupError('An owner must revoke the entitlement source.',403);
  await db.prepare('INSERT INTO sandbox_training_revocations VALUES(?,?,?,?)').bind(id,actor.userId,reason,now).run();
  return {revoked:true,workEligible:false};
 }
 throw new SignupError('Unsupported sandbox training action.');
}
