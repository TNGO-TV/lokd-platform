import {SignupError} from './signup-server';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import {financeReadiness} from './finance-workflows';
import {agreementHash} from './agreement-acceptance';
import type {SigningActor} from './production-signing';
const ref=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new SignupError('Provide a bounded finance reference.');return v.trim();};
// Applicant-authorized import of already reviewed commercial completion. The
// assessor and readiness checker remain separate; no purchase grants readiness.
export async function importFinanceTraining(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>){
 const {db,policy}=await requireSandboxCompletion(runtime),workspace=ref(input.workspace),applicationId=ref(input.applicationId),entitlementId=ref(input.financeEntitlementId),completionId=ref(input.completionId);
 const fence=await db.prepare('SELECT coalesce((SELECT max(sequence) FROM finance_records WHERE workspace_id=?),0) records,coalesce((SELECT max(sequence) FROM finance_provider_evidence WHERE workspace_id=?),0) evidence,(SELECT count(*) FROM finance_provider_conflicts WHERE workspace_id=?) conflicts').bind(workspace,workspace,workspace).first<{records:number;evidence:number;conflicts:number}>();
 const readiness=await financeReadiness(db,actor,{LOKD_FINANCE_ENVIRONMENT:'sandbox'},workspace,applicationId);
 const rows=(await db.prepare('SELECT * FROM finance_current_records WHERE workspace_id=? AND owner_user_id=? AND id IN(?,?)').bind(workspace,actor.userId,entitlementId,completionId).all<{id:string;kind:string;data_json:string;version:number;command_id:string;digest:string}>()).results;
 const e=rows.find(r=>r.id===entitlementId&&r.kind==='entitlement'),completion=rows.find(r=>r.id===completionId&&r.kind==='completion');
 if(!e||!completion)throw new SignupError('Private finance entitlement and reviewed completion required.',404);
 const data=JSON.parse(e.data_json),done=JSON.parse(completion.data_json);
 if(done.entitlementId!==e.id||data.applicationId!==applicationId||!readiness.training.some(t=>t.orderId===data.orderId&&t.usable))throw new SignupError('Current paid training and separately reviewed completion required.',409);
 const order=await db.prepare("SELECT data_json,version FROM finance_current_records WHERE workspace_id=? AND id=? AND kind='order' AND owner_user_id=?").bind(workspace,data.orderId,actor.userId).first<{data_json:string;version:number}>();
 const linked=await db.prepare("SELECT l.entity_id FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed' WHERE l.kind='officer' AND l.case_id=? AND l.owner_user_id=? AND l.case_version=?").bind(applicationId,actor.userId,readiness.applicationVersion).first<{entity_id:string}>();
 const review=await db.prepare("SELECT a.reviewer_user_id,c.maker_user_id FROM finance_command_applications a JOIN finance_workflow_commands c ON c.id=a.command_id WHERE a.command_id=? AND a.decision='approved'").bind(completion.command_id).first<{reviewer_user_id:string;maker_user_id:string}>();
 if(!order||!linked||!review||review.reviewer_user_id===review.maker_user_id||[review.reviewer_user_id,review.maker_user_id].includes(actor.userId))throw new SignupError('Independent finance completion and current linked applicant required.',409);
 const pkg=JSON.parse(order.data_json).package,course=ref(pkg.packageId),courseVersion=String(pkg.packageVersion),id=crypto.randomUUID();
 const source={contract:'lokd.finance-training-readiness.v1',mode:'simulator',workspace,applicationId,applicantVersion:readiness.applicationVersion,financeEntitlementId:entitlementId,completionId,course,courseVersion,financeRecordIds:[entitlementId,completionId,data.orderId,...data.payments],financeFence:fence,completionMaker:review.maker_user_id,completionReviewer:review.reviewer_user_id,entitlementDigest:e.digest,completionDigest:completion.digest,policyVersion:policy.version};
 const json=JSON.stringify(source),expiry=new Date(Math.min(Date.parse(data.expiresAt),Date.now()+policy.trainingQualificationDays*86400000)).toISOString();
 await db.prepare('INSERT INTO sandbox_training_entitlements VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,linked.entity_id,actor.userId,readiness.applicationVersion,course,courseVersion,json,await agreementHash(json),review.maker_user_id,expiry,policy.version).run();
 return {entitlementId:id,course,courseVersion,qualified:false,workEligible:false,mode:'simulator'};
}
