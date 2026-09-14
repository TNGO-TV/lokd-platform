import {SignupError,writeSignup} from './signup-server';
import {agreementHash} from './agreement-acceptance';
import {manageProductionEvidence} from './production-evidence';
import type {SigningActor} from './production-signing';

export type RereviewKind='identity'|'officer'|'workforce'|'review'|'passport';
type Source={kind:RereviewKind;hold_id:string;subject_id:string;applicant_id:string;owner_user_id:string;officer_id:string|null;held_at:string;held_by:string;reason:string;applicant_version:number;applicant_status:string;latest_event_id:string;corrections_json:string};
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>1200)throw new SignupError('Provide a valid reference or investigation finding.');return v.trim();};
const date=(v:string)=>{const t=Date.parse(v);if(!Number.isFinite(t))throw new SignupError('Provide an exact investigation date.');return t;};
const ops=(a:SigningActor)=>{if(!a.operations)throw new SignupError('Operations access required.',403);};
const iso=(n:number)=>new Date(n).toISOString();
async function epoch(db:D1Database){return (await db.prepare('SELECT revision FROM activation_evidence_epoch WHERE singleton=1').first<{revision:number}>())!.revision;}
// Uses the established immutable intake events/version checks. This is a real
// request for information, not a dummy correction or a fabricated ready state.
export async function requestOfficerRereview(db:D1Database,a:SigningActor,input:{applicantId:string;expectedVersion:number;message:string}){
 ops(a);
 await writeSignup(db,a,{action:'review',kind:'officer',id:text(input.applicantId),expectedVersion:input.expectedVersion,status:'needs_information',note:text(input.message)});
 return {needsInformation:true,identityVerified:false,workEligible:false};
}
export async function prepareRereviewDisposition(db:D1Database,a:SigningActor,input:{kind:RereviewKind;holdId:string;applicantVersion:number;evidenceReference:string;evidenceHash:string;checkedAt:string;expiresAt:string;actuallyInvestigated:boolean}){
 ops(a);if(!input.actuallyInvestigated||!['identity','officer','workforce','review','passport'].includes(input.kind)||!(/^[a-f0-9]{64}$/.test(input.evidenceHash)))throw new SignupError('Investigate the actual hold and supply its protected evidence digest.');
 const revision=await epoch(db);
 const source=await db.prepare('SELECT * FROM production_rereview_sources WHERE kind=? AND hold_id=?').bind(input.kind,text(input.holdId)).first<Source>();
 if(!source)throw new SignupError('Hold not found.',404);
 if(source.owner_user_id===a.userId)throw new SignupError('Another operator must investigate your hold.',403);
 if(source.applicant_version!==input.applicantVersion||source.applicant_status!=='reviewed')throw new SignupError('Current independently reviewed intake required. Refresh after corrections.',409);
 const checked=date(input.checkedAt),expires=date(input.expiresAt);
 if(checked<date(source.held_at)||checked>Date.now()||expires<=Date.now()||expires<=checked)throw new SignupError('Investigation must follow the hold and remain current.');
 const json=JSON.stringify(source),id=crypto.randomUUID();
 await db.prepare('INSERT INTO production_rereview_proposals VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,input.kind,input.holdId,source.applicant_id,source.applicant_version,source.owner_user_id,revision,json,await agreementHash(json),text(input.evidenceReference),input.evidenceHash,iso(checked),iso(expires),a.userId,iso(Date.now())).run();
 return {id,pendingIndependentDisposition:true,restoresApproval:false,workEligible:false};
}
export async function decideRereviewDisposition(db:D1Database,a:SigningActor,input:{proposalId:string;decision:'allow_replacement'|'keep_held';independentlyInvestigated:boolean;reason:string}){
 ops(a);if(!a.owner)throw new SignupError('Assigned independent Operations owner required.',403);
 if(!input.independentlyInvestigated||!['allow_replacement','keep_held'].includes(input.decision))throw new SignupError('Independently inspect the investigation and choose a disposition.');
 const p=await db.prepare('SELECT source_json,source_hash FROM production_rereview_proposals WHERE id=?').bind(text(input.proposalId)).first<{source_json:string;source_hash:string}>();
 if(!p)throw new SignupError('Disposition proposal not found.',404);
 if(await agreementHash(p.source_json)!==p.source_hash)throw new SignupError('Investigation commitment changed.',409);
 await db.prepare('INSERT INTO production_rereview_decisions VALUES(?,?,?,?,?)').bind(input.proposalId,input.decision,a.userId,text(input.reason),iso(Date.now())).run();
 return {decision:input.decision,restoresApproval:false,workEligible:false};
}
export async function suspendOfficerWorkforce(db:D1Database,a:SigningActor,input:{reviewId:string;reason:string}){
 ops(a);
 const r=await db.prepare("SELECT payload_json FROM production_evidence_reviews WHERE id=? AND kind='engagement' AND state='approved'").bind(text(input.reviewId)).first<{payload_json:string}>();
 if(!r)throw new SignupError('Approved engagement evidence required.',404);
 const engagementId=JSON.parse(r.payload_json).engagementId as string;
 const held=await db.prepare("SELECT h.id FROM production_workforce_holds h JOIN workforce_engagements w ON w.id=h.engagement_id AND w.status='suspended' WHERE h.engagement_id=? LIMIT 1").bind(engagementId).first();
 if(held)return {suspended:true,alreadyRecorded:true,restoresApproval:false,workEligible:false};
 // Reuse existing evidence suspension. The additive trigger retains an immutable
 // workforce hold in the same transaction and invalidates any issued passport.
 await manageProductionEvidence(db,a,{action:'suspend_evidence',reviewId:input.reviewId,reason:text(input.reason)});
 return {suspended:true,restoresApproval:false,workEligible:false};
}
export async function readRereviewStatus(db:D1Database,a:SigningActor,applicantId:string){
 const c=await db.prepare("SELECT owner_user_id,version,status FROM signup_cases WHERE kind='officer' AND source_id=?").bind(text(applicantId)).first<{owner_user_id:string;version:number;status:string}>();
 if(!c||(!a.operations&&c.owner_user_id!==a.userId))throw new SignupError('Applicant not found.',404);
 const holds=await db.prepare(`SELECT t.kind,t.hold_id AS holdId,t.held_at AS heldAt,
 (SELECT max(a.expires_at) FROM production_rereview_authorizations a WHERE a.kind=t.kind AND a.hold_id=t.hold_id AND julianday(a.expires_at)>julianday('now')) AS replacementAuthorizedUntil
 FROM production_rereview_targets t WHERE t.applicant_id=? ORDER BY heldAt,holdId`).bind(applicantId).all();
 return {applicantId,applicantVersion:c.version,intakeStatus:c.status,holds:holds.results,restoresApproval:false,workEligible:false};
}
