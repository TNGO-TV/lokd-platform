import {SignupError} from './signup-server';
import {readProductionReadiness} from './production-readiness';
import {readRereviewStatus} from './production-rereview';
import {readPassportDeliveries} from './production-passport-delivery';
import type {SigningActor} from './production-signing';

import {IDENTITY_WORKSPACE_CONTRACT} from './production-identity-contract';
export const identityWorkspaceContract=IDENTITY_WORKSPACE_CONTRACT;
export const reviewTypes=['identity','officer','rule','review','passport','disposition','workforce'] as const;
export type IdentityReviewType=typeof reviewTypes[number];
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>300)throw new SignupError('Choose a valid record.');return v.trim();};
const ops=(a:SigningActor)=>{if(!a.operations)throw new SignupError('Operations review access required.',403);};
function page(v:unknown){const n=Number(v??0);if(!Number.isSafeInteger(n)||n<0||n>100000)throw new SignupError('Choose a valid page.');return n;}
function type(v:unknown):IdentityReviewType{if(!reviewTypes.includes(v as IdentityReviewType))throw new SignupError('Choose a supported review type.');return v as IdentityReviewType;}
function unpack(row:Record<string,unknown>){const result={...row};delete result.token_hash;for(const key of Object.keys(result))if(key.endsWith('_json')&&typeof result[key]==='string'){result[key.slice(0,-5)]=JSON.parse(result[key] as string);delete result[key];}return result;}
const caseSelect=`SELECT a.id AS applicantId,c.owner_user_id AS ownerUserId,coalesce(c.version,0) AS applicantVersion,coalesce(c.status,'awaiting_review') AS intakeStatus,c.public_note AS publicNote,c.corrections_json AS corrections,a.full_name AS fullName,a.email_normalized AS email,a.city,l.entity_id AS officerId,l.case_version AS linkedVersion FROM officer_applications a LEFT JOIN signup_cases c ON c.kind='officer' AND c.source_id=a.id LEFT JOIN production_entity_links l ON l.kind='officer' AND l.case_id=a.id WHERE a.environment='prelaunch' AND a.integrity_state='user_submitted'`;
export async function readIdentityCases(db:D1Database,a:SigningActor,offset:unknown){
 const start=page(offset),rows=await db.prepare(caseSelect+(a.operations?'':' AND c.owner_user_id=?')+' ORDER BY a.created_at DESC,a.id DESC LIMIT 51 OFFSET ?').bind(...(a.operations?[]:[a.userId]),start).all();
 return {contract:identityWorkspaceContract,cases:rows.results.slice(0,50).map(r=>{const corrections=JSON.parse(String(r.corrections??'{}'));return {...r,fullName:corrections.fullName??r.fullName,city:corrections.city??r.city,corrections};}),nextOffset:rows.results.length>50?start+50:null,workEligible:false};
}
export async function readIdentityCase(db:D1Database,a:SigningActor,applicantId:string){
 const row=await db.prepare(caseSelect+' AND a.id=?'+(a.operations?'':' AND c.owner_user_id=?')).bind(text(applicantId),...(a.operations?[]:[a.userId])).first<Record<string,unknown>>();
 if(!row)throw new SignupError('Applicant not found.',404);
 const identities=await db.prepare(`SELECT c.id,c.applicant_version AS applicantVersion,c.created_at AS createdAt,o.id AS outcomeId,o.outcome,CASE WHEN e.id IS NOT NULL THEN 1 ELSE 0 END AS identityVerified FROM production_identity_cases c LEFT JOIN production_identity_outcomes o ON o.case_id=c.id AND o.sequence=(SELECT max(sequence) FROM production_identity_outcomes WHERE case_id=c.id) LEFT JOIN current_production_identity_evidence e ON e.id=c.id WHERE c.applicant_id=? ORDER BY c.rowid DESC LIMIT 50`).bind(applicantId).all();
 const psira=await db.prepare('SELECT id,version,latest_event_id AS latestEventId FROM psira_verification_cases WHERE owner_user_id=? ORDER BY rowid DESC LIMIT 50').bind(row.ownerUserId??'').all();
 const events=await db.prepare("SELECT id,version,action,public_note AS note,recorded_at AS recordedAt FROM signup_events WHERE kind='officer' AND source_id=? ORDER BY version DESC LIMIT 50").bind(applicantId).all();
 const officerId=row.officerId as string|null;
 const original=await db.prepare("SELECT full_name AS fullName,mobile_normalized AS mobile,city,province,pathway,psira_status AS psiraStatus,psira_number AS psiraNumber,psira_grade AS psiraGrade,service_interests AS services,purpose_interests AS purposes,training_interests AS training FROM officer_applications WHERE id=?").bind(applicantId).first();
 if(original)for(const field of ['services','purposes','training'])original[field]=JSON.parse(String(original[field]??'[]'));
 return {contract:identityWorkspaceContract,case:{...row,corrections:JSON.parse(String(row.corrections??'{}')),details:{...original,...JSON.parse(String(row.corrections??'{}'))}},identities:identities.results,psira:psira.results,intakeEvents:events.results,
 readiness:officerId?await readProductionReadiness(db,a,officerId):null,
 holds:a.operations?await officerHolds(db,officerId,applicantId):undefined,
 rereview:row.ownerUserId?await readRereviewStatus(db,a,applicantId):null,
 deliveries:officerId?(await readPassportDeliveries(db,a,officerId)).deliveries:[],workEligible:false};
}
const definitions={
 identity:{table:'production_identity_cases',decision:"LEFT JOIN production_identity_outcomes o ON o.case_id=r.id AND o.sequence=(SELECT max(sequence) FROM production_identity_outcomes WHERE case_id=r.id) LEFT JOIN production_identity_decisions d ON d.outcome_id=o.id",summary:'r.id,r.applicant_id AS applicantId,r.applicant_version AS applicantVersion,r.created_at AS preparedAt,o.id AS outcomeId,o.outcome,d.decision',pending:'d.outcome_id IS NULL'},
 officer:{table:'production_officer_reviews',decision:'LEFT JOIN production_officer_decisions d ON d.review_id=r.id',summary:'r.id,r.officer_id AS officerId,r.prepared_by AS preparedBy,r.prepared_at AS preparedAt,d.decision',pending:'d.review_id IS NULL'},
 rule:{table:'production_readiness_rules',decision:"LEFT JOIN production_readiness_decisions d ON d.kind='rule' AND d.target_id=r.id",summary:'r.id,r.code,r.label,r.category,r.prepared_by AS preparedBy,r.prepared_at AS preparedAt,r.expires_at AS expiresAt,d.decision',pending:'d.target_id IS NULL'},
 review:{table:'production_readiness_reviews',decision:"LEFT JOIN production_readiness_decisions d ON d.kind='review' AND d.target_id=r.id",summary:'r.id,r.officer_id AS officerId,r.rule_id AS ruleId,r.prepared_by AS preparedBy,r.prepared_at AS preparedAt,r.expires_at AS expiresAt,d.decision',pending:'d.target_id IS NULL'},
 passport:{table:'production_readiness_passports',decision:"LEFT JOIN production_readiness_decisions d ON d.kind='passport' AND d.target_id=r.id",summary:'r.id,r.officer_id AS officerId,r.sequence,r.prepared_by AS preparedBy,r.prepared_at AS preparedAt,r.expires_at AS expiresAt,d.decision',pending:'d.target_id IS NULL'},
 disposition:{table:'production_rereview_proposals',decision:'LEFT JOIN production_rereview_decisions d ON d.proposal_id=r.id',summary:'r.id,r.kind,r.hold_id AS holdId,r.applicant_id AS applicantId,r.applicant_version AS applicantVersion,r.prepared_by AS preparedBy,r.prepared_at AS preparedAt,r.expires_at AS expiresAt,d.decision',pending:'d.proposal_id IS NULL'},
 workforce:{table:'production_evidence_reviews',decision:'',summary:'r.id,r.kind,r.state,r.prepared_by AS preparedBy,r.prepared_at AS preparedAt,r.expires_at AS expiresAt',pending:"r.state='pending'"}
};
export async function readIdentityReviewQueue(db:D1Database,a:SigningActor,input:{recordType:unknown;state:unknown;offset:unknown}){
 ops(a);const kind=type(input.recordType),spec=definitions[kind],offset=page(input.offset),state=input.state??'pending';if(!['pending','all'].includes(String(state)))throw new SignupError('Choose pending or all reviews.');
 const rows=await db.prepare(`SELECT ${spec.summary} FROM ${spec.table} r ${spec.decision} WHERE ${kind==='workforce'?"r.kind='engagement'":"1=1"} ${state==='pending'?'AND '+spec.pending:''} ORDER BY r.rowid DESC LIMIT 51 OFFSET ?`).bind(offset).all();
 return {contract:identityWorkspaceContract,recordType:kind,records:rows.results.slice(0,50),nextOffset:rows.results.length>50?offset+50:null,workEligible:false};
}
async function officerHolds(db:D1Database,officerId:string|null,applicantId:string|null,offset=0){
 const rows=await db.prepare('SELECT * FROM production_rereview_targets WHERE officer_id=? OR applicant_id=? ORDER BY held_at DESC,hold_id DESC LIMIT 100 OFFSET ?').bind(officerId,applicantId,offset).all();
 const linked=await db.prepare("SELECT p.kind,p.hold_id,a.id AS auditEventId,a.actor_id AS actorId,a.detail,a.created_at AS recordedAt FROM production_hold_provenance p JOIN audit_events a ON a.id=p.audit_event_id JOIN json_each(?) selected ON json_extract(selected.value,'$.kind')=p.kind AND json_extract(selected.value,'$.hold_id')=p.hold_id ORDER BY a.rowid DESC").bind(JSON.stringify(rows.results.map(row=>({kind:row.kind,hold_id:row.hold_id})))).all();
 const results=rows.results.map(row=>{const human=linked.results.filter(h=>h.kind===row.kind&&h.hold_id===row.hold_id).map(({kind,hold_id,...h})=>{void kind;void hold_id;return {...h,detail:JSON.parse(String(h.detail))};});return {...row,humanAudit:human,attribution:row.held_by!=='system'?'direct_actor':human.length?'linked_human_action':'system_only'};});
 return results;
}
export async function readIdentityReviewDetail(db:D1Database,a:SigningActor,recordType:unknown,id:string){
 ops(a);const kind=type(recordType),spec=definitions[kind];
 const r=await db.prepare(`SELECT * FROM ${spec.table} WHERE id=? ${kind==='workforce'?"AND kind='engagement'":''}`).bind(text(id)).first<Record<string,unknown>>();if(!r)throw new SignupError('Review record not found.',404);
 let officerId=(r.officer_id??null) as string|null,applicantId=(r.applicant_id??null) as string|null;
 if(kind==='workforce')officerId=JSON.parse(String(r.payload_json)).officerId;
 if(officerId&&!applicantId){const l=await db.prepare("SELECT case_id FROM production_entity_links WHERE kind='officer' AND entity_id=?").bind(officerId).first<{case_id:string}>();applicantId=l?.case_id??null;}
 const related:Record<string,unknown>={};let decisions:unknown[]=[];
 if(kind==='identity'){
  const outcomes=await db.prepare('SELECT * FROM production_identity_outcomes WHERE case_id=? ORDER BY sequence DESC LIMIT 50').bind(id).all();related.outcomes=outcomes.results;
  decisions=(await db.prepare('SELECT d.* FROM production_identity_decisions d JOIN production_identity_outcomes o ON o.id=d.outcome_id WHERE o.case_id=? ORDER BY o.sequence DESC LIMIT 50').bind(id).all()).results;
 }else if(kind==='officer'){
  decisions=(await db.prepare('SELECT * FROM production_officer_decisions WHERE review_id=?').bind(id).all()).results;
  const source=JSON.parse(String(r.source_json));related.psiraEvent=await db.prepare('SELECT * FROM psira_verification_events WHERE id=?').bind(source.psira_event_id).first();
 }else if(['rule','review','passport'].includes(kind)){
  related.directHolds=(await db.prepare('SELECT id,kind,target_id,disposition,actor_id,reason,recorded_at FROM production_readiness_holds WHERE kind=? AND target_id=? ORDER BY rowid DESC LIMIT 100').bind(kind,id).all()).results;
  decisions=(await db.prepare('SELECT * FROM production_readiness_decisions WHERE kind=? AND target_id=?').bind(kind,id).all()).results;
  if(kind==='review')related.rule=await db.prepare('SELECT * FROM production_readiness_rules WHERE id=?').bind(r.rule_id).first();
  if(kind==='passport'){related.reviews=(await db.prepare('SELECT r.* FROM production_readiness_reviews r JOIN json_each(?) j ON j.value=r.id').bind(r.items_json).all()).results;related.delivery=await db.prepare('SELECT delivery_id AS deliveryId,bound_at AS boundAt FROM production_passport_delivery_bindings WHERE passport_id=?').bind(id).first();}
 }else if(kind==='disposition')decisions=(await db.prepare('SELECT * FROM production_rereview_decisions WHERE proposal_id=?').bind(id).all()).results;
 if(kind==='workforce')related.suspensionAudit=(await db.prepare("SELECT id,actor_id AS actorId,detail,created_at AS recordedAt FROM audit_events WHERE event_type='production_evidence_suspended' AND entity_type='evidence_review' AND entity_id=? ORDER BY rowid DESC LIMIT 50").bind(id).all()).results;
 const currentViews:Partial<Record<IdentityReviewType,string>>={identity:'current_production_identity_evidence',officer:'current_production_officer_approvals',rule:'current_production_readiness_rules',review:'current_production_readiness_reviews',passport:'usable_production_readiness_passports'};
 const view=currentViews[kind];const current=view?!!await db.prepare(`SELECT id FROM ${view} WHERE id=?`).bind(id).first():kind==='disposition'?!!await db.prepare("SELECT id FROM production_rereview_authorizations WHERE id=? AND julianday(expires_at)>julianday('now')").bind(id).first():!!await db.prepare("SELECT id FROM workforce_engagements WHERE id=? AND status='active' AND active_key=officer_id AND julianday(review_due_at)>julianday('now')").bind(JSON.parse(String(r.payload_json)).engagementId).first();
 // Private evidence access is accountable; audit metadata contains no source or token material.
 await db.prepare("INSERT INTO audit_events VALUES(?,'operations',?,'identity_review_data_access',?,?,?,?)").bind(crypto.randomUUID(),a.userId,kind,id,'Protected review data read',new Date().toISOString()).run();
 return {contract:identityWorkspaceContract,recordType:kind,record:unpack(r),decisions,related,holds:await officerHolds(db,officerId,applicantId),current,limits:{relatedHistory:50,holds:100},viewer:{userId:a.userId,owner:!!a.owner},workEligible:false};
}

export async function readIdentityHolds(db:D1Database,a:SigningActor,applicantId:string,offset:unknown){
 ops(a);const c=await db.prepare("SELECT source_id FROM signup_cases WHERE kind='officer' AND source_id=?").bind(text(applicantId)).first();if(!c)throw new SignupError('Applicant not found.',404);
 const start=page(offset),holds=await officerHolds(db,null,applicantId,start);
 return {contract:identityWorkspaceContract,applicantId,holds,nextOffset:holds.length===100?start+100:null,workEligible:false};
}
