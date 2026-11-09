import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
import {recordPolicyWarnings} from './workforce-policy-warnings';
export async function changeOfficerPayBasis(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
  if(!actor.operations)throw new SignupError('Operations access required.',403);
  if(typeof input.engagementId!=='string'||!['hourly','monthly'].includes(String(input.payBasis))||!Number.isSafeInteger(input.expectedVersion)||!['weekly','daily','monthly'].includes(String(input.payCadence))||typeof input.agreedHourlyRateCents!=='number'||!Number.isSafeInteger(input.agreedHourlyRateCents)||input.agreedHourlyRateCents<0||input.agreedHourlyRateCents>10000000||typeof input.reference!=='string'||input.reference.trim().length<3||input.reference.length>1200)throw new SignupError('Choose the current engagement and record valid pay-basis values and a reviewed document reference.');
  const row=await db.prepare("SELECT id,officer_id,pay_basis,version FROM workforce_engagements WHERE id=? AND environment='production' AND active_key=officer_id AND status='active'").bind(input.engagementId).first<{id:string;officer_id:string;pay_basis:string;version:number}>();
  if(!row)throw new SignupError('Officer engagement not found.',404);
  if(row.version!==input.expectedVersion)throw new SignupError('The engagement changed. Refresh before editing.',409);
  const request=typeof input.payCadenceRequestReference==='string'?input.payCadenceRequestReference.trim():null;
  if(request&&request.length>1200)throw new SignupError('The officer request reference is too long.');
  const now=new Date().toISOString(),id=crypto.randomUUID();
  const result=await db.batch([
    db.prepare('UPDATE workforce_engagements SET pay_basis=?,agreed_hourly_rate_cents=?,pay_cadence=?,pay_cadence_request_reference=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(input.payBasis,input.agreedHourlyRateCents,input.payCadence,request,now,row.id,row.version),
    db.prepare("INSERT INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT ?,'operations',?,'officer_pay_basis_reviewed','workforce_engagement',id,?,? FROM workforce_engagements WHERE id=? AND version=? AND updated_at=?").bind(id,actor.userId,JSON.stringify({previousPayBasis:row.pay_basis,payBasis:input.payBasis,agreedHourlyRateCents:input.agreedHourlyRateCents,payCadence:input.payCadence,officerRequestReference:request,reviewedDocumentReference:input.reference}),now,row.id,row.version+1,now),
  ]);
  if(result[0].meta.changes!==1)throw new SignupError('The engagement changed before the edit was saved.',409);
  const warnings=[];
  if(input.payBasis==='hourly'&&input.payCadence!=='weekly'&&!request)warnings.push({code:'PAY_CADENCE_REQUEST_REVIEW',detail:'Review the officer request for daily or monthly pay.'});
  if(row.pay_basis!==input.payBasis)warnings.push({code:'AGREEMENT_PAY_BASIS_REVIEW',detail:'Pay basis changed. Review the applicable agreement document reference; accepted documents and previous assignments retain their recorded basis.'});
  await recordPolicyWarnings(db,{entityType:'workforce_engagement',entityId:row.id,officerId:row.officer_id,actorId:actor.userId,warnings,context:{version:row.version+1}});
  return {message:'Pay basis saved. Previous assignment and payroll records remain unchanged.'};
}
