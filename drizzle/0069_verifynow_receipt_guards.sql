CREATE TABLE `verifynow_production_claims` (
	`case_id` text PRIMARY KEY NOT NULL,
	`binding_json` text NOT NULL,
	`request_hash` text NOT NULL,
	`claimed_at` text NOT NULL,
	`policy_reference` text NOT NULL,
	`evidence_lifetime_ms` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `production_identity_cases`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "verifynow_claim_binding_json" CHECK(json_valid("verifynow_production_claims"."binding_json")),
	CONSTRAINT "verifynow_claim_request_hash" CHECK(length("verifynow_production_claims"."request_hash")=64),
	CONSTRAINT "verifynow_claim_policy" CHECK(length("verifynow_production_claims"."policy_reference")>0),
	CONSTRAINT "verifynow_claim_lifetime" CHECK("verifynow_production_claims"."evidence_lifetime_ms">0),
	CONSTRAINT "verifynow_claim_case" CHECK(json_extract("verifynow_production_claims"."binding_json",'$.caseId')="verifynow_production_claims"."case_id")
);
--> statement-breakpoint
CREATE TABLE `verifynow_production_receipts` (
	`case_id` text PRIMARY KEY NOT NULL,
	`result_json` text NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `verifynow_production_claims`(`case_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "verifynow_receipt_json" CHECK(json_valid("verifynow_production_receipts"."result_json")),
	CONSTRAINT "verifynow_receipt_case" CHECK(json_extract("verifynow_production_receipts"."result_json",'$.caseId')="verifynow_production_receipts"."case_id"),
	CONSTRAINT "verifynow_receipt_environment" CHECK(json_extract("verifynow_production_receipts"."result_json",'$.environment')='production'),
	CONSTRAINT "verifynow_receipt_provider" CHECK(json_extract("verifynow_production_receipts"."result_json",'$.provider')='verifynow-said-production-v1'),
	CONSTRAINT "verifynow_receipt_outcome" CHECK(json_extract("verifynow_production_receipts"."result_json",'$.outcome')='manual_review')
);
--> statement-breakpoint
CREATE UNIQUE INDEX verifynow_receipt_provider_reference ON verifynow_production_receipts(json_extract(result_json,'$.providerReference'));

--> statement-breakpoint
CREATE TRIGGER verifynow_claim_no_update BEFORE UPDATE ON verifynow_production_claims BEGIN SELECT RAISE(ABORT,'immutable VerifyNow claim'); END;
--> statement-breakpoint
CREATE TRIGGER verifynow_claim_no_delete BEFORE DELETE ON verifynow_production_claims BEGIN SELECT RAISE(ABORT,'immutable VerifyNow claim'); END;
--> statement-breakpoint
CREATE TRIGGER verifynow_receipt_no_update BEFORE UPDATE ON verifynow_production_receipts BEGIN SELECT RAISE(ABORT,'immutable VerifyNow receipt'); END;
--> statement-breakpoint
CREATE TRIGGER verifynow_receipt_no_delete BEFORE DELETE ON verifynow_production_receipts BEGIN SELECT RAISE(ABORT,'immutable VerifyNow receipt'); END;
--> statement-breakpoint
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
--> statement-breakpoint
-- Central independent QA: REPLACE must not bypass immutable-history triggers
-- when recursive_triggers is disabled (SQLite/D1 default).
CREATE TRIGGER verifynow_claim_insert_binding BEFORE INSERT ON verifynow_production_claims BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM verifynow_production_claims WHERE case_id=NEW.case_id) THEN RAISE(ABORT,'immutable VerifyNow claim') END);
 SELECT (CASE WHEN NOT EXISTS(
  SELECT 1 FROM production_identity_cases c WHERE c.id=NEW.case_id AND c.provider='verifynow-said-production-v1'
  AND json_type(NEW.binding_json,'$.caseId')='text' AND json_extract(NEW.binding_json,'$.caseId')=c.id
  AND json_type(NEW.binding_json,'$.applicantId')='text' AND json_extract(NEW.binding_json,'$.applicantId')=c.applicant_id
  AND json_type(NEW.binding_json,'$.applicantVersion')='integer' AND json_extract(NEW.binding_json,'$.applicantVersion')=c.applicant_version
  AND json_type(NEW.binding_json,'$.ownerUserId')='text' AND json_extract(NEW.binding_json,'$.ownerUserId')=c.owner_user_id
  AND json_type(NEW.binding_json,'$.bindingHash')='text' AND json_extract(NEW.binding_json,'$.bindingHash')=c.binding_hash
  AND json_type(NEW.binding_json,'$.captureReference')='text' AND json_extract(NEW.binding_json,'$.captureReference')=c.capture_reference
 ) OR (SELECT count(*) FROM json_each(NEW.binding_json))<>6 OR (SELECT count(DISTINCT key) FROM json_each(NEW.binding_json))<>6 OR EXISTS(SELECT 1 FROM json_each(NEW.binding_json) WHERE key NOT IN ('caseId','applicantId','applicantVersion','ownerUserId','bindingHash','captureReference'))
 THEN RAISE(ABORT,'VerifyNow claim binding mismatch') END);
 SELECT (CASE WHEN NEW.case_id IS NULL OR typeof(NEW.request_hash)<>'text' OR length(NEW.request_hash)<>64 OR NEW.request_hash GLOB '*[^a-f0-9]*'
  OR julianday(NEW.claimed_at) IS NULL OR NEW.claimed_at IS NOT strftime('%Y-%m-%dT%H:%M:%fZ',NEW.claimed_at) OR typeof(NEW.evidence_lifetime_ms)<>'integer' OR NEW.evidence_lifetime_ms<=0 OR length(trim(NEW.policy_reference))=0
 THEN RAISE(ABORT,'Invalid VerifyNow claim evidence') END);
END;
--> statement-breakpoint
CREATE TRIGGER verifynow_receipt_insert_shape BEFORE INSERT ON verifynow_production_receipts BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM verifynow_production_receipts WHERE case_id=NEW.case_id)
  OR EXISTS(SELECT 1 FROM verifynow_production_receipts WHERE json_extract(result_json,'$.providerReference')=json_extract(NEW.result_json,'$.providerReference'))
 THEN RAISE(ABORT,'immutable VerifyNow receipt UNIQUE provider reference') END);
 SELECT (CASE WHEN (
  json_type(NEW.result_json,'$.caseId')='text' AND json_extract(NEW.result_json,'$.caseId')=NEW.case_id
  AND json_type(NEW.result_json,'$.providerReference')='text' AND length(json_extract(NEW.result_json,'$.providerReference')) BETWEEN 1 AND 300
  AND substr(json_extract(NEW.result_json,'$.providerReference'),1,1) GLOB '[A-Za-z0-9]'
  AND json_extract(NEW.result_json,'$.providerReference') NOT GLOB '*[^A-Za-z0-9:_-]*'
  AND json_type(NEW.result_json,'$.evidenceReference')='text' AND length(json_extract(NEW.result_json,'$.evidenceReference')) BETWEEN 1 AND 300
  AND substr(json_extract(NEW.result_json,'$.evidenceReference'),1,1) GLOB '[A-Za-z0-9]'
  AND json_extract(NEW.result_json,'$.evidenceReference') NOT GLOB '*[^A-Za-z0-9:_-]*'
  AND json_type(NEW.result_json,'$.evidenceHash')='text' AND length(json_extract(NEW.result_json,'$.evidenceHash'))=64
  AND json_extract(NEW.result_json,'$.evidenceHash') NOT GLOB '*[^a-f0-9]*'
  AND json_type(NEW.result_json,'$.checkedAt')='text' AND julianday(json_extract(NEW.result_json,'$.checkedAt')) IS NOT NULL
  AND json_extract(NEW.result_json,'$.checkedAt')=strftime('%Y-%m-%dT%H:%M:%fZ',json_extract(NEW.result_json,'$.checkedAt'))
  AND json_extract(NEW.result_json,'$.expiresAt')=strftime('%Y-%m-%dT%H:%M:%fZ',json_extract(NEW.result_json,'$.expiresAt'))
  AND json_type(NEW.result_json,'$.expiresAt')='text' AND julianday(json_extract(NEW.result_json,'$.expiresAt'))>julianday(json_extract(NEW.result_json,'$.checkedAt'))
  AND julianday(json_extract(NEW.result_json,'$.expiresAt'))<=julianday(json_extract(NEW.result_json,'$.checkedAt'),printf('+%.3f seconds',(SELECT evidence_lifetime_ms FROM verifynow_production_claims WHERE case_id=NEW.case_id)/1000.0))
 ) IS NOT TRUE OR julianday(NEW.recorded_at) IS NULL OR NEW.recorded_at IS NOT strftime('%Y-%m-%dT%H:%M:%fZ',NEW.recorded_at)
 OR (SELECT count(*) FROM json_each(NEW.result_json))<>14 OR (SELECT count(DISTINCT key) FROM json_each(NEW.result_json))<>14
 OR EXISTS(SELECT 1 FROM json_each(NEW.result_json) WHERE key NOT IN ('caseId','applicantId','applicantVersion','ownerUserId','bindingHash','captureReference','environment','provider','outcome','providerReference','evidenceReference','evidenceHash','checkedAt','expiresAt'))
 THEN RAISE(ABORT,'Invalid VerifyNow receipt evidence') END);
END;
