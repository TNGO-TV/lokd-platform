import type {IdentityBinding} from './production-identity';
import {sameIdentityBinding,type VerifyNowReceiptStore} from './verifynow-production';

// Requires the unnumbered ID-PROVIDER-02 proposal; Central owns migration numbering.
export function verifyNowD1Receipts(db:D1Database):VerifyNowReceiptStore {
 async function claimFor(b:IdentityBinding){
  const row=await db.prepare('SELECT binding_json FROM verifynow_production_claims WHERE case_id=?').bind(b.caseId).first<{binding_json:string}>();
  if(!row||!sameIdentityBinding(b,JSON.parse(row.binding_json)))throw new Error('VerifyNow receipt binding mismatch.');
 }
 return {
  async claim(b,hash,policyReference,evidenceLifetimeMs){
   const result=await db.prepare('INSERT INTO verifynow_production_claims(case_id,binding_json,request_hash,claimed_at,policy_reference,evidence_lifetime_ms) SELECT ?,?,?,?,?,? FROM production_identity_cases WHERE id=? AND applicant_id=? AND applicant_version=? AND owner_user_id=? AND binding_hash=? AND capture_reference=? AND provider=? ON CONFLICT(case_id) DO NOTHING').bind(b.caseId,JSON.stringify(b),hash,new Date().toISOString(),policyReference,evidenceLifetimeMs,b.caseId,b.applicantId,b.applicantVersion,b.ownerUserId,b.bindingHash,b.captureReference,'verifynow-said-production-v1').run();
   return result.meta.changes===1;
  },
  async save(b,result){
   await claimFor(b);
   if(!sameIdentityBinding(b,result))throw new Error('VerifyNow receipt binding mismatch.');
   // Unique case_id prevents replacement of a known receipt/provider reference.
   await db.prepare('INSERT INTO verifynow_production_receipts(case_id,result_json,recorded_at) VALUES(?,?,?)').bind(b.caseId,JSON.stringify(result),new Date().toISOString()).run();
  },
  async read(b){await claimFor(b);const row=await db.prepare('SELECT result_json FROM verifynow_production_receipts WHERE case_id=?').bind(b.caseId).first<{result_json:string}>();return row?JSON.parse(row.result_json):null;},
 };
}
