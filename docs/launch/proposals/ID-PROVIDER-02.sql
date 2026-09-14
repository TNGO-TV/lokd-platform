-- ADDITIVE PROPOSAL ONLY. Central assigns migration number and canonical schema.
-- Apply after production_identity_cases (present in c358358). Never backfill
-- captures, claims or receipts from sandbox. No credential or enablement changes.
CREATE TABLE verifynow_production_claims (
 case_id TEXT PRIMARY KEY REFERENCES production_identity_cases(id),
 binding_json TEXT NOT NULL CHECK(json_valid(binding_json)),
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 claimed_at TEXT NOT NULL,
 policy_reference TEXT NOT NULL CHECK(length(policy_reference)>0),
 evidence_lifetime_ms INTEGER NOT NULL CHECK(evidence_lifetime_ms>0),
 CHECK(json_extract(binding_json,'$.caseId')=case_id)
);
CREATE TABLE verifynow_production_receipts (
 case_id TEXT PRIMARY KEY REFERENCES verifynow_production_claims(case_id),
 result_json TEXT NOT NULL CHECK(json_valid(result_json)),
 recorded_at TEXT NOT NULL,
 CHECK(json_extract(result_json,'$.caseId')=case_id),
 CHECK(json_extract(result_json,'$.environment')='production'),
 CHECK(json_extract(result_json,'$.provider')='verifynow-said-production-v1'),
 CHECK(json_extract(result_json,'$.outcome')='manual_review')
);
CREATE TRIGGER verifynow_claim_no_update BEFORE UPDATE ON verifynow_production_claims BEGIN SELECT RAISE(ABORT,'immutable VerifyNow claim'); END;
CREATE TRIGGER verifynow_claim_no_delete BEFORE DELETE ON verifynow_production_claims BEGIN SELECT RAISE(ABORT,'immutable VerifyNow claim'); END;
CREATE TRIGGER verifynow_receipt_no_update BEFORE UPDATE ON verifynow_production_receipts BEGIN SELECT RAISE(ABORT,'immutable VerifyNow receipt'); END;
CREATE TRIGGER verifynow_receipt_no_delete BEFORE DELETE ON verifynow_production_receipts BEGIN SELECT RAISE(ABORT,'immutable VerifyNow receipt'); END;
-- A provider request identifier cannot be reattached to another local case.
CREATE UNIQUE INDEX verifynow_receipt_provider_reference ON verifynow_production_receipts(json_extract(result_json,'$.providerReference'));
CREATE TRIGGER verifynow_receipt_binding BEFORE INSERT ON verifynow_production_receipts
WHEN NOT EXISTS (
 SELECT 1 FROM verifynow_production_claims c WHERE c.case_id=NEW.case_id
 AND json_extract(NEW.result_json,'$.applicantId')=json_extract(c.binding_json,'$.applicantId')
 AND json_extract(NEW.result_json,'$.applicantVersion')=json_extract(c.binding_json,'$.applicantVersion')
 AND json_extract(NEW.result_json,'$.ownerUserId')=json_extract(c.binding_json,'$.ownerUserId')
 AND json_extract(NEW.result_json,'$.bindingHash')=json_extract(c.binding_json,'$.bindingHash')
 AND json_extract(NEW.result_json,'$.captureReference')=json_extract(c.binding_json,'$.captureReference')
 AND json_type(NEW.result_json,'$.providerReference')='text'
 AND length(json_extract(NEW.result_json,'$.providerReference'))>0
 AND json_extract(NEW.result_json,'$.environment')='production'
 AND json_extract(NEW.result_json,'$.provider')='verifynow-said-production-v1'
 AND json_extract(NEW.result_json,'$.outcome')='manual_review'
)
BEGIN SELECT RAISE(ABORT,'VerifyNow receipt binding mismatch'); END;
