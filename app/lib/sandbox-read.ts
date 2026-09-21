import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import {readProductionReadiness} from './production-readiness';
import {readPassportDeliveries} from './production-passport-delivery';
import {readRereviewStatus} from './production-rereview';
import {publicPresence} from './officer-presence';
export async function sandboxRead(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>){
 const {db,policyHash}=await requireSandboxCompletion(runtime);
 if(input.action==='presence')return {...await publicPresence(db),mode:'simulator',policyHash};
 if(input.action==='company')return {authorities:(await db.prepare(`SELECT id,employer_id,expires_at,policy_version FROM sandbox_company_authority ${actor.operations?'':'WHERE user_id=?'} ORDER BY rowid DESC LIMIT 100`).bind(...(actor.operations?[]:[actor.userId])).all()).results};
 if(typeof input.officerId!=='string')throw new SignupError('Choose an officer record.');
 const link=await db.prepare("SELECT case_id,owner_user_id FROM production_entity_links WHERE kind='officer' AND entity_id=?").bind(input.officerId).first<{case_id:string;owner_user_id:string}>();if(!link||(!actor.operations&&link.owner_user_id!==actor.userId))throw new SignupError('Officer not found.',404);
 const training=await db.prepare("SELECT e.id,e.course,e.course_version,e.expires_at,EXISTS(SELECT 1 FROM sandbox_training_revocations r WHERE r.entitlement_id=e.id) AS revoked,a.id AS assessment_id,a.score,a.assessed_at FROM sandbox_training_entitlements e LEFT JOIN sandbox_training_assessments a ON a.entitlement_id=e.id WHERE e.officer_id=? ORDER BY e.rowid DESC LIMIT 100").bind(input.officerId).all();
 const incidents=await db.prepare("SELECT i.id,i.severity,i.summary,i.status,i.version,i.sla_due_at,i.reported_at FROM site_incidents i JOIN shifts s ON s.id=i.shift_id WHERE s.officer_id=? ORDER BY i.reported_at DESC LIMIT 100").bind(input.officerId).all();
 return {policyHash,...await readProductionReadiness(db,actor,input.officerId),...await readPassportDeliveries(db,actor,input.officerId),rereview:await readRereviewStatus(db,actor,link.case_id),training:training.results,incidents:incidents.results};
}
