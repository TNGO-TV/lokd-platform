import {SignupError,type SignupActor} from './signup-server';
import {applicationPsiraDeclaration} from './psira-pathway';
export async function prepareProductionEntity(db:D1Database,actor:SignupActor,input:Record<string,unknown>){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 if(input.kind!=='client'&&input.kind!=='officer'||typeof input.caseId!=='string')throw new SignupError('Choose a linked intake record.');
 const c=await db.prepare("SELECT * FROM signup_cases WHERE kind=? AND source_id=?").bind(input.kind,input.caseId).first<{owner_user_id:string;source_id:string;kind:string;version:number;status:string;corrections_json:string}>();
 if(!c?.owner_user_id||c.status!=='reviewed'||c.version!==input.caseVersion)throw new SignupError('Refresh the reviewed, linked intake record.',409);
 if(actor.userId===c.owner_user_id)throw new SignupError('Another Operations reviewer must prepare your record.',403);
 const existing=await db.prepare('SELECT * FROM production_entity_links WHERE kind=? AND case_id=?').bind(c.kind,c.source_id).first<{case_version:number;entity_id:string}>();
 if(existing?.case_version===c.version)return {entityId:existing.entity_id,grantsAccess:false,workEligible:false};
 const table=c.kind==='client'?'client_enquiries':'officer_applications';
 const source=await db.prepare(`SELECT * FROM ${table} WHERE id=? AND environment='prelaunch' AND integrity_state='user_submitted'`).bind(c.source_id).first<Record<string,string>>();if(!source)throw new SignupError('A genuine intake record is required.',409);
 const changes=JSON.parse(c.corrections_json) as Record<string,string>,id=existing?.entity_id??(c.kind==='client'?'CLIENT-':'OFFICER-')+crypto.randomUUID();
 if(existing){
  const entityTable=c.kind==='client'?'clients':'officers';
  const pending=await db.prepare(`SELECT id FROM ${entityTable} WHERE id=? AND approval_status IN ('pending','suspended')`).bind(id).first();
  if(!pending)throw new SignupError('This operational record has already been approved. Operations must suspend and review its eligibility before replacing reviewed details.',409);
  if(c.kind==='officer'&&applicationPsiraDeclaration(changes.pathway??source.pathway,changes.psiraStatus??source.psira_status)!=='registered')throw new SignupError('The corrected applicant is not registered. Keep operational eligibility suspended and continue the training intake.',409);
  const update=c.kind==='client'?db.prepare("UPDATE clients SET organisation_name=?,contact_name=? WHERE id=? AND approval_status IN ('pending','suspended') AND EXISTS(SELECT 1 FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version WHERE l.entity_id=clients.id AND l.case_version=? AND c.status='reviewed')").bind(changes.organisationName??source.organisation_name,changes.contactName??source.contact_name,id,c.version):db.prepare("UPDATE officers SET full_name=?,mobile=?,city=?,psira_number=?,psira_grade=?,psira_expiry='' WHERE id=? AND approval_status IN ('pending','suspended') AND EXISTS(SELECT 1 FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version WHERE l.entity_id=officers.id AND l.case_version=? AND c.status='reviewed')").bind(changes.fullName??source.full_name,changes.mobile??source.mobile_normalized,changes.city??source.city,changes.psiraNumber??source.psira_number,changes.psiraGrade??source.psira_grade??'',id,c.version);
  const reconciled=await db.batch([db.prepare("UPDATE production_entity_links SET case_version=?,prepared_by=?,prepared_at=? WHERE kind=? AND case_id=? AND case_version=?").bind(c.version,actor.userId,new Date().toISOString(),c.kind,c.source_id,existing.case_version),update]);
  if(!reconciled[1].meta.changes)throw new SignupError('The intake changed during reconciliation. Refresh before retrying.',409);
  return {entityId:id,reconciled:true,grantsAccess:false,workEligible:false};
 }
 const claim=db.prepare("INSERT INTO production_entity_links(kind,case_id,case_version,owner_user_id,entity_id,prepared_by,prepared_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM signup_cases WHERE kind=? AND source_id=? AND version=? AND status='reviewed')").bind(c.kind,c.source_id,c.version,c.owner_user_id,id,actor.userId,new Date().toISOString(),c.kind,c.source_id,c.version);
 let entity:D1PreparedStatement;
 if(c.kind==='client')entity=db.prepare("INSERT INTO clients(id,organisation_name,contact_name,contact_email,approval_status,environment,integrity_state) SELECT ?,?,?,?,'pending','production','production_candidate' WHERE EXISTS(SELECT 1 FROM production_entity_links WHERE entity_id=?)").bind(id,changes.organisationName??source.organisation_name,changes.contactName??source.contact_name,source.email_normalized,id);
 else{
  if(applicationPsiraDeclaration(changes.pathway??source.pathway,changes.psiraStatus??source.psira_status)!=='registered')throw new SignupError('Training applicants remain in training intake; they are not operational officers.',409);
  entity=db.prepare("INSERT INTO officers(id,full_name,mobile,email,city,psira_number,psira_grade,psira_expiry,approval_status,banking_status) SELECT ?,?,?,?,?,?,?,'','pending','unverified' WHERE EXISTS(SELECT 1 FROM production_entity_links WHERE entity_id=?)").bind(id,changes.fullName??source.full_name,changes.mobile??source.mobile_normalized,source.email_normalized,changes.city??source.city,changes.psiraNumber??source.psira_number,changes.psiraGrade??source.psira_grade??'',id);
 }
 const result=await db.batch([claim,entity]);if(!result[0].meta.changes||!result[1].meta.changes)throw new SignupError('Intake changed during preparation. Refresh.',409);
 return {entityId:id,grantsAccess:false,workEligible:false};
}
