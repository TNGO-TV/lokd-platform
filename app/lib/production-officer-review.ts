import {SignupError} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {reviewEvidence, verificationState, type PsiraEvent} from './psira-verification';
import type {SigningActor} from './production-signing';

type Source = {
 officer_id:string; applicant_id:string; applicant_version:number; owner_user_id:string;
 full_name:string; mobile:string; email:string; city:string; psira_number:string; psira_grade:string;
 identity_case_id:string; identity_outcome_id:string; identity_reviewer:string; entity_preparer:string;
 psira_case_id:string; psira_event_id:string; psira_reviewer:string; certificate_expiry:string; expires_at:string;
};
const field=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>1200)throw new SignupError('Provide the reference or review findings.');return v.trim();};
function operations(actor:SigningActor){if(!actor.operations)throw new SignupError('Operations access required.',403);}
async function source(db:D1Database,id:string){
 const s=await db.prepare('SELECT * FROM current_production_officer_sources WHERE officer_id=?').bind(id).first<Source>();
 if(!s)throw new SignupError('Current reviewed intake, exact identity and owner-bound PSiRA evidence are required.',409);
 const event=await db.prepare('SELECT * FROM psira_verification_events WHERE id=?').bind(s.psira_event_id).first<PsiraEvent>();
 if(!event||!verificationState(event).verified||await agreementHash(event.evidence_json)!==event.evidence_hash)throw new SignupError('PSiRA evidence is stale or invalid.',409);
 // Reuse the established source/date/registration/identity evidence validator.
 reviewEvidence({registrationStatus:event.registration_status,identityMatch:event.identity_match,evidence:JSON.parse(event.evidence_json),recheckAt:event.recheck_at},s.psira_number);
 return s;
}
export async function prepareOfficerReview(db:D1Database,actor:SigningActor,input:{officerId:string;applicantVersion:number;identityOutcomeId:string;psiraEventId:string;reason:string}){
 operations(actor);
 const s=await source(db,field(input.officerId));
 if(actor.userId===s.owner_user_id)throw new SignupError('Another operator must prepare your officer review.',403);
 if(input.applicantVersion!==s.applicant_version||input.identityOutcomeId!==s.identity_outcome_id||input.psiraEventId!==s.psira_event_id)throw new SignupError('Officer source evidence changed. Refresh.',409);
 const id=crypto.randomUUID(),json=JSON.stringify(s);
 await db.prepare('INSERT INTO production_officer_reviews VALUES(?,?,?,?,?,?,?)').bind(id,s.officer_id,json,await agreementHash(json),actor.userId,new Date().toISOString(),field(input.reason)).run();
 return {reviewId:id,officerId:s.officer_id,expiresAt:s.expires_at,pendingIndependentApproval:true,workEligible:false};
}
export async function decideOfficerReview(db:D1Database,actor:SigningActor,input:{reviewId:string;decision:'approve'|'reject';independentlyChecked:boolean;reason:string}){
 operations(actor);
 if(!actor.owner)throw new SignupError('The assigned Operations owner must decide officer approval.',403);
 if(!['approve','reject'].includes(input.decision)||!input.independentlyChecked)throw new SignupError('Independently inspect the exact identity and registration evidence before deciding.');
 const r=await db.prepare('SELECT * FROM production_officer_reviews WHERE id=?').bind(field(input.reviewId)).first<{id:string;officer_id:string;source_json:string;source_hash:string;prepared_by:string}>();
 if(!r)throw new SignupError('Officer review not found.',404);
 const s=JSON.parse(r.source_json) as Source;
 if([r.prepared_by,s.owner_user_id,s.identity_reviewer,s.entity_preparer].includes(actor.userId)||s.psira_reviewer.toLowerCase()===actor.email.toLowerCase())throw new SignupError('A separate owner must decide this officer review.',403);
 if(await agreementHash(r.source_json)!==r.source_hash)throw new SignupError('Officer review integrity check failed.',409);
 if(input.decision==='approve'&&JSON.stringify(await source(db,r.officer_id))!==r.source_json)throw new SignupError('Officer source evidence changed. Prepare a fresh review.',409);
 // DB trigger re-joins current source versions at this commit and atomically
 // projects officer approval plus two evidenced compliance rows. No ready flags.
 await db.prepare('INSERT INTO production_officer_decisions VALUES(?,?,?,?,?,?)').bind(r.id,input.decision,actor.userId,actor.email,field(input.reason),new Date().toISOString()).run();
 return {reviewId:r.id,decision:input.decision,workEligible:false};
}
export async function readOfficerReviews(db:D1Database,actor:SigningActor,officerId:string){
 const link=await db.prepare("SELECT owner_user_id FROM production_entity_links WHERE kind='officer' AND entity_id=?").bind(officerId).first<{owner_user_id:string}>();
 if(!link||(!actor.operations&&link.owner_user_id!==actor.userId))throw new SignupError('Officer record not found.',404);
 const rows=await db.prepare(`SELECT r.id,r.prepared_at AS preparedAt,d.decision,
 CASE WHEN a.id IS NOT NULL AND o.approval_status='approved' THEN 1 ELSE 0 END AS current,
 json_extract(r.source_json,'$.expires_at') AS expiresAt
 FROM production_officer_reviews r JOIN officers o ON o.id=r.officer_id LEFT JOIN production_officer_decisions d ON d.review_id=r.id
 LEFT JOIN current_production_officer_approvals a ON a.id=r.id WHERE r.officer_id=? ORDER BY r.rowid DESC`).bind(officerId).all();
 return {officerId,reviews:rows.results,workEligible:false};
}
export async function suspendOfficerApproval(db:D1Database,actor:SigningActor,officerId:string,reason:string){
 operations(actor);
 await readOfficerReviews(db,actor,officerId);
 await db.prepare('INSERT INTO production_officer_suspensions VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),officerId,actor.userId,field(reason),new Date().toISOString()).run();
 return {officerId,suspended:true,workEligible:false};
}
