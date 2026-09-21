import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import {agreementHash} from './agreement-acceptance';
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new SignupError('Provide a bounded engagement reference.');return v.trim();};
export async function sandboxEngagement(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>){
 const {db,policy}=await requireSandboxCompletion(runtime),now=new Date().toISOString();
 if(!actor.operations)throw new SignupError('Operations engagement access required.',403);
 if(input.action==='prepare_transition'){
  const old=await db.prepare("SELECT w.*,l.owner_user_id FROM workforce_engagements w JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=w.officer_id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed' WHERE w.id=? AND w.status='active' AND w.active_key=w.officer_id").bind(text(input.engagementId)).first<{id:string;officer_id:string;version:number;owner_user_id:string}>();
  if(!old||old.version!==input.expectedVersion||old.owner_user_id===actor.userId)throw new SignupError('Current independently reviewed engagement required.',409);
  const model=String(input.model) as keyof typeof policy.weeklyHours;if(!Object.hasOwn(policy.weeklyHours,model))throw new SignupError('Choose the next workforce model.');
  const source={previousId:old.id,previousVersion:old.version,officerId:old.officer_id,nextId:text(input.nextEngagementId),employerId:text(input.employerId),model,termsVersion:text(input.termsVersion),reference:text(input.reference),weeklyHourCap:policy.weeklyHours[model],policyVersion:policy.version};
  const id=crypto.randomUUID(),json=JSON.stringify(source);await db.prepare('INSERT INTO sandbox_engagement_transitions VALUES(?,?,?,?,?,?,?)').bind(id,old.id,old.version,json,await agreementHash(json),actor.userId,now).run();return {transitionId:id,pendingIndependentApproval:true,workEligible:false};
 }
 if(input.action==='decide_transition'){
  if(!actor.owner||input.independentlyChecked!==true||!['approve','reject'].includes(String(input.decision)))throw new SignupError('Independent owner review required.',403);
  const row=await db.prepare('SELECT source_json,source_hash FROM sandbox_engagement_transitions WHERE id=?').bind(text(input.transitionId)).first<{source_json:string;source_hash:string}>();if(!row||await agreementHash(row.source_json)!==row.source_hash)throw new SignupError('Transition source integrity failed.',409);
  await db.prepare('INSERT INTO sandbox_engagement_decisions VALUES(?,?,?,?,?)').bind(input.transitionId,input.decision,actor.userId,text(input.reason),now).run();return {decision:input.decision,effectiveAt:now,workEligible:false,requiresNewTerms:true,requiresDisposition:input.decision==='approve',nextEngagement:JSON.parse(row.source_json)};
 }
 if(input.action==='period_inputs'){
  const start=text(input.periodStart),end=text(input.periodEnd);if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw new SignupError('Use an inclusive SAST service-date interval.');
  const rows=await db.prepare("SELECT id,version,shift_id,officer_id,workforce_engagement_id,employer_id,workforce_model,service_date,payable_minutes,gross_wage_cents FROM shift_timesheets WHERE officer_id=? AND service_date BETWEEN ? AND ? AND operations_status='approved_for_backend' ORDER BY service_date,id").bind(text(input.officerId),start,end).all<Record<string,unknown>>();
  const groups=new Map<string,Record<string,unknown>[]>();for(const r of rows.results){const key=String(r.workforce_engagement_id);groups.set(key,[...(groups.get(key)??[]),r]);}
  const data={contract:'lokd.workforce-period-inputs.v1',mode:'sandbox',policyVersion:policy.version,calendar:'Africa/Johannesburg',periodStart:start,periodEnd:end,officerId:input.officerId,groups:[...groups].map(([engagementId,sources])=>({engagementId,employerId:sources[0].employer_id,model:sources[0].workforce_model,sources,payableMinutes:sources.reduce((n,r)=>n+Number(r.payable_minutes),0),grossCents:sources.reduce((n,r)=>n+Number(r.gross_wage_cents),0)}))};
  return {...data,sourceHash:await agreementHash(JSON.stringify(data)),paymentReleased:false};
 }
 throw new SignupError('Unsupported engagement action.');
}
