import {agreementHash} from './agreement-acceptance';
import {SignupError} from './signup-server';

// Replay-safe projection of an actual bound signature, never an Operations
// assertion that an officer accepted terms. The insertion guard rechecks the
// current envelope, document, account and engagement inside the transaction.
export async function projectSignedWorkforceTerms(db:D1Database,envelopeId:string,userId:string){
 const e=await db.prepare("SELECT e.*,r.receipt_json,r.receipt_hash,d.effective_to FROM production_signing_envelopes e JOIN agreement_acceptance_receipts r ON r.id='LIVE-SIGN-'||e.id JOIN agreement_document_versions d ON d.id=e.document_id WHERE e.id=? AND e.owner_user_id=? AND e.role='OFFICER_EMPLOYMENT'").bind(envelopeId,userId).first<Record<string,string|null>>();
 if(!e)return;
 if(await agreementHash(e.receipt_json!)!==e.receipt_hash)throw new SignupError('Signed employment receipt integrity check failed.',409);
 const receipt=JSON.parse(e.receipt_json!),scope=receipt.context?.scope;
 if(!scope?.engagementId||receipt.actorUserId!==userId||receipt.action!=='agree'||scope.officerId!==e.officer_id)throw new SignupError('Employment signature does not match this officer and engagement.',409);
 const engagement=await db.prepare("SELECT id,terms_version,review_due_at FROM workforce_engagements WHERE id=? AND officer_id=? AND employer_id=? AND terms_version=? AND active_key=officer_id AND status='active' AND environment='production'").bind(scope.engagementId,e.officer_id,scope.employerId,scope.termsVersion).first<{id:string;terms_version:string;review_due_at:string|null}>();
 if(!engagement?.review_due_at)throw new SignupError('The signed employment scope has changed. Operations must issue current terms.',409);
 const expiry=Math.min(Date.parse(engagement.review_due_at),e.effective_to?Date.parse(e.effective_to):Infinity);
 if(!Number.isFinite(expiry)||expiry<=Date.now())throw new SignupError('The signed employment evidence has expired.',409);
 const id='WTA-LIVE-'+envelopeId,existing=await db.prepare('SELECT id,active_key FROM workforce_terms_acceptances WHERE id=?').bind(id).first<{id:string;active_key:string|null}>();
 if(existing){if(existing.active_key!==engagement.id)throw new SignupError('This workforce acceptance was superseded or withdrawn. Use the current agreement.',409);return;}
 await db.batch([
  db.prepare('UPDATE workforce_terms_acceptances SET active_key=NULL WHERE active_key=?').bind(engagement.id),
  db.prepare("INSERT INTO workforce_terms_acceptances(id,workforce_engagement_id,officer_id,terms_version,acceptance_mode,environment,integrity_state,evidence_reference,accepted_at,expires_at,active_key,created_at) VALUES(?,?,?,?,'electronic_signature','production','verified',?,?,?,?,?)").bind(id,engagement.id,e.officer_id,engagement.terms_version,'agreement:LIVE-SIGN-'+envelopeId,receipt.acceptedAt,new Date(expiry).toISOString(),engagement.id,new Date().toISOString()),
 ]);
}
