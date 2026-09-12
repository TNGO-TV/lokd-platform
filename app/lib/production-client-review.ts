import { SignupError } from './signup-server';
import { agreementHash } from './agreement-acceptance';
import type { SigningActor } from './production-signing';
const field=(value:unknown,label:string,max=1200)=>{if(typeof value!=='string'||value.trim().length<3||value.length>max)throw new SignupError(`Provide ${label}.`);return value.trim();};
type Subject={id:string;organisation_name:string;contact_name:string;contact_email:string;approval_status:string;integrity_state:string;case_id:string;case_version:number;owner_user_id:string;prepared_by:string};
async function subject(db:D1Database,id:string){
 const row=await db.prepare(`SELECT x.*,l.case_id,l.case_version,l.owner_user_id,l.prepared_by FROM clients x JOIN production_entity_links l ON l.kind='client' AND l.entity_id=x.id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id WHERE x.id=? AND x.environment='production' AND c.status='reviewed'`).bind(id).first<Subject>();
 if(!row)throw new SignupError('Prepare the current independently reviewed client intake first.',409);return row;
}
const snapshot=(s:Subject)=>JSON.stringify({clientId:s.id,organisationName:s.organisation_name,contactName:s.contact_name,email:s.contact_email,caseId:s.case_id,caseVersion:s.case_version,ownerUserId:s.owner_user_id});
export async function currentClientReview(db:D1Database,clientId:string,at=new Date().toISOString()){
 const linked=await db.prepare("SELECT entity_id FROM production_entity_links WHERE kind='client' AND entity_id=?").bind(clientId).first();
 if(!linked)return true; // Existing independently verified records retain their established evidence path.
 return Boolean(await db.prepare(`SELECT r.id FROM production_client_reviews r JOIN production_client_decisions d ON d.review_id=r.id AND d.decision='approve' JOIN production_entity_links l ON l.kind='client' AND l.entity_id=r.client_id AND l.case_version=r.case_version JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=r.case_version AND c.owner_user_id=r.owner_user_id AND c.status='reviewed' WHERE r.client_id=? AND r.expires_at>? AND NOT EXISTS(SELECT 1 FROM production_client_suspensions s WHERE s.client_id=r.client_id AND s.created_at>=r.prepared_at) LIMIT 1`).bind(clientId,at).first());
}
export async function readClientReviews(db:D1Database,actor:SigningActor){
 if(!actor.operations)return {clientReviews:[],reviewClients:[]};
 const reviews=await db.prepare(`SELECT r.*,d.decision,d.reason,d.actor_id AS decided_by FROM production_client_reviews r LEFT JOIN production_client_decisions d ON d.review_id=r.id ORDER BY r.prepared_at DESC LIMIT 100`).all();
 const clients=await db.prepare("SELECT c.id,c.organisation_name,CASE WHEN c.approval_status='approved' AND NOT EXISTS(SELECT 1 FROM current_production_client_approvals a WHERE a.client_id=c.id) THEN 'review_due' ELSE c.approval_status END AS approval_status,l.case_version FROM clients c JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id WHERE c.environment='production' ORDER BY c.organisation_name LIMIT 100").all();
 return {clientReviews:reviews.results,reviewClients:clients.results};
}
export async function reviewProductionClient(db:D1Database,actor:SigningActor,input:Record<string,unknown>){
 if(!actor.operations)throw new SignupError('Operations access required.',403);
 const now=new Date().toISOString();
 if(input.action==='suspend_client'){
  const id=field(input.clientId,'client reference');if(!await db.prepare("SELECT c.id FROM clients c JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id WHERE c.id=? AND c.environment='production'").bind(id).first())throw new SignupError('Production client not found.',404);
  await db.prepare('INSERT INTO production_client_suspensions VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),id,actor.userId,field(input.reason,'suspension reason'),now).run();return {suspended:true,workEligible:false};
 }
 if(input.action==='prepare_client_review'){
  const s=await subject(db,field(input.clientId,'client reference'));if(s.owner_user_id===actor.userId)throw new SignupError('You cannot review your own client account.',403);
  if(input.caseVersion!==s.case_version)throw new SignupError('The client intake version changed. Refresh.',409);
  if(input.documentsActuallyReviewed!==true)throw new SignupError('Confirm that the source identity, company and signing-authority documents were actually reviewed.');
  const checkedAt=field(input.checkedAt,'source check time'),expiresAt=field(input.expiresAt,'review expiry');
  if(!Number.isFinite(Date.parse(checkedAt))||Date.parse(checkedAt)>Date.now()||Date.parse(checkedAt)<Date.now()-30*86400000||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now()||Date.parse(expiresAt)>Date.now()+180*86400000)throw new SignupError('Use a check within the last 30 days and a future expiry within 180 days.');
  const evidence={method:'manual_document_review',identity:field(input.identityReference,'identity evidence reference'),company:field(input.companyReference,'company evidence reference'),authority:field(input.authorityReference,'representative authority reference'),checkedAt:new Date(checkedAt).toISOString(),note:field(input.note,'review findings')};
  const json=snapshot(s),id='CR-'+crypto.randomUUID();
  await db.prepare('INSERT INTO production_client_reviews VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,s.id,s.case_id,s.case_version,s.owner_user_id,json,await agreementHash(json),JSON.stringify(evidence),actor.userId,now,new Date(expiresAt).toISOString()).run();
  return {reviewId:id,pendingIndependentApproval:true,workEligible:false};
 }
 if(input.action!=='decide_client_review'||!actor.owner)throw new SignupError('The assigned Operations owner must make the independent review decision.',403);
 const id=field(input.reviewId,'review reference'),r=await db.prepare('SELECT * FROM production_client_reviews WHERE id=?').bind(id).first<{client_id:string;snapshot_json:string;snapshot_hash:string;prepared_by:string;owner_user_id:string;expires_at:string}>();
 if(!r)throw new SignupError('Review not found.',404);
 if(r.prepared_by===actor.userId||r.owner_user_id===actor.userId)throw new SignupError('A separate owner must decide this review. Self-approval is forbidden.',403);
 if(!['approve','reject'].includes(String(input.decision)))throw new SignupError('Choose approve or reject.');
 const prior=await db.prepare('SELECT decision FROM production_client_decisions WHERE review_id=?').bind(id).first<{decision:string}>();if(prior){if(prior.decision!==input.decision)throw new SignupError('This review already has an immutable decision.',409);return {alreadyRecorded:true,decision:prior.decision,workEligible:false};}
 if(input.decision==='approve'){
  if(input.evidenceIndependentlyChecked!==true)throw new SignupError('Independently check the referenced documents before approving.');
  const s=await subject(db,r.client_id);if(snapshot(s)!==r.snapshot_json||await agreementHash(r.snapshot_json)!==r.snapshot_hash||Date.parse(r.expires_at)<=Date.now())throw new SignupError('The reviewed client details changed or the evidence expired. Prepare a fresh review.',409);
 }
 await db.prepare('INSERT INTO production_client_decisions VALUES(?,?,?,?,?)').bind(id,input.decision,actor.userId,field(input.reason,'independent decision findings'),now).run();
 return {decision:input.decision,workEligible:false};
}
