import {agreementHash} from './agreement-acceptance';
import {SignupError} from './signup-server';
import type {SigningActor} from './production-signing';
export type PolicyWarningInput={code:string;detail:string;officerId?:string|null;entityId?:string};
export type PolicyWarning={id:string;code:string;detail:string;entity_type:string;entity_id:string;officer_id:string|null;created_at:string;override_by:string|null;override_at:string|null;override_reason:string|null};
export async function preparePolicyWarningStatements(db:D1Database,input:{entityType:string;entityId:string;officerId?:string|null;actorId:string;warnings:PolicyWarningInput[];context?:unknown}){
  const now=new Date().toISOString(),rows=[];
  for(const warning of input.warnings){
    const entityId=warning.entityId??input.entityId,officerId=warning.officerId??input.officerId??null,context=JSON.stringify(input.context??{});
    const id='WARN-'+await agreementHash(JSON.stringify([input.entityType,entityId,warning.code,warning.detail,context]));
    rows.push({id,entityType:input.entityType,entityId,officerId,code:warning.code,detail:warning.detail,context,actorId:input.actorId,createdAt:now});
  }
  // One pair of statements per bounded JSON batch keeps large payrolls within D1 query limits.
  const statements:D1PreparedStatement[]=[];
  for(let i=0;i<rows.length;i+=40){
    const json=JSON.stringify(rows.slice(i,i+40));
    statements.push(
      db.prepare("INSERT OR IGNORE INTO workforce_policy_warnings(id,entity_type,entity_id,officer_id,code,detail,context_json,observed_by,created_at) SELECT json_extract(value,'$.id'),json_extract(value,'$.entityType'),json_extract(value,'$.entityId'),json_extract(value,'$.officerId'),json_extract(value,'$.code'),json_extract(value,'$.detail'),json_extract(value,'$.context'),json_extract(value,'$.actorId'),json_extract(value,'$.createdAt') FROM json_each(?)").bind(json),
      db.prepare("INSERT OR IGNORE INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-'||w.id,'operations',w.observed_by,'workforce_policy_warning','policy_warning',w.id,json_object('code',w.code,'detail',w.detail,'entityType',w.entity_type,'entityId',w.entity_id,'context',json(w.context_json)),w.created_at FROM workforce_policy_warnings w WHERE w.id IN (SELECT json_extract(value,'$.id') FROM json_each(?))").bind(json),
    );
  }
  return statements;
}
export async function recordPolicyWarnings(db:D1Database,input:Parameters<typeof preparePolicyWarningStatements>[1]){
  const statements=await preparePolicyWarningStatements(db,input);
  for(let i=0;i<statements.length;i+=2)await db.batch(statements.slice(i,i+2));
}
export async function readPolicyWarnings(db:D1Database):Promise<PolicyWarning[]>{
  return (await db.prepare(`SELECT w.id,w.code,w.detail,w.entity_type,w.entity_id,w.officer_id,w.created_at,o.actor_id AS override_by,o.created_at AS override_at,o.reason AS override_reason FROM workforce_policy_warnings w LEFT JOIN workforce_policy_overrides o ON o.warning_id=w.id ORDER BY w.created_at DESC,w.id LIMIT 300`).all<PolicyWarning>()).results;
}
export async function overridePolicyWarning(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
  if(!actor.operations)throw new SignupError('Operations access required.',403);
  if(typeof input.warningId!=='string'||typeof input.reason!=='string'||input.reason.trim().length<3||input.reason.length>1200)throw new SignupError('Choose the warning and record the override reason.');
  if(!await db.prepare('SELECT id FROM workforce_policy_warnings WHERE id=?').bind(input.warningId).first())throw new SignupError('Warning not found.',404);
  const now=new Date().toISOString();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO workforce_policy_overrides(warning_id,actor_id,reason,created_at) VALUES(?,?,?,?)').bind(input.warningId,actor.userId,input.reason.trim(),now),
    db.prepare("INSERT OR IGNORE INTO audit_events(id,actor_type,actor_id,event_type,entity_type,entity_id,detail,created_at) SELECT 'AUD-OVERRIDE-'||warning_id,'operations',actor_id,'workforce_policy_override','policy_warning',warning_id,json_object('reason',reason,'overriddenAt',created_at),created_at FROM workforce_policy_overrides WHERE warning_id=?").bind(input.warningId),
  ]);
  return {message:'Override recorded. The warning and original evidence remain in the audit history.'};
}
