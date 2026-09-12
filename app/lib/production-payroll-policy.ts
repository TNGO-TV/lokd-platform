import {assertPayrollPolicy,type PayrollPolicy} from './payroll-engine';
import {agreementHash} from './agreement-acceptance';
import {productionOperatorControl} from './production-operator-control';
import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
const text=(v:unknown,label:string)=>{if(typeof v!=='string'||v.trim().length<8||v.length>2000)throw new SignupError(`Provide ${label}.`);return v.trim();};
export async function readProductionPayrollPolicies(db:D1Database,actor:SigningActor){return {payrollPolicies:actor.operations?(await db.prepare("SELECT * FROM payroll_policy_versions WHERE environment='production' ORDER BY created_at DESC LIMIT 50").all()).results:[]};}
export async function manageProductionPayrollPolicy(db:D1Database,actor:SigningActor,input:Record<string,unknown>,headers:Headers){
 const now=new Date().toISOString();
 if(input.action==='prepare_payroll_policy'){
  const maker=await productionOperatorControl(db,actor,headers,'payroll.calculate',0);
  let policy:PayrollPolicy;try{policy=typeof input.rules==='string'?JSON.parse(input.rules):input.rules as PayrollPolicy;assertPayrollPolicy(policy);}catch{throw new SignupError('Provide a valid South African payroll policy using the documented policy structure.');}
  if(/synthetic|test|demo/i.test(policy.version)||!policy.sourceReferences?.length||policy.sourceReferences.some(r=>typeof r!=='string'||!r.startsWith('https://')||/example\.(invalid|test)/i.test(r)))throw new SignupError('Production payroll policy requires actual source references and its own reviewed version.');
  if(input.sourcesReviewed!==true)throw new SignupError('Confirm review of the actual statutory and employment sources.');
  const source=text(input.sourceReference,'the source-review record'),rules=JSON.stringify(policy);if(rules.length>16000)throw new SignupError('Payroll policy is too large.');const id='POL-'+crypto.randomUUID(),hash=await agreementHash(rules);
  await db.batch([db.prepare("INSERT INTO payroll_policy_versions(id,jurisdiction,currency,effective_from,effective_to,status,rules_json,policy_hash,source_reference,environment,integrity_state,created_by,created_at) VALUES(?,'ZA','ZAR',?,?,'draft',?,?,?,'production','production_verified',?,?)").bind(id,policy.effectiveFrom,policy.effectiveTo,rules,hash,source,maker.id,now),db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_payroll_policy_prepared','payroll_policy',?,?,?)").bind(crypto.randomUUID(),actor.userId,id,JSON.stringify({hash,source}),now)]);return {policyId:id,active:false};
 }
 const id=text(input.policyId,'the payroll policy reference'),p=await db.prepare("SELECT * FROM payroll_policy_versions WHERE id=? AND environment='production' AND integrity_state='production_verified'").bind(id).first<{id:string;status:string;version:number;policy_hash:string;rules_json:string;created_by:string;reviewed_by:string|null}>();if(!p)throw new SignupError('Production payroll policy not found.',404);
 if(input.version!==p.version||input.policyHash!==p.policy_hash||await agreementHash(p.rules_json)!==p.policy_hash)throw new SignupError('Payroll policy changed. Refresh and review the exact rules again.',409);
 const reason=text(input.reason,'independent payroll findings');let status:string,statement:D1PreparedStatement;
 if(input.action==='review_payroll_policy'){
  const reviewer=await productionOperatorControl(db,actor,headers,'payroll.first_approve',0,p.created_by);
  if(p.status!=='draft'||input.sourcesReviewed!==true)throw new SignupError('Review the exact draft and source evidence before approval.',409);status='reviewed';
  statement=db.prepare("UPDATE payroll_policy_versions SET status='reviewed',reviewed_by=?,reviewed_at=?,version=version+1 WHERE id=? AND status='draft' AND version=?").bind(reviewer.id,now,id,p.version);
 }else if(input.action==='activate_payroll_policy'){
  const approver=await productionOperatorControl(db,actor,headers,'payroll.second_approve',0,p.created_by);
  if(p.status!=='reviewed'||approver.id===p.reviewed_by||input.sourcesReviewed!==true)throw new SignupError('A third authorised person must independently approve the reviewed payroll rules.',403);status='active';
  statement=db.prepare("UPDATE payroll_policy_versions SET status='active',approved_by=?,activated_at=?,active_key='production:ZA',version=version+1 WHERE id=? AND status='reviewed' AND version=?").bind(approver.id,now,id,p.version);
 }else if(input.action==='withdraw_payroll_policy'){
  await productionOperatorControl(db,actor,headers,'payroll.second_approve',0);if(!['active','reviewed','draft'].includes(p.status))throw new SignupError('This policy is already withdrawn.',409);status='withdrawn';statement=db.prepare("UPDATE payroll_policy_versions SET status='withdrawn',active_key=NULL,version=version+1 WHERE id=? AND version=?").bind(id,p.version);
 }else throw new SignupError('Choose a supported payroll policy action.');
 // The unique active key requires an explicit withdrawal before replacement;
 // this prevents a stale concurrent activation from silently replacing policy.
 const result=await db.batch([db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'production_payroll_policy_decided','payroll_policy',?,?,?)").bind(crypto.randomUUID(),actor.userId,id,JSON.stringify({status,reason,hash:p.policy_hash,expectedVersion:p.version}),now),statement]);
 if(!result[1].meta.changes)throw new SignupError('Another policy decision completed. Refresh before continuing.',409);return {policyId:id,status,paymentApproved:false};
}
