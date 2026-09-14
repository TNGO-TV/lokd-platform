import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {requireSandboxCompletion,type SandboxRuntime} from './sandbox-completion-policy';
import {agreementHash} from './agreement-acceptance';
const text=(v:unknown)=>{if(typeof v!=='string'||v.length<2||v.length>300)throw new SignupError('Provide a bounded evidence reference.');return v;};
const digest=(v:unknown)=>{const s=text(v);if(!/^[a-f0-9]{64}$/.test(s))throw new SignupError('Provide the source SHA-256.');return s;};
export async function operateSandboxWorkforce(runtime:SandboxRuntime,actor:SigningActor,input:Record<string,unknown>){
 const {db,policy}=await requireSandboxCompletion(runtime),now=new Date().toISOString();
 if(input.action==='grant_company_authority'){
  if(!actor.operations||!actor.owner||input.userId===actor.userId)throw new SignupError('An independent owner assigns company authority.',403);
  const id=crypto.randomUUID(),expires=new Date(Date.now()+policy.retentionDays*86400000).toISOString();
  if(!await db.prepare("SELECT id FROM workforce_employers WHERE id=? AND employer_type='partner_company' AND environment='production'").bind(text(input.employerId)).first())throw new SignupError('Choose the sandbox partner employer.',409);
  await db.prepare('INSERT INTO sandbox_company_authority VALUES(?,?,?,?,?,?,?,?)').bind(id,input.employerId,text(input.userId),text(input.mandateReference),digest(input.mandateHash),actor.userId,expires,policy.version).run();return {authorityId:id,expiresAt:expires};
 }
 if(input.action==='confirm_partner_responsibility'){
  if(actor.operations||input.payrollAccepted!==true||input.benefitsAccepted!==true)throw new SignupError('The assigned company representative must explicitly confirm both responsibilities.',403);
  const authority=await db.prepare('SELECT * FROM sandbox_company_authority WHERE id=? AND user_id=? AND policy_version=? AND expires_at>?').bind(text(input.authorityId),actor.userId,policy.version,now).first<{id:string;employer_id:string;expires_at:string}>();
  const engagement=await db.prepare("SELECT * FROM workforce_engagements WHERE id=? AND model='partner' AND status='active' AND active_key=officer_id").bind(text(input.engagementId)).first<{id:string;employer_id:string;version:number;review_due_at:string}>();
  if(!authority||!engagement||authority.employer_id!==engagement.employer_id||engagement.version!==input.expectedVersion)throw new SignupError('Current bound company authority and engagement required.',409);
  const expires=new Date(Math.min(Date.parse(authority.expires_at),Date.parse(engagement.review_due_at),Date.now()+policy.evidenceHours*3600000)).toISOString();
  const source={engagementId:engagement.id,employerId:engagement.employer_id,engagementVersion:engagement.version,payroll:{reference:text(input.payrollReference),sha256:digest(input.payrollHash),responsibleEmployer:engagement.employer_id},benefits:{reference:text(input.benefitsReference),sha256:digest(input.benefitsHash),responsibleEmployer:engagement.employer_id},policyVersion:policy.version};
  const json=JSON.stringify(source),id=crypto.randomUUID();await db.prepare('INSERT INTO sandbox_partner_responsibilities VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,engagement.id,engagement.version,engagement.employer_id,authority.id,json,await agreementHash(json),actor.userId,now,expires,policy.version).run();return {responsibilityId:id,pendingIndependentApproval:true,expiresAt:expires};
 }
 if(input.action==='decide_partner_responsibility'){
  if(!actor.operations||!actor.owner||input.independentlyChecked!==true||!['approve','reject'].includes(String(input.decision)))throw new SignupError('Independent owner evidence review required.',403);
  const r=await db.prepare('SELECT source_json,source_hash FROM sandbox_partner_responsibilities WHERE id=?').bind(text(input.responsibilityId)).first<{source_json:string;source_hash:string}>();if(!r||await agreementHash(r.source_json)!==r.source_hash)throw new SignupError('Source evidence integrity failed.',409);
  await db.prepare('INSERT INTO sandbox_partner_decisions VALUES(?,?,?,?,?)').bind(input.responsibilityId,input.decision,actor.userId,text(input.reason),now).run();return {decision:input.decision,productionWorkEligible:false};
 }
 throw new SignupError('Unsupported sandbox workforce action.');
}
