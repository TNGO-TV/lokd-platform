-- Rebuild the public intake tables so their stored definitions default to production. Data, indexes, triggers and views are preserved.
PRAGMA defer_foreign_keys = on;
--> statement-breakpoint
CREATE TABLE `_identity_application_links` (`id` text PRIMARY KEY NOT NULL, `application_id` text NOT NULL);
--> statement-breakpoint
INSERT INTO `_identity_application_links` SELECT `id`,`application_id` FROM `identity_verification_cases` WHERE `application_id` IS NOT NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_enquiry_retention_children`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_delivery_history`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_enquiry_delete_guard_v30`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_enquiry_schedule_immutable`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_enquiry_insert_guard_v30`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_delivery_original_claim`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_delivery_binding`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_enquiry_delivery`;
--> statement-breakpoint
DROP VIEW IF EXISTS `production_rereview_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_officer_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_identity_evidence`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `production_identity_case_guard`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `signup_source_guard`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_enquiry_update_guard_v30`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `outbox_parent_provenance_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `identity_case_parent_provenance_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_application_officer_binding_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_application_provenance_insert_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_application_provenance_immutable_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_application_receipts_immutable_delete`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_enquiry_receipts_immutable_delete`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operations_psira_email`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operations_identity_suspension_email`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operations_identity_decision_email`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operations_intake_email`;
--> statement-breakpoint
DROP VIEW IF EXISTS `finance_document_financial_snapshots`;
--> statement-breakpoint
DROP VIEW IF EXISTS `finance_document_payment_rows`;
--> statement-breakpoint
DROP VIEW IF EXISTS `finance_document_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `specialist_booking_control_validation_v33`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_quote_offer_issue`;
--> statement-breakpoint
DROP VIEW IF EXISTS `client_quote_offer_issues`;
--> statement-breakpoint
DROP VIEW IF EXISTS `specialist_pricing_validation_v33`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_terms_cancel_delivery`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_quote_cancel_delivery`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `client_quote_queue`;
--> statement-breakpoint
DROP VIEW IF EXISTS `client_quote_sources`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_signup_withdraw`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_document_withdraw`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_contract_cancel`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_contract_delivery`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_booking_delivery`;
--> statement-breakpoint
DROP VIEW IF EXISTS `finance_balances`;
--> statement-breakpoint
DROP VIEW IF EXISTS `finance_current_records`;
--> statement-breakpoint
DROP VIEW IF EXISTS `finance_current_members`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payroll_correction_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `booking_refund_matching_events`;
--> statement-breakpoint
DROP VIEW IF EXISTS `document_invoice_payment_states`;
--> statement-breakpoint
DROP VIEW IF EXISTS `booking_refund_state`;
--> statement-breakpoint
DROP VIEW IF EXISTS `booking_refund_accounting`;
--> statement-breakpoint
DROP VIEW IF EXISTS `booking_refund_final_evidence`;
--> statement-breakpoint
DROP VIEW IF EXISTS `booking_refund_authorized`;
--> statement-breakpoint
DROP VIEW IF EXISTS `booking_refund_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `credit_note_balances`;
--> statement-breakpoint
DROP VIEW IF EXISTS `credit_note_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_passport_deliveries`;
--> statement-breakpoint
DROP VIEW IF EXISTS `document_partner_payment_states`;
--> statement-breakpoint
DROP VIEW IF EXISTS `document_employee_payment_states`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_payment_financial_state`;
--> statement-breakpoint
DROP VIEW IF EXISTS `employee_payment_financial_state`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_live_reconciliation_reviewable`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_recovery_chain_holds`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_final_evidence`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_recovery_chain_holds`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_recovery_terminal`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_payment_final_evidence`;
--> statement-breakpoint
DROP VIEW IF EXISTS `employee_recovery_chain_holds`;
--> statement-breakpoint
DROP VIEW IF EXISTS `employee_recovery_terminal`;
--> statement-breakpoint
DROP VIEW IF EXISTS `employee_payment_final_evidence`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_live_release_available`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_live_release_reviewable`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_live_reserve_current`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_instruction_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_destination_evidence`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_instruction_records`;
--> statement-breakpoint
DROP VIEW IF EXISTS `valid_production_readiness_passports`;
--> statement-breakpoint
DROP VIEW IF EXISTS `production_rereview_authorizations`;
--> statement-breakpoint
DROP VIEW IF EXISTS `production_rereview_targets`;
--> statement-breakpoint
DROP VIEW IF EXISTS `usable_production_readiness_passports`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_readiness_passports`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_readiness_optins`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_readiness_reviews`;
--> statement-breakpoint
DROP VIEW IF EXISTS `valid_production_readiness_reviews`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_readiness_rules`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_officer_approvals`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_officer_reviews`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_recovery_available`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_recovery_reviewable`;
--> statement-breakpoint
DROP VIEW IF EXISTS `employee_recovery_available`;
--> statement-breakpoint
DROP VIEW IF EXISTS `employee_recovery_reviewable`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_payment_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_destination_current`;
--> statement-breakpoint
DROP VIEW IF EXISTS `partner_destination_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `production_partner_payable_current`;
--> statement-breakpoint
DROP VIEW IF EXISTS `production_partner_payable_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `employee_payment_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_destination_current`;
--> statement-breakpoint
DROP VIEW IF EXISTS `payment_destination_sources`;
--> statement-breakpoint
DROP VIEW IF EXISTS `current_production_client_approvals`;
--> statement-breakpoint
DROP VIEW IF EXISTS `specialist_pack_validation_v34`;
--> statement-breakpoint
DROP VIEW IF EXISTS `specialist_required_checks_v34`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_operation_parent_provenance_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `identity_case_no_delete_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `identity_case_terminal_guard_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `identity_case_transition_guard_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `identity_case_identity_immutable_v21`;
--> statement-breakpoint
CREATE TABLE `officer_applications__hold` AS SELECT * FROM `officer_applications`;
--> statement-breakpoint
DROP TABLE `officer_applications`;
--> statement-breakpoint
CREATE TABLE `officer_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`pathway` text NOT NULL,
	`full_name` text NOT NULL,
	`mobile_normalized` text NOT NULL,
	`email_normalized` text NOT NULL,
	`city` text NOT NULL,
	`province` text NOT NULL,
	`psira_status` text NOT NULL,
	`psira_number` text,
	`psira_grade` text,
	`service_interests` text NOT NULL,
	`training_interests` text NOT NULL,
	`over_18_confirmed` integer NOT NULL,
	`eligibility_acknowledged` integer NOT NULL,
	`privacy_notice_version` text NOT NULL,
	`privacy_acknowledged_at` text NOT NULL,
	`identity_verification_status` text DEFAULT 'not_started' NOT NULL,
	`identity_provider` text,
	`identity_provider_reference` text,
	`identity_verified_at` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`source` text DEFAULT 'homepage' NOT NULL,
	`retention_review_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
, `purpose_interests` text DEFAULT '[]' NOT NULL, `identity_consent_version` text, `identity_consented_at` text, `officer_id` text REFERENCES `officers`(`id`) ON DELETE set null, `environment` text DEFAULT 'production' NOT NULL, `integrity_state` text DEFAULT 'user_submitted' NOT NULL);
--> statement-breakpoint
INSERT INTO `officer_applications` SELECT * FROM `officer_applications__hold`;
--> statement-breakpoint
DROP TABLE `officer_applications__hold`;
--> statement-breakpoint
CREATE INDEX `officer_applications_status_idx` ON `officer_applications` (`status`);
--> statement-breakpoint
CREATE INDEX `officer_applications_pathway_idx` ON `officer_applications` (`pathway`);
--> statement-breakpoint
CREATE INDEX `officer_applications_created_idx` ON `officer_applications` (`created_at`);
--> statement-breakpoint
CREATE INDEX officer_applications_mobile_idx ON officer_applications(mobile_normalized);
--> statement-breakpoint
CREATE INDEX officer_applications_retention_idx ON officer_applications(retention_review_at);
--> statement-breakpoint
CREATE TABLE `client_enquiries__hold` AS SELECT * FROM `client_enquiries`;
--> statement-breakpoint
DROP TABLE `client_enquiries`;
--> statement-breakpoint
CREATE TABLE `client_enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`email_normalized` text NOT NULL,
	`mobile_normalized` text,
	`site_area` text NOT NULL,
	`site_type` text NOT NULL,
	`required_start` text NOT NULL,
	`message` text NOT NULL,
	`service_type` text DEFAULT 'scheduled_unarmed_fixed_site' NOT NULL,
	`funding_model` text DEFAULT 'advance_only' NOT NULL,
	`credit_terms_days` integer DEFAULT 0 NOT NULL,
	`privacy_notice_version` text NOT NULL,
	`privacy_acknowledged_at` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`owner_id` text,
	`resolution` text,
	`environment` text DEFAULT 'production' NOT NULL,
	`integrity_state` text DEFAULT 'user_submitted' NOT NULL,
	`retention_review_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
, site_address TEXT, start_date TEXT, end_date TEXT, start_time TEXT, end_time TEXT, officer_count INTEGER CHECK (officer_count IS NULL OR officer_count BETWEEN 1 AND 100), schedule TEXT);
--> statement-breakpoint
INSERT INTO `client_enquiries` SELECT * FROM `client_enquiries__hold`;
--> statement-breakpoint
DROP TABLE `client_enquiries__hold`;
--> statement-breakpoint
CREATE INDEX `client_enquiries_queue_idx` ON `client_enquiries` (`environment`,`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `client_enquiries_email_idx` ON `client_enquiries` (`email_normalized`,`created_at`);
--> statement-breakpoint
CREATE INDEX client_enquiries_retention_idx ON client_enquiries(retention_review_at);
--> statement-breakpoint
CREATE TABLE `operational_delivery_jobs__hold` AS SELECT * FROM `operational_delivery_jobs`;
--> statement-breakpoint
DROP TABLE `operational_delivery_jobs`;
--> statement-breakpoint
CREATE TABLE `operational_delivery_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`environment` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`lease_token` text,
	`lease_expires_at` text,
	`request_json` text,
	`recipient` text,
	`provider_id` text,
	`first_attempt_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "operational_delivery_kind" CHECK(kind IN ('enquiry_crm','enquiry_email','booking_email','contract_email')),
	CONSTRAINT "operational_delivery_state" CHECK(state IN ('queued','blocked','dispatching','retry_wait','sent','delivered','failed','uncertain','cancelled')),
	CONSTRAINT "operational_delivery_environment" CHECK(environment IN ('production')),
	CONSTRAINT "operational_delivery_attempts" CHECK(attempts>=0 AND attempts<=5),
	CONSTRAINT "operational_delivery_request" CHECK(request_json IS NULL OR json_valid(request_json))
);
--> statement-breakpoint
INSERT INTO `operational_delivery_jobs` SELECT * FROM `operational_delivery_jobs__hold`;
--> statement-breakpoint
DROP TABLE `operational_delivery_jobs__hold`;
--> statement-breakpoint
CREATE UNIQUE INDEX `operational_delivery_source_idx` ON `operational_delivery_jobs` (`kind`,`source_id`);
--> statement-breakpoint
CREATE INDEX `operational_delivery_due_idx` ON `operational_delivery_jobs` (`state`,`next_attempt_at`);
--> statement-breakpoint
UPDATE `identity_verification_cases` SET `application_id`=(SELECT `application_id` FROM `_identity_application_links` k WHERE k.`id`=`identity_verification_cases`.`id`) WHERE `id` IN (SELECT `id` FROM `_identity_application_links`);
--> statement-breakpoint
DROP TABLE `_identity_application_links`;
--> statement-breakpoint
CREATE TRIGGER `identity_case_identity_immutable_v21`
BEFORE UPDATE OF `application_id`,`officer_id`,`provider_key`,`provider_reference`,`consent_version`,`consented_at`,`environment`,`integrity_state`,`created_at` ON `identity_verification_cases`
WHEN NEW.`application_id` IS NOT OLD.`application_id`
	OR (OLD.`officer_id` IS NOT NULL AND NEW.`officer_id` IS NOT OLD.`officer_id`)
	OR (OLD.`officer_id` IS NULL AND NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport
		LEFT JOIN `officer_applications` application ON application.`id` = OLD.`application_id`
		WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = OLD.`environment` AND passport.`integrity_state` = OLD.`integrity_state`
			AND (OLD.`application_id` IS NULL OR application.`officer_id` = NEW.`officer_id`)
	))
	OR NEW.`provider_key` IS NOT OLD.`provider_key`
	OR (OLD.`provider_reference` IS NOT NULL AND NEW.`provider_reference` IS NOT OLD.`provider_reference`)
	OR NEW.`consent_version` IS NOT OLD.`consent_version` OR NEW.`consented_at` IS NOT OLD.`consented_at`
	OR NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
	OR NEW.`created_at` IS NOT OLD.`created_at`
BEGIN
	SELECT RAISE(ABORT, 'identity_case_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_transition_guard_v21`
BEFORE UPDATE OF `status` ON `identity_verification_cases`
WHEN NEW.`status` IS NOT OLD.`status`
BEGIN
	SELECT (CASE WHEN NOT (
		(OLD.`status` = 'created' AND NEW.`status` IN ('consent_pending','submitted','cancelled'))
		OR (OLD.`status` = 'consent_pending' AND NEW.`status` IN ('submitted','cancelled','expired'))
		OR (OLD.`status` = 'submitted' AND NEW.`status` IN ('processing','manual_review','cancelled','expired'))
		OR (OLD.`status` = 'processing' AND NEW.`status` IN ('verified','rejected','manual_review','expired'))
		OR (OLD.`status` = 'rejected' AND NEW.`status` = 'manual_review')
		OR (OLD.`status` = 'manual_review' AND NEW.`status` IN ('verified','rejected','cancelled','expired'))
	) THEN RAISE(ABORT, 'identity_case_transition_invalid') END);
	SELECT (CASE WHEN NEW.`status` = 'verified' AND
		(NEW.`decision` IS NULL OR NEW.`evidence_reference` IS NULL OR NEW.`completed_at` IS NULL)
		THEN RAISE(ABORT, 'identity_verification_evidence_missing') END);
	SELECT (CASE WHEN NEW.`status` = 'rejected' AND (NEW.`decision` IS NULL OR NEW.`completed_at` IS NULL)
		THEN RAISE(ABORT, 'identity_rejection_evidence_missing') END);
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_terminal_guard_v21`
BEFORE UPDATE ON `identity_verification_cases`
WHEN OLD.`status` IN ('verified','expired','cancelled')
	AND (NEW.`status` IS NOT OLD.`status` OR NEW.`decision` IS NOT OLD.`decision`
		OR NEW.`checks` IS NOT OLD.`checks` OR NEW.`reason_codes` IS NOT OLD.`reason_codes`
		OR NEW.`evidence_reference` IS NOT OLD.`evidence_reference` OR NEW.`completed_at` IS NOT OLD.`completed_at`)
BEGIN
	SELECT RAISE(ABORT, 'identity_case_terminal');
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_no_delete_v21`
BEFORE DELETE ON `identity_verification_cases`
BEGIN
	SELECT RAISE(ABORT, 'identity_case_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `integration_operation_parent_provenance_v21`
BEFORE INSERT ON `integration_operations`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `integration_provider_configs` config WHERE config.`key` = NEW.`provider_key`
			AND config.`capability` = NEW.`capability` AND config.`environment` = NEW.`environment`
			AND config.`integrity_state` = NEW.`integrity_state`
	) OR NEW.`entity_type` NOT IN ('officer_application','booking','service_request','identity_case','payment_order')
	OR (NEW.`entity_type` = 'officer_application' AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'booking' AND NOT EXISTS (
		SELECT 1 FROM `bookings` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'service_request' AND NOT EXISTS (
		SELECT 1 FROM `service_requests` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'identity_case' AND NOT EXISTS (
		SELECT 1 FROM `identity_verification_cases` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`entity_type` = 'payment_order' AND NOT EXISTS (
		SELECT 1 FROM `payment_orders` entity WHERE entity.`id` = NEW.`entity_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR NEW.`state` NOT IN ('pending','awaiting_webhook')
	THEN RAISE(ABORT, 'integration_operation_provider_mismatch') END);
END;
--> statement-breakpoint
CREATE VIEW specialist_required_checks_v34 AS
SELECT p.id AS pack_id,r.value AS code
FROM specialist_deployment_packs p JOIN bookings b ON b.id=p.booking_id,
json_each('["client_contract","client_onboarding","risk_assessment","post_orders","insurance","command_relief","cost_evidence","armed_authority","principal_consent","vehicle","overnight"]') r
WHERE r.value IN ('client_contract','client_onboarding','risk_assessment','post_orders','insurance','command_relief','cost_evidence')
 OR (r.value='armed_authority' AND b.specialist_service_code IN ('armed_static','armed_movement','vip_armed'))
 OR (r.value='principal_consent' AND b.specialist_service_code LIKE 'vip_%')
 OR (r.value='vehicle' AND json_extract(b.specialist_configuration,'$.vehicleClass')<>'none')
 OR (r.value='overnight' AND json_extract(b.specialist_configuration,'$.overnightDays')>0)
UNION ALL
SELECT p.id,'officer:'||o.value||':'||r.value
FROM specialist_deployment_packs p JOIN bookings b ON b.id=p.booking_id,
json_each(p.content,'$.officerIds') o,json_each('["onboarding","psira","induction","readiness","firearm","protection","driving"]') r
WHERE r.value IN ('onboarding','psira','induction','readiness')
 OR (r.value='firearm' AND b.specialist_service_code IN ('armed_static','armed_movement','vip_armed'))
 OR (r.value='protection' AND b.specialist_service_code LIKE 'vip_%')
 OR (r.value='driving' AND b.specialist_service_code IN ('armed_movement','vip_protective_driver'));
--> statement-breakpoint
CREATE VIEW specialist_pack_validation_v34 AS
SELECT p.id,p.booking_id,p.environment,CASE WHEN
 p.environment=b.environment AND p.integrity_state=CASE p.environment WHEN 'demo' THEN 'synthetic' ELSE 'recorded' END
 AND b.specialist_service_code<>'standard_unarmed' AND price.valid=1 AND b.pricing_status='authoritative'
 AND control.assignment_plan_current=1 AND control.specialist_authority_current=1 AND control.funding_current=1
 AND cr.status='approved' AND cr.environment=p.environment AND cr.version=p.commercial_review_version
 AND cr.pricing_version=b.pricing_version AND cr.terms_version='LOKD-SPECIALIST-TERMS-2026.09-v1'
 AND julianday(cr.expires_at)>julianday(CURRENT_TIMESTAMP) AND julianday(cr.expires_at)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))>julianday(CURRENT_TIMESTAMP)
 AND p.quote_snapshot=json_array(b.id,b.client_id,b.specialist_service_code,b.specialist_configuration,b.pricing_version,
 b.quote_subtotal_cents,b.vat_cents,b.client_price_cents,b.cost_floor_cents,b.margin_basis_points,b.headcount,
 (SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id),(SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id),'LOKD-SPECIALIST-TERMS-2026.09-v1')
 AND json_type(p.content,'$.officerIds')='array' AND json_array_length(p.content,'$.officerIds')>=b.headcount
 AND json_array_length(p.content,'$.officerIds')=(SELECT COUNT(DISTINCT value) FROM json_each(p.content,'$.officerIds'))
 AND NOT EXISTS(SELECT 1 FROM json_each(p.content,'$.officerIds') o WHERE NOT EXISTS(
 SELECT 1 FROM officers officer JOIN workforce_engagements w ON w.officer_id=officer.id
 WHERE officer.id=o.value AND w.environment=p.environment AND officer.approval_status='approved'
 AND julianday(officer.psira_expiry)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))))
 AND length(trim(json_extract(p.content,'$.commandOwner')))>0
 AND length(trim(json_extract(p.content,'$.clientBrief')))>0 AND length(trim(json_extract(p.content,'$.officerBrief')))>0
 AND ( (p.partner_id IS NULL AND json_extract(b.specialist_configuration,'$.vehicleClass') NOT IN ('standard_suv','armoured_partner'))
 OR (partner.status='approved' AND partner.environment=p.environment AND partner.version=p.partner_version
 AND julianday(partner.valid_from)<=julianday(CURRENT_TIMESTAMP)
 AND julianday(partner.valid_from)<=julianday((SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(partner.expires_at)>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(partner.expires_at)>julianday(CURRENT_TIMESTAMP)
 AND EXISTS(SELECT 1 FROM json_each(partner.service_codes) WHERE value=b.specialist_service_code)))
 AND NOT EXISTS(SELECT 1 FROM specialist_required_checks_v34 r WHERE r.pack_id=p.id AND NOT EXISTS(
 SELECT 1 FROM json_each(p.content,'$.checks') e WHERE json_extract(e.value,'$.code')=r.code
 AND json_type(e.value,'$.reference')='text' AND length(trim(json_extract(e.value,'$.reference')))>0
 AND julianday(json_extract(e.value,'$.validFrom'))<=julianday(CURRENT_TIMESTAMP)
 AND julianday(json_extract(e.value,'$.validFrom'))<=julianday((SELECT MIN(starts_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(json_extract(e.value,'$.expiresAt'))>=julianday((SELECT MAX(ends_at) FROM roster_slots WHERE booking_id=b.id))
 AND julianday(json_extract(e.value,'$.expiresAt'))>julianday(CURRENT_TIMESTAMP)
 AND (p.environment='demo' OR (lower(json_extract(e.value,'$.reference')) NOT LIKE '%demo:%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%synthetic%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%.invalid%'
 AND lower(json_extract(e.value,'$.reference')) NOT LIKE '%.example%'))))
 THEN 1 ELSE 0 END AS valid
FROM specialist_deployment_packs p JOIN bookings b ON b.id=p.booking_id
LEFT JOIN specialist_pricing_validation_v33 price ON price.id=b.id
LEFT JOIN specialist_booking_control_validation_v33 control ON control.id=b.id
LEFT JOIN specialist_commercial_reviews cr ON cr.id=p.commercial_review_id
LEFT JOIN specialist_partners partner ON partner.id=p.partner_id;
--> statement-breakpoint
CREATE VIEW current_production_client_approvals AS
SELECT x.id AS client_id,r.id AS review_id,r.expires_at FROM clients x
JOIN production_entity_links l ON l.kind='client' AND l.entity_id=x.id
JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
JOIN production_client_reviews r ON r.client_id=x.id AND r.case_version=l.case_version AND r.owner_user_id=l.owner_user_id
JOIN production_client_decisions d ON d.review_id=r.id AND d.decision='approve'
WHERE x.approval_status='approved' AND x.integrity_state='production_verified' AND x.environment='production'
AND json_extract(r.snapshot_json,'$.organisationName')=x.organisation_name AND json_extract(r.snapshot_json,'$.contactName')=x.contact_name AND json_extract(r.snapshot_json,'$.email')=x.contact_email
AND r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
AND NOT EXISTS(SELECT 1 FROM production_client_suspensions s WHERE s.client_id=x.id AND s.created_at>=r.prepared_at);
--> statement-breakpoint
CREATE VIEW payment_destination_sources AS
SELECT p.id AS profile_id,p.officer_id,l.owner_user_id,
 json_object('profileId',p.id,'profileVersion',p.version,'officerId',p.officer_id,'engagementId',w.id,'engagementVersion',w.version,'employerId',e.id,'employerVersion',e.version,'caseId',l.case_id,'caseVersion',l.case_version,'ownerUser',l.owner_user_id,'profileReview',r.id,'profileHash',r.payload_hash,'expiresAt',min(r.expires_at,w.review_due_at,e.review_due_at)) AS source_json
FROM payroll_profiles p
JOIN production_evidence_reviews r ON p.evidence_reference='review:'||r.id AND r.state='approved'
JOIN workforce_engagements w ON w.id=p.workforce_engagement_id AND w.officer_id=p.officer_id AND w.employer_id=p.employer_id
JOIN workforce_employers e ON e.id=w.employer_id
JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=p.officer_id
JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
WHERE p.environment='production' AND p.integrity_state='production_verified' AND p.status='calculation_ready' AND p.active_key=p.officer_id
AND w.environment='production' AND w.status='active' AND w.active_key=w.officer_id AND w.model IN ('direct_flex','managed')
AND e.environment='production' AND e.employer_type='lokd_employer' AND e.status='current'
AND min(r.expires_at,w.review_due_at,e.review_due_at)>strftime('%Y-%m-%dT%H:%M:%fZ','now');
--> statement-breakpoint
CREATE VIEW payment_destination_current AS
SELECT r.*,
 CASE WHEN h.id IS NOT NULL THEN 'held'
 WHEN EXISTS(SELECT 1 FROM payment_destination_reviews newer JOIN payment_destination_decisions nd ON nd.review_id=newer.id AND nd.decision IN ('verified_live','confirmed_test') WHERE newer.officer_id=r.officer_id AND newer.mode=r.mode AND newer.revision>r.revision) THEN 'superseded'
 WHEN d.decision='rejected' THEN 'rejected'
 WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='payroll_preparer') OR (d.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='payroll_reviewer')) THEN 'authority_changed'
 WHEN s.profile_id IS NULL OR s.source_json!=json_extract(r.payload_json,'$.sourceJson') THEN 'source_changed'
 WHEN r.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR r.review_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expired'
 ELSE coalesce(d.decision,'pending') END AS status,
 d.operator_id AS reviewed_by,h.reason AS hold_reason
FROM payment_destination_reviews r
LEFT JOIN payment_destination_sources s ON s.profile_id=r.profile_id
LEFT JOIN payment_destination_decisions d ON d.review_id=r.id
LEFT JOIN payment_destination_holds h ON h.review_id=r.id;
--> statement-breakpoint
CREATE VIEW employee_payment_sources AS
SELECT i.id AS payroll_item_id,d.id AS destination_id,d.mode,i.net_pay_cents AS amount_cents,
 json_patch(json_object('payrollItemId',i.id,'runId',r.id,'runVersion',r.version,'calculationHash',s.payload_hash,'profileId',i.payroll_profile_id,'profileVersion',json_extract(j.value,'$.profileVersion'),'officerId',i.officer_id,'employerId',i.employer_id,'engagementId',i.workforce_engagement_id,'amountCents',i.net_pay_cents,'currency','ZAR','payDate',r.pay_date,'destinationId',d.id,'destinationHash',d.payload_hash,'recipient',json_extract(d.payload_json,'$.provider'),'ownerUser',json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.ownerUser')),json_object('mode',d.mode)) AS source_json
FROM payroll_items i JOIN payroll_runs r ON r.id=i.payroll_run_id
JOIN production_payroll_snapshots s ON s.run_id=r.id
JOIN json_each(s.payload_json,'$.items') j ON json_extract(j.value,'$.id')=i.id
JOIN payroll_policy_versions p ON p.id=s.policy_id AND p.policy_hash=json_extract(s.payload_json,'$.policyHash') AND p.status='active' AND p.active_key='production:ZA'
JOIN payment_destination_current d ON d.profile_id=i.payroll_profile_id AND d.officer_id=i.officer_id AND d.status=CASE d.mode WHEN 'test' THEN 'confirmed_test' ELSE 'verified_live' END
WHERE r.environment='production' AND r.integrity_state='production_verified' AND r.status='exported' AND r.export_reference='payroll-snapshot:'||s.payload_hash
AND i.environment='production' AND i.integrity_state='production_verified' AND i.status='calculated' AND i.workforce_model IN ('direct_flex','managed') AND i.net_pay_cents>0 AND i.net_pay_cents<=25000000
AND i.net_pay_cents=json_extract(j.value,'$.calculation.netPayCents') AND i.officer_id=json_extract(j.value,'$.officerId') AND i.payroll_profile_id=json_extract(j.value,'$.profileId') AND i.workforce_engagement_id=json_extract(j.value,'$.engagementId') AND i.employer_id=r.employer_id
AND json_extract(j.value,'$.profileVersion')=json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.profileVersion')
AND i.workforce_engagement_id=json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.engagementId') AND i.employer_id=json_extract(json_extract(d.payload_json,'$.sourceJson'),'$.employerId')
AND NOT EXISTS(SELECT 1 FROM json_each(json_array(json_object('id',r.created_by,'role','payroll_preparer'),json_object('id',r.approved_by,'role','payroll_reviewer'),json_object('id',r.second_approved_by,'role','finance_approver'))) required WHERE NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=json_extract(required.value,'$.id') AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.net_pay_cents AND g.role=json_extract(required.value,'$.role') AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE VIEW production_partner_payable_sources AS
SELECT t.id AS timesheet_id,t.employer_id,
 json_object('timesheetId',t.id,'timesheetVersion',t.version,'officerId',t.officer_id,'employerId',e.id,'employerName',e.legal_name,'employerVersion',e.version,'engagementId',w.id,'engagementVersion',w.version,'serviceDate',t.service_date,'payableMinutes',t.payable_minutes,'agreementEvidenceId',ec.id,'agreementEvidence',ec.evidence_reference,'officerUser',lo.owner_user_id,'clientUser',lc.owner_user_id,'expiresAt',min(e.review_due_at,w.review_due_at,ec.expires_at)) AS source_json
FROM shift_timesheets t JOIN shifts shift ON shift.id=t.shift_id AND shift.status IN ('completed','verified')
JOIN bookings b ON b.id=t.booking_id
JOIN workforce_engagements w ON w.id=t.workforce_engagement_id AND w.officer_id=t.officer_id AND w.employer_id=t.employer_id
JOIN workforce_employers e ON e.id=t.employer_id
JOIN employer_compliance_evidence ec ON ec.employer_id=e.id AND ec.control_code='service_agreement' AND ec.active_key=e.id||':service_agreement' AND ec.environment='production' AND ec.integrity_state='verified' AND ec.status='current'
JOIN production_entity_links lo ON lo.kind='officer' AND lo.entity_id=t.officer_id
JOIN production_entity_links lc ON lc.kind='client' AND lc.entity_id=b.client_id
WHERE t.environment='production' AND t.integrity_state='production_verified' AND t.workforce_model='partner' AND t.active_key=t.shift_id AND t.client_evidence_status='confirmed' AND t.operations_status='approved_for_backend' AND t.payable_minutes IS NOT NULL
AND w.environment='production' AND w.model='partner' AND w.status='active' AND w.active_key=w.officer_id AND e.environment='production' AND e.employer_type='partner_company' AND e.status='current' AND e.service_agreement_status='current'
AND min(e.review_due_at,w.review_due_at,ec.expires_at)>strftime('%Y-%m-%dT%H:%M:%fZ','now')
AND NOT EXISTS(SELECT 1 FROM pay_item_sources p WHERE p.timesheet_id=t.id AND p.active_key IS NOT NULL);
--> statement-breakpoint
CREATE VIEW production_partner_payable_current AS
SELECT r.*,d.decision,ex.created_at AS exported_at,h.note AS hold_note,
 CASE WHEN h.review_id IS NOT NULL THEN 'held' WHEN d.decision='rejected' THEN 'rejected'
 WHEN EXISTS(SELECT 1 FROM partner_payables p WHERE p.timesheet_id=r.timesheet_id AND p.id!='PP-'||r.id) THEN 'allocated_elsewhere'
 WHEN s.source_json IS NULL OR s.source_json!=r.source_json THEN 'source_changed'
 WHEN r.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expired'
 WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='operations_controller') THEN 'authority_changed'
 WHEN d.decision='approved' AND NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver') THEN 'authority_changed'
 WHEN d.decision='approved' AND NOT EXISTS(SELECT 1 FROM partner_payables p WHERE p.id='PP-'||r.id) THEN 'allocation_incomplete'
 ELSE coalesce(d.decision,'pending') END AS status
FROM production_partner_payable_reviews r LEFT JOIN production_partner_payable_sources s ON s.timesheet_id=r.timesheet_id
LEFT JOIN production_partner_payable_decisions d ON d.review_id=r.id LEFT JOIN production_partner_payable_holds h ON h.review_id=r.id LEFT JOIN production_partner_payable_exports ex ON ex.review_id=r.id;
--> statement-breakpoint
CREATE VIEW partner_destination_sources AS
SELECT e.id AS employer_id,
 json_object('employerId',e.id,'employerName',e.legal_name,'employerVersion',e.version,'expiresAt',min(e.review_due_at,(SELECT min(ec.expires_at) FROM employer_compliance_evidence ec WHERE ec.employer_id=e.id AND ec.active_key=e.id||':'||ec.control_code)),
 'complianceJson',(SELECT json_group_array(json_object('id',c.id,'control',c.control_code,'reference',c.evidence_reference,'version',c.version,'expiresAt',c.expires_at)) FROM (SELECT * FROM employer_compliance_evidence ec WHERE ec.employer_id=e.id AND ec.active_key=e.id||':'||ec.control_code ORDER BY ec.control_code) c)) AS source_json
FROM workforce_employers e
WHERE e.environment='production' AND e.employer_type='partner_company' AND e.status='current'
AND e.review_due_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')
AND e.psira_status='current' AND e.nbcpss_status='current' AND e.psspf_status='current' AND e.uif_status='current' AND e.coida_status='current' AND e.insurance_status='current' AND e.service_agreement_status='current'
AND (SELECT count(DISTINCT ec.control_code) FROM employer_compliance_evidence ec WHERE ec.employer_id=e.id AND ec.control_code IN ('psira','nbcpss','psspf','uif','coida','insurance','service_agreement') AND ec.active_key=e.id||':'||ec.control_code AND ec.environment='production' AND ec.integrity_state='verified' AND ec.status='current' AND ec.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))=7;
--> statement-breakpoint
CREATE VIEW partner_destination_current AS
SELECT r.*,
 CASE WHEN h.id IS NOT NULL THEN 'held'
 WHEN EXISTS(SELECT 1 FROM partner_destination_reviews newer JOIN partner_destination_decisions nd ON nd.review_id=newer.id AND nd.decision IN ('verified_live','confirmed_test') WHERE newer.employer_id=r.employer_id AND newer.mode=r.mode AND newer.revision>r.revision) THEN 'superseded'
 WHEN d.decision='rejected' THEN 'rejected'
 WHEN NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.prepared_by AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='operations_controller') OR (d.id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active' AND g.role='finance_approver')) THEN 'authority_changed'
 WHEN s.employer_id IS NULL OR s.source_json!=json_extract(r.payload_json,'$.sourceJson') THEN 'source_changed'
 WHEN r.expires_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now') OR r.review_until<=strftime('%Y-%m-%dT%H:%M:%fZ','now') THEN 'expired'
 ELSE coalesce(d.decision,'pending') END AS status,
 d.operator_id AS reviewed_by,h.reason AS hold_reason
FROM partner_destination_reviews r
LEFT JOIN partner_destination_sources s ON s.employer_id=r.employer_id
LEFT JOIN partner_destination_decisions d ON d.review_id=r.id
LEFT JOIN partner_destination_holds h ON h.review_id=r.id;
--> statement-breakpoint
CREATE VIEW partner_payment_sources AS
SELECT p.id AS payable_id,d.id AS destination_id,d.mode,p.amount_cents,
 json_patch(json_object('payableId',p.id,'payableReviewId',r.id,'payableHash',r.payload_hash,'payableSource',r.source_json,'employerId',p.employer_id,'employerName',json_extract(r.source_json,'$.employerName'),'amountCents',p.amount_cents,'currency',p.currency,'invoiceNumber',json_extract(r.payload_json,'$.invoiceNumber'),'invoiceLine',json_extract(r.payload_json,'$.invoiceLine'),'dueDate',json_extract(r.payload_json,'$.dueDate'),'destinationId',d.id,'destinationHash',d.payload_hash,'recipient',json_extract(d.payload_json,'$.provider')),
 json_object('mode',d.mode,'representativeUser',json_extract(d.payload_json,'$.representativeUserId'),'officerUser',json_extract(r.source_json,'$.officerUser'),'clientUser',json_extract(r.source_json,'$.clientUser'))) AS source_json
FROM partner_payables p
JOIN production_partner_payable_current r ON p.id='PP-'||r.id AND r.status='approved'
JOIN partner_destination_current d ON d.employer_id=p.employer_id AND d.status=CASE d.mode WHEN 'test' THEN 'confirmed_test' ELSE 'verified_live' END
WHERE p.environment='production' AND p.integrity_state='production_verified' AND p.status='approved_unpaid' AND p.remittance_reference IS NULL
AND p.employer_id=r.employer_id AND p.timesheet_id=r.timesheet_id AND p.amount_cents=r.amount_cents AND p.amount_cents>0 AND p.amount_cents<=25000000 AND p.currency='ZAR'
AND p.service_agreement_version=json_extract(r.payload_json,'$.agreementVersion');
--> statement-breakpoint
CREATE VIEW employee_recovery_reviewable AS
 SELECT p.*,i.amount_cents,i.source_json,i.prepared_by,i.prepared_user FROM employee_recovery_proposals p
 JOIN employee_payment_instructions i ON i.reference=p.reference AND i.version=p.instruction_version AND i.source_hash=p.source_hash AND i.active_key IS NOT NULL
 JOIN employee_recovery_terminal t ON t.reference=p.reference AND t.evidence_id=p.evidence_id AND t.disposition=p.disposition
 WHERE NOT EXISTS(SELECT 1 FROM employee_recovery_chain_holds h WHERE h.reference=p.reference) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW employee_recovery_available AS
 SELECT a.id AS approval_id,p.* FROM employee_recovery_approvals a JOIN employee_recovery_reviewable p ON p.id=a.proposal_id
 WHERE a.operator_id!=p.operator_id AND a.user_id!=p.user_id AND a.operator_id!=p.prepared_by AND a.user_id!=p.prepared_user AND a.user_id IS NOT json_extract(p.source_json,'$.ownerUser') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=p.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW partner_recovery_reviewable AS
 SELECT p.*,i.amount_cents,i.source_json,i.prepared_by,i.prepared_user FROM partner_recovery_proposals p
 JOIN partner_payment_instructions i ON i.reference=p.reference AND i.version=p.instruction_version AND i.source_hash=p.source_hash AND i.active_key IS NOT NULL
 JOIN partner_recovery_terminal t ON t.reference=p.reference AND t.evidence_id=p.evidence_id AND t.disposition=p.disposition
 WHERE NOT EXISTS(SELECT 1 FROM partner_recovery_chain_holds h WHERE h.reference=p.reference) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW partner_recovery_available AS
 SELECT a.id AS approval_id,p.* FROM partner_recovery_approvals a JOIN partner_recovery_reviewable p ON p.id=a.proposal_id
 WHERE a.operator_id!=p.operator_id AND a.user_id!=p.user_id AND a.operator_id!=p.prepared_by AND a.user_id!=p.prepared_user AND a.user_id NOT IN (json_extract(p.source_json,'$.representativeUser'),json_extract(p.source_json,'$.officerUser'),json_extract(p.source_json,'$.clientUser')) AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=p.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW current_production_officer_reviews AS
 SELECT r.*,s.expires_at,s.certificate_expiry FROM production_officer_reviews r JOIN current_production_officer_sources s ON s.officer_id=r.officer_id AND json_extract(r.source_json,'$.officer_id')=s.officer_id AND json_extract(r.source_json,'$.applicant_id')=s.applicant_id AND json_extract(r.source_json,'$.applicant_version')=s.applicant_version AND json_extract(r.source_json,'$.owner_user_id')=s.owner_user_id AND json_extract(r.source_json,'$.full_name')=s.full_name AND json_extract(r.source_json,'$.mobile')=s.mobile AND json_extract(r.source_json,'$.email')=s.email AND json_extract(r.source_json,'$.city')=s.city AND json_extract(r.source_json,'$.psira_number')=s.psira_number AND json_extract(r.source_json,'$.psira_grade')=s.psira_grade AND json_extract(r.source_json,'$.identity_case_id')=s.identity_case_id AND json_extract(r.source_json,'$.identity_outcome_id')=s.identity_outcome_id AND json_extract(r.source_json,'$.identity_reviewer')=s.identity_reviewer AND json_extract(r.source_json,'$.entity_preparer')=s.entity_preparer AND json_extract(r.source_json,'$.psira_case_id')=s.psira_case_id AND json_extract(r.source_json,'$.psira_event_id')=s.psira_event_id AND json_extract(r.source_json,'$.psira_reviewer')=s.psira_reviewer AND json_extract(r.source_json,'$.certificate_expiry')=s.certificate_expiry AND json_extract(r.source_json,'$.expires_at')=s.expires_at
 WHERE NOT EXISTS(SELECT 1 FROM production_officer_suspensions x WHERE x.officer_id=r.officer_id AND x.created_at>=r.prepared_at);
--> statement-breakpoint
CREATE VIEW current_production_officer_approvals AS
 SELECT r.* FROM current_production_officer_reviews r JOIN production_officer_decisions d ON d.review_id=r.id AND d.decision='approve';
--> statement-breakpoint
CREATE VIEW current_production_readiness_rules AS
 SELECT r.* FROM production_readiness_rules r JOIN production_readiness_decisions d ON d.kind='rule' AND d.target_id=r.id AND d.decision='approve'
 WHERE julianday(r.expires_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM production_readiness_holds h WHERE h.kind='rule' AND h.target_id=r.id)
 AND NOT EXISTS(SELECT 1 FROM production_readiness_rules newer JOIN production_readiness_decisions nd ON nd.kind='rule' AND nd.target_id=newer.id AND nd.decision='approve' WHERE newer.code=r.code AND newer.rowid>r.rowid);
--> statement-breakpoint
CREATE VIEW valid_production_readiness_reviews AS
 SELECT r.*,p.code,p.label,p.category,p.service_type,p.purpose_code FROM production_readiness_reviews r
 JOIN current_production_officer_approvals a ON a.id=r.officer_review_id AND a.officer_id=r.officer_id
 JOIN officers o ON o.id=r.officer_id AND o.approval_status='approved'
 JOIN current_production_readiness_rules p ON p.id=r.rule_id
 WHERE julianday(r.expires_at)>julianday('now') AND julianday(r.expires_at)<=julianday(a.expires_at) AND julianday(r.expires_at)<=julianday(p.expires_at)
 AND NOT EXISTS(SELECT 1 FROM production_readiness_holds h WHERE h.kind='review' AND h.target_id=r.id);
--> statement-breakpoint
CREATE VIEW current_production_readiness_reviews AS
 SELECT r.* FROM valid_production_readiness_reviews r JOIN production_readiness_decisions d ON d.kind='review' AND d.target_id=r.id AND d.decision='approve'
 WHERE NOT EXISTS(SELECT 1 FROM production_readiness_reviews newer JOIN production_readiness_rules np ON np.id=newer.rule_id JOIN production_readiness_decisions nd ON nd.kind='review' AND nd.target_id=newer.id AND nd.decision='approve' WHERE newer.officer_id=r.officer_id AND np.code=r.code AND newer.rowid>(SELECT rowid FROM production_readiness_reviews WHERE id=r.id));
--> statement-breakpoint
CREATE VIEW current_production_readiness_optins AS
 SELECT x.* FROM production_readiness_optins x WHERE x.revision=(SELECT MAX(revision) FROM production_readiness_optins WHERE officer_id=x.officer_id AND service_type=x.service_type);
--> statement-breakpoint
CREATE VIEW current_production_readiness_passports AS
 SELECT p.* FROM valid_production_readiness_passports p JOIN production_readiness_decisions d ON d.kind='passport' AND d.target_id=p.id AND d.decision='approve'
 WHERE NOT EXISTS(SELECT 1 FROM production_readiness_passports newer JOIN production_readiness_decisions nd ON nd.kind='passport' AND nd.target_id=newer.id AND nd.decision='approve' WHERE newer.officer_id=p.officer_id AND newer.sequence>p.sequence);
--> statement-breakpoint
CREATE VIEW usable_production_readiness_passports AS
 SELECT p.* FROM current_production_readiness_passports p JOIN officer_passports projection ON projection.officer_id=p.officer_id AND projection.evidence_reference='readiness-passport:'||p.id AND projection.public_token_hash=p.token_hash AND projection.status IN ('active','expiring') AND projection.environment='production' AND projection.integrity_state='verified';
--> statement-breakpoint
CREATE VIEW production_rereview_targets AS
 SELECT 'identity' AS kind,h.id AS hold_id,c.id AS subject_id,c.applicant_id,c.owner_user_id,l.entity_id AS officer_id,h.recorded_at AS held_at,h.actor_id AS held_by,h.reason
 FROM production_identity_suspensions h JOIN production_identity_cases c ON c.id=h.case_id LEFT JOIN production_entity_links l ON l.kind='officer' AND l.case_id=c.applicant_id AND l.owner_user_id=c.owner_user_id
 UNION ALL
 SELECT 'officer',h.id,h.officer_id,l.case_id,l.owner_user_id,h.officer_id,h.created_at,h.actor_id,h.reason FROM production_officer_suspensions h JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=h.officer_id
 UNION ALL
 SELECT 'workforce',h.id,h.engagement_id,l.case_id,l.owner_user_id,h.officer_id,h.recorded_at,h.actor_id,h.reason FROM production_workforce_holds h JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=h.officer_id
 UNION ALL
 SELECT 'review',h.id,r.id,l.case_id,l.owner_user_id,r.officer_id,h.recorded_at,h.actor_id,h.reason FROM production_readiness_holds h JOIN production_readiness_reviews r ON h.kind='review' AND r.id=h.target_id JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=r.officer_id
 UNION ALL
 SELECT 'passport',h.id,p.id,l.case_id,l.owner_user_id,p.officer_id,h.recorded_at,h.actor_id,h.reason FROM production_readiness_holds h JOIN production_readiness_passports p ON h.kind='passport' AND p.id=h.target_id JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=p.officer_id;
--> statement-breakpoint
CREATE VIEW production_rereview_authorizations AS
 SELECT p.*,d.actor_id AS decided_by,d.decided_at,f.passport_sequence,f.officer_rowid,f.readiness_rowid,f.workforce_rowid FROM production_rereview_proposals p JOIN production_rereview_cutoffs f ON f.proposal_id=p.id JOIN production_rereview_decisions d ON d.proposal_id=p.id AND d.decision='allow_replacement'
 JOIN signup_cases c ON c.kind='officer' AND c.source_id=p.applicant_id AND c.version=p.applicant_version AND c.owner_user_id=p.owner_user_id AND c.status='reviewed';
--> statement-breakpoint
CREATE VIEW valid_production_readiness_passports AS
 SELECT p.* FROM production_readiness_passports p JOIN current_production_officer_approvals a ON a.id=p.officer_review_id AND a.officer_id=p.officer_id
 JOIN officers o ON o.id=p.officer_id AND o.approval_status='approved'
 WHERE julianday(p.expires_at)>julianday('now') AND julianday(p.expires_at)<=julianday(a.expires_at)
 AND json_array_length(p.items_json)>=3
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN current_production_readiness_reviews r ON r.id=j.value WHERE r.category='service' AND NOT EXISTS(SELECT 1 FROM officer_services svc WHERE svc.officer_id=p.officer_id AND svc.service_type=r.service_type AND svc.qualified=1 AND svc.opted_in=1 AND julianday(svc.qualification_expiry)>=julianday(p.expires_at)))
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) item WHERE NOT EXISTS(SELECT 1 FROM current_production_readiness_reviews r WHERE r.id=item.value AND r.officer_id=p.officer_id AND r.officer_review_id=p.officer_review_id AND julianday(r.expires_at)>=julianday(p.expires_at)))
 AND (SELECT count(DISTINCT r.category) FROM json_each(p.items_json) item JOIN current_production_readiness_reviews r ON r.id=item.value)=3
 AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) item JOIN current_production_readiness_reviews r ON r.id=item.value WHERE r.category='service' AND NOT EXISTS(SELECT 1 FROM current_production_readiness_optins x JOIN json_each(p.optins_json) chosen ON chosen.value=x.id WHERE x.officer_id=p.officer_id AND x.service_type=r.service_type AND x.opted_in=1))
 AND NOT EXISTS(SELECT 1 FROM production_readiness_holds h JOIN production_readiness_passports old ON old.id=h.target_id WHERE h.kind='passport' AND old.officer_id=p.officer_id AND (h.target_id=p.id OR NOT EXISTS(SELECT 1 FROM production_rereview_authorizations a WHERE a.kind='passport' AND a.hold_id=h.id AND p.sequence>a.passport_sequence AND julianday(p.prepared_at)>=julianday(a.decided_at) AND julianday(p.prepared_at)<julianday(a.expires_at) AND NOT EXISTS(SELECT 1 FROM json_each(p.items_json) j JOIN production_readiness_reviews r ON r.id=j.value JOIN json_each(r.evidence_json) e WHERE (r.rowid<=a.readiness_rowid OR julianday(json_extract(e.value,'$.checkedAt'))<julianday(a.decided_at))))));
--> statement-breakpoint
CREATE VIEW payment_instruction_records AS SELECT 'employee' AS kind,payroll_item_id AS liability_id,i.* FROM employee_payment_instructions i UNION ALL SELECT 'partner' AS kind,payable_id AS liability_id,i.* FROM partner_payment_instructions i;
--> statement-breakpoint
CREATE VIEW payment_destination_evidence AS SELECT 'employee' AS kind,id,payload_json FROM payment_destination_reviews UNION ALL SELECT 'partner' AS kind,id,payload_json FROM partner_destination_reviews;
--> statement-breakpoint
CREATE VIEW payment_instruction_sources AS SELECT 'employee' AS kind,payroll_item_id AS liability_id,s.* FROM employee_payment_sources s UNION ALL SELECT 'partner' AS kind,payable_id AS liability_id,s.* FROM partner_payment_sources s;
--> statement-breakpoint
CREATE VIEW payment_live_reserve_current AS SELECT r.*,r.amount_cents-coalesce((SELECT sum(i.amount_cents+l.fee_ceiling_cents) FROM payment_live_claims c JOIN payment_live_releases l ON l.id=c.release_id JOIN payment_instruction_records i ON i.kind=c.kind AND i.reference=c.reference WHERE l.reserve_id=r.id),0) AS remaining_cents FROM payment_live_reserves r JOIN payment_live_reserve_decisions d ON d.reserve_id=r.id AND d.decision='approved' WHERE r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=r.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW payment_live_release_reviewable AS SELECT l.*,i.amount_cents,i.version,i.source_json,i.prepared_by,i.prepared_user,r.remaining_cents FROM payment_live_releases l JOIN payment_instruction_records i ON i.kind=l.kind AND i.reference=l.reference AND i.source_hash=l.source_hash AND i.mode='live' AND i.status='approved' JOIN payment_instruction_sources s ON s.kind=i.kind AND s.liability_id=i.liability_id AND s.destination_id=i.destination_id AND s.source_json=i.source_json JOIN payment_live_reserve_current r ON r.id=l.reserve_id AND r.integration=json_extract(i.source_json,'$.recipient.integration') WHERE l.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND r.remaining_cents>=i.amount_cents+l.fee_ceiling_cents AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=l.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents+l.fee_ceiling_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW payment_live_release_available AS SELECT l.*,d.operator_id AS approved_operator,d.user_id AS approved_user FROM payment_live_release_reviewable l JOIN payment_live_release_decisions d ON d.release_id=l.id AND d.decision='approved' WHERE EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=l.amount_cents+l.fee_ceiling_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW employee_payment_final_evidence AS
 SELECT i.reference,e.id AS evidence_id,json_extract(e.transfer_json,'$.status') AS disposition
 FROM employee_payment_instructions i JOIN employee_transfer_observations e ON e.reference=i.reference
 WHERE (SELECT count(*) FROM employee_transfer_observations bounded WHERE bounded.reference=i.reference)<=500
 AND i.mode IN ('test','live') AND i.status='dispatch_claimed' AND e.source='verify' AND e.event='transfer.verify'
 AND e.rowid=(SELECT max(o.rowid) FROM employee_transfer_observations o WHERE o.reference=i.reference)
 AND julianday(e.created_at) IS NOT NULL AND julianday(e.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400
 AND json_extract(e.transfer_json,'$.status') IN ('success','failed','reversed')
 AND e.webhook_count=(SELECT count(*) FROM employee_transfer_observations o WHERE o.reference=i.reference AND o.source='webhook')
 AND EXISTS(SELECT 1 FROM employee_transfer_observations w WHERE w.reference=i.reference AND w.source='webhook' AND w.event='transfer.'||json_extract(e.transfer_json,'$.status') AND json_extract(w.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status'))
 AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations o WHERE o.reference=i.reference AND (
 o.source NOT IN ('initiate','verify','webhook') OR json_type(o.transfer_json) IS NOT 'object'
 OR json_extract(o.transfer_json,'$.reference') IS NOT i.reference OR json_extract(o.transfer_json,'$.mode') IS NOT i.mode
 OR json_extract(o.transfer_json,'$.amount') IS NOT i.amount_cents OR json_extract(o.transfer_json,'$.currency') IS NOT 'ZAR'
 OR json_extract(o.transfer_json,'$.recipientId') IS NOT json_extract(i.source_json,'$.recipient.id')
 OR json_extract(o.transfer_json,'$.integration') IS NOT json_extract(i.source_json,'$.recipient.integration')
 OR json_extract(o.transfer_json,'$.id') IS NULL OR json_extract(o.transfer_json,'$.code') IS NULL
 OR json_extract(o.transfer_json,'$.id') IS NOT json_extract(e.transfer_json,'$.id') OR json_extract(o.transfer_json,'$.code') IS NOT json_extract(e.transfer_json,'$.code')
 OR (o.source='webhook' AND (o.event NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR o.event IS NOT 'transfer.'||json_extract(o.transfer_json,'$.status')))
 OR json_extract(o.transfer_json,'$.status') NOT IN ('pending','otp','received',json_extract(e.transfer_json,'$.status'),CASE json_extract(e.transfer_json,'$.status') WHEN 'reversed' THEN 'success' ELSE json_extract(e.transfer_json,'$.status') END)
 OR (json_extract(o.transfer_json,'$.status') IS NOT json_extract(e.transfer_json,'$.status') AND EXISTS(SELECT 1 FROM employee_transfer_observations terminal WHERE terminal.reference=i.reference AND terminal.rowid<o.rowid AND json_extract(terminal.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status')))
 ));
--> statement-breakpoint
CREATE VIEW employee_recovery_terminal AS SELECT * FROM employee_payment_final_evidence WHERE disposition IN ('failed','reversed');
--> statement-breakpoint
CREATE VIEW employee_recovery_chain_holds AS
 WITH RECURSIVE edges AS (SELECT reference,predecessor,approval_id FROM employee_recovery_replacements UNION ALL SELECT reference,predecessor,NULL AS approval_id FROM payment_unsent_replacements WHERE kind='employee'), chain(reference,predecessor,approval_id) AS (
 SELECT reference,predecessor,approval_id FROM edges
 UNION ALL SELECT c.reference,r.predecessor,r.approval_id FROM chain c JOIN edges r ON r.reference=c.predecessor
 ) SELECT c.reference FROM chain c JOIN employee_recovery_approvals a ON a.id=c.approval_id JOIN employee_recovery_proposals p ON p.id=a.proposal_id
 WHERE NOT EXISTS(SELECT 1 FROM employee_recovery_terminal t WHERE t.reference=c.predecessor AND t.disposition=p.disposition)
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM employee_payment_instructions WHERE reference=c.predecessor) AND g.role='payroll_preparer' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'))
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM employee_payment_instructions WHERE reference=c.predecessor) AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE VIEW partner_payment_final_evidence AS
 SELECT i.reference,e.id AS evidence_id,json_extract(e.transfer_json,'$.status') AS disposition
 FROM partner_payment_instructions i JOIN partner_transfer_observations e ON e.reference=i.reference
 WHERE (SELECT count(*) FROM partner_transfer_observations bounded WHERE bounded.reference=i.reference)<=500
 AND i.mode IN ('test','live') AND i.status='dispatch_claimed' AND e.source='verify' AND e.event='transfer.verify'
 AND e.rowid=(SELECT max(o.rowid) FROM partner_transfer_observations o WHERE o.reference=i.reference)
 AND julianday(e.created_at) IS NOT NULL AND julianday(e.created_at) BETWEEN julianday('now')-5.0/1440 AND julianday('now')+1.0/86400
 AND json_extract(e.transfer_json,'$.status') IN ('success','failed','reversed')
 AND e.webhook_count=(SELECT count(*) FROM partner_transfer_observations o WHERE o.reference=i.reference AND o.source='webhook')
 AND EXISTS(SELECT 1 FROM partner_transfer_observations w WHERE w.reference=i.reference AND w.source='webhook' AND w.event='transfer.'||json_extract(e.transfer_json,'$.status') AND json_extract(w.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status'))
 AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations o WHERE o.reference=i.reference AND (
 o.source NOT IN ('initiate','verify','webhook') OR json_type(o.transfer_json) IS NOT 'object'
 OR json_extract(o.transfer_json,'$.reference') IS NOT i.reference OR json_extract(o.transfer_json,'$.mode') IS NOT i.mode
 OR json_extract(o.transfer_json,'$.amount') IS NOT i.amount_cents OR json_extract(o.transfer_json,'$.currency') IS NOT 'ZAR'
 OR json_extract(o.transfer_json,'$.recipientId') IS NOT json_extract(i.source_json,'$.recipient.id')
 OR json_extract(o.transfer_json,'$.integration') IS NOT json_extract(i.source_json,'$.recipient.integration')
 OR json_extract(o.transfer_json,'$.id') IS NULL OR json_extract(o.transfer_json,'$.code') IS NULL
 OR json_extract(o.transfer_json,'$.id') IS NOT json_extract(e.transfer_json,'$.id') OR json_extract(o.transfer_json,'$.code') IS NOT json_extract(e.transfer_json,'$.code')
 OR (o.source='webhook' AND (o.event NOT IN ('transfer.success','transfer.failed','transfer.reversed') OR o.event IS NOT 'transfer.'||json_extract(o.transfer_json,'$.status')))
 OR json_extract(o.transfer_json,'$.status') NOT IN ('pending','otp','received',json_extract(e.transfer_json,'$.status'),CASE json_extract(e.transfer_json,'$.status') WHEN 'reversed' THEN 'success' ELSE json_extract(e.transfer_json,'$.status') END)
 OR (json_extract(o.transfer_json,'$.status') IS NOT json_extract(e.transfer_json,'$.status') AND EXISTS(SELECT 1 FROM partner_transfer_observations terminal WHERE terminal.reference=i.reference AND terminal.rowid<o.rowid AND json_extract(terminal.transfer_json,'$.status')=json_extract(e.transfer_json,'$.status')))
 ));
--> statement-breakpoint
CREATE VIEW partner_recovery_terminal AS SELECT * FROM partner_payment_final_evidence WHERE disposition IN ('failed','reversed');
--> statement-breakpoint
CREATE VIEW partner_recovery_chain_holds AS
 WITH RECURSIVE edges AS (SELECT reference,predecessor,approval_id FROM partner_recovery_replacements UNION ALL SELECT reference,predecessor,NULL AS approval_id FROM payment_unsent_replacements WHERE kind='partner'), chain(reference,predecessor,approval_id) AS (
 SELECT reference,predecessor,approval_id FROM edges
 UNION ALL SELECT c.reference,r.predecessor,r.approval_id FROM chain c JOIN edges r ON r.reference=c.predecessor
 ) SELECT c.reference FROM chain c JOIN partner_recovery_approvals a ON a.id=c.approval_id JOIN partner_recovery_proposals p ON p.id=a.proposal_id
 WHERE NOT EXISTS(SELECT 1 FROM partner_recovery_terminal t WHERE t.reference=c.predecessor AND t.disposition=p.disposition)
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=p.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM partner_payment_instructions WHERE reference=c.predecessor) AND g.role='operations_controller' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'))
 OR NOT (EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=a.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=(SELECT amount_cents FROM partner_payment_instructions WHERE reference=c.predecessor) AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active'));
--> statement-breakpoint
CREATE VIEW payment_final_evidence AS SELECT 'employee' AS kind,t.* FROM employee_payment_final_evidence t UNION ALL SELECT 'partner' AS kind,t.* FROM partner_payment_final_evidence t;
--> statement-breakpoint
CREATE VIEW payment_recovery_chain_holds AS SELECT 'employee' AS kind,h.* FROM employee_recovery_chain_holds h UNION ALL SELECT 'partner' AS kind,h.* FROM partner_recovery_chain_holds h;
--> statement-breakpoint
CREATE VIEW payment_live_reconciliation_reviewable AS SELECT r.*,i.amount_cents,i.source_json,i.prepared_by,i.prepared_user FROM payment_live_reconciliation_reviews r JOIN payment_instruction_records i ON i.kind=r.kind AND i.reference=r.reference AND i.source_hash=r.source_hash AND i.mode='live' JOIN payment_final_evidence t ON t.kind=r.kind AND t.reference=r.reference AND t.evidence_id=r.evidence_id AND t.disposition=r.disposition WHERE r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=r.operator_id AND a.environment='production' AND a.integrity_state='production_verified' AND a.status='active' AND a.approval_limit_cents>=i.amount_cents AND g.role='finance_approver' AND g.environment='production' AND g.integrity_state='production_verified' AND g.status='active');
--> statement-breakpoint
CREATE VIEW employee_payment_financial_state AS SELECT i.reference,
 CASE WHEN i.mode='test' THEN 'not_paid'
 WHEN NOT EXISTS(SELECT 1 FROM employee_payment_commands c WHERE c.reference=i.reference AND c.action='dispatch_live') THEN 'not_paid'
 WHEN (SELECT e.id FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.reversed') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'reversed'
 WHEN (SELECT e.id FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM employee_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM employee_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.success') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'paid'
 ELSE 'held' END AS financial_state,
 (SELECT count(*) FROM payment_live_reconciliation_decisions d WHERE d.kind='employee' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AS paid_receipts FROM employee_payment_instructions i;
--> statement-breakpoint
CREATE VIEW partner_payment_financial_state AS SELECT i.reference,
 CASE WHEN i.mode='test' THEN 'not_paid'
 WHEN NOT EXISTS(SELECT 1 FROM partner_payment_commands c WHERE c.reference=i.reference AND c.action='dispatch_live') THEN 'not_paid'
 WHEN (SELECT e.id FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='reversed') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.reversed') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'reversed'
 WHEN (SELECT e.id FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM partner_transfer_observations o WHERE o.reference=i.reference AND o.rowid>(SELECT e.rowid FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AND (o.transfer_json IS NOT (SELECT e.transfer_json FROM partner_transfer_observations e JOIN payment_live_reconciliation_reviews r ON r.evidence_id=e.id JOIN payment_live_reconciliation_decisions d ON d.review_id=r.id WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') OR o.source='operations' OR (o.source='webhook' AND o.event!='transfer.success') OR (o.source='verify' AND o.event!='transfer.verify'))) THEN 'paid'
 ELSE 'held' END AS financial_state,
 (SELECT count(*) FROM payment_live_reconciliation_decisions d WHERE d.kind='partner' AND d.reference=i.reference AND d.decision='approved' AND d.disposition='success') AS paid_receipts FROM partner_payment_instructions i;
--> statement-breakpoint
CREATE VIEW document_employee_payment_states AS SELECT i.payroll_item_id AS source_id,i.reference,i.mode,i.status,i.active_key,f.financial_state,f.paid_receipts,
 CASE WHEN i.mode='test' THEN 'unpaid' WHEN EXISTS(SELECT 1 FROM employee_recovery_chain_holds WHERE reference=i.reference) THEN 'held' WHEN f.financial_state='paid' THEN 'paid' WHEN f.financial_state='reversed' THEN 'reversed' WHEN f.financial_state='held' THEN 'held' WHEN i.status IN('prepared','approved') THEN 'pending' ELSE 'unpaid' END AS state
 FROM employee_payment_instructions i JOIN employee_payment_financial_state f ON f.reference=i.reference;
--> statement-breakpoint
CREATE VIEW document_partner_payment_states AS SELECT i.payable_id AS source_id,i.reference,i.mode,i.status,i.active_key,f.financial_state,f.paid_receipts,
 CASE WHEN i.mode='test' THEN 'unpaid' WHEN EXISTS(SELECT 1 FROM partner_recovery_chain_holds WHERE reference=i.reference) THEN 'held' WHEN f.financial_state='paid' THEN 'paid' WHEN f.financial_state='reversed' THEN 'reversed' WHEN f.financial_state='held' THEN 'held' WHEN i.status IN('prepared','approved') THEN 'pending' ELSE 'unpaid' END AS state
 FROM partner_payment_instructions i JOIN partner_payment_financial_state f ON f.reference=i.reference;
--> statement-breakpoint
CREATE VIEW current_production_passport_deliveries AS
 SELECT d.* FROM production_passport_deliveries d JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=d.officer_id AND l.owner_user_id=d.owner_user_id AND l.case_id=d.applicant_id AND l.case_version=d.applicant_version
 JOIN signup_cases c ON c.kind='officer' AND c.source_id=d.applicant_id AND c.owner_user_id=d.owner_user_id AND c.version=d.applicant_version AND c.status='reviewed'
 WHERE julianday(d.expires_at)>julianday('now');
--> statement-breakpoint
CREATE VIEW credit_note_sources AS SELECT i.id AS invoice_id,i.booking_id,i.client_id,i.total_cents,i.subtotal_cents,i.tax_cents,v.recipient_user,v.source_json FROM client_invoices i JOIN finance_document_versions v ON v.id=(SELECT x.id FROM finance_document_versions x JOIN finance_document_issues n ON n.document_id=x.id WHERE x.kind='invoice' AND x.source_id=i.id ORDER BY x.version LIMIT 1) WHERE i.document_type='invoice' AND i.environment='production' AND i.integrity_state='production_verified';
--> statement-breakpoint
CREATE VIEW credit_note_balances AS SELECT s.*,coalesce((SELECT sum(c.direction*(c.net_cents+c.tax_cents)) FROM credit_notes c JOIN credit_note_issues n ON n.credit_id=c.id WHERE c.invoice_id=s.invoice_id),0) AS credited_cents FROM credit_note_sources s;
--> statement-breakpoint
CREATE VIEW booking_refund_sources AS SELECT r.reference,r.order_id,r.mode,r.amount_minor,r.provider_id,r.applicant_id,
 json_object('reference',r.reference,'providerId',r.provider_id,'mode',r.mode,'amountMinor',r.amount_minor,'sourceHash',r.source_hash,'revision',r.revision,'state',r.state,
 'bookingStatus',b.status,'fundingStatus',b.funding_status,
 'holds',json((SELECT json_group_array(json_object('id',id,'hash',payload_hash)) FROM (SELECT * FROM booking_collection_recoveries WHERE reference=r.reference ORDER BY rowid))),
 'funding',json((SELECT json_group_array(json_object('id',id,'version',version,'status',status,'amount',cleared_amount_cents)) FROM (SELECT * FROM booking_funding_reconciliations WHERE booking_id=r.order_id ORDER BY id))),
 'payroll',json((SELECT json_group_array(json_object('id',id,'run',payroll_run_id,'status',status,'gross',gross_wage_cents,'net',net_pay_cents,'updated',updated_at)) FROM (SELECT * FROM payroll_items WHERE officer_id IN(SELECT officer_id FROM shifts WHERE booking_id=r.order_id) ORDER BY id))),
 'payrollRuns',json((SELECT json_group_array(json_object('id',id,'status',status,'version',version,'net',net_pay_cents)) FROM (SELECT * FROM payroll_runs WHERE id IN(SELECT payroll_run_id FROM payroll_items WHERE officer_id IN(SELECT officer_id FROM shifts WHERE booking_id=r.order_id)) ORDER BY id))),
 'partnerLiabilities',json((SELECT json_group_array(json_object('id',id,'status',status,'amount',amount_cents,'updated',updated_at)) FROM (SELECT * FROM partner_payables WHERE timesheet_id IN(SELECT id FROM shift_timesheets WHERE booking_id=r.order_id) ORDER BY id))),
 'timesheets',json((SELECT json_group_array(json_object('id',id,'evidence',evidence_hash,'status',operations_status,'payable',payable_minutes,'active',active_key)) FROM (SELECT * FROM shift_timesheets WHERE booking_id=r.order_id ORDER BY id))),
 'shifts',json((SELECT json_group_array(json_object('id',id,'status',status,'in',check_in_at,'out',check_out_at,'signoff',client_signoff_status,'earnings',earnings_cents)) FROM (SELECT * FROM shifts WHERE booking_id=r.order_id ORDER BY id)))) AS source_json
 FROM booking_collection_requests r JOIN bookings b ON b.id=r.order_id;
--> statement-breakpoint
CREATE VIEW booking_refund_authorized AS SELECT c.* FROM booking_refund_cases c JOIN booking_refund_sources s ON s.reference=c.reference JOIN booking_refund_decisions d ON d.case_id=c.id AND d.decision='approved'
 WHERE c.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND json_extract(c.payload_json,'$.source')=s.source_json AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=c.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND c.user_id<>s.applicant_id AND EXISTS(SELECT 1 FROM operator_accounts a JOIN operator_role_assignments g ON g.operator_id=a.id WHERE a.id=d.operator_id AND a.status='active' AND a.environment='production' AND a.integrity_state='production_verified' AND a.approval_limit_cents>=s.amount_minor AND g.role='funding_reconciler' AND g.status='active' AND g.environment='production' AND g.integrity_state='production_verified') AND d.user_id<>s.applicant_id;
--> statement-breakpoint
CREATE VIEW booking_refund_final_evidence AS SELECT o.*,c.reference,c.operator_id AS maker_operator,c.user_id AS maker_user,
 s.mode,json_extract(c.payload_json,'$.amountMinor') AS amount_minor,json_extract(o.evidence_json,'$.id') AS provider_refund_id,(SELECT e.signed_event_id FROM booking_refund_matching_events e WHERE e.observation_id=o.id ORDER BY e.event_order LIMIT 1) AS signed_event_id,(SELECT e.signed_event_hash FROM booking_refund_matching_events e WHERE e.observation_id=o.id ORDER BY e.event_order LIMIT 1) AS signed_event_hash
 FROM booking_refund_observations o JOIN booking_refund_cases c ON c.id=o.case_id JOIN booking_refund_sources s ON s.reference=c.reference JOIN booking_refund_claims k ON k.case_id=c.id
 WHERE (SELECT count(*) FROM booking_refund_observations WHERE case_id=c.id)<=500 AND o.source='verify' AND o.rowid=(SELECT max(rowid) FROM booking_refund_observations WHERE case_id=c.id)
 AND o.created_at>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-5 minutes') AND o.created_at<=strftime('%Y-%m-%dT%H:%M:%fZ','now','+1 seconds')
 AND o.hold_watermark=(SELECT count(*) FROM booking_collection_recoveries WHERE reference=c.reference)
 AND json_extract(o.evidence_json,'$.status')='processed' AND json_extract(o.evidence_json,'$.fullyDeducted')=1 AND json_extract(o.evidence_json,'$.deductedAmount')=json_extract(c.payload_json,'$.amountMinor')
 AND json_extract(o.evidence_json,'$.transactionId')=s.provider_id AND json_extract(o.evidence_json,'$.mode')=s.mode AND json_extract(o.evidence_json,'$.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(o.evidence_json,'$.currency')='ZAR'
 AND (json_extract(o.evidence_json,'$.merchantNote')=c.id OR json_extract(c.payload_json,'$.externalRefundId')=json_extract(o.evidence_json,'$.id'))
 AND (SELECT count(*) FROM booking_refund_matching_events e WHERE e.observation_id=o.id)=1

 AND NOT EXISTS(SELECT 1 FROM booking_refund_observations old WHERE old.case_id=c.id AND (json_type(old.evidence_json)='null' OR json_extract(old.evidence_json,'$.id') IS NOT json_extract(o.evidence_json,'$.id') OR json_extract(old.evidence_json,'$.integrationId') IS NOT json_extract(o.evidence_json,'$.integrationId') OR json_extract(old.evidence_json,'$.transactionId') IS NOT s.provider_id OR json_extract(old.evidence_json,'$.amountMinor') IS NOT json_extract(c.payload_json,'$.amountMinor') OR json_extract(old.evidence_json,'$.mode') IS NOT s.mode OR json_extract(old.evidence_json,'$.currency') IS NOT 'ZAR' OR (json_extract(old.evidence_json,'$.merchantNote') IS NOT c.id AND json_extract(c.payload_json,'$.externalRefundId') IS NOT json_extract(o.evidence_json,'$.id')) OR json_extract(old.evidence_json,'$.status') NOT IN('pending','processing','processed')))
 AND NOT EXISTS(SELECT 1 FROM booking_collection_recoveries terminal JOIN booking_collection_recoveries later ON later.reference=terminal.reference AND later.rowid>terminal.rowid WHERE terminal.reference=c.reference AND terminal.source='webhook' AND terminal.event='refund.processed' AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=c.reference AND prev.rowid<=terminal.rowid)>k.hold_watermark AND later.source='webhook' AND later.event<>'refund.processed')
 AND NOT EXISTS(SELECT 1 FROM booking_refund_observations terminal JOIN booking_refund_observations later ON later.case_id=terminal.case_id AND later.rowid>terminal.rowid WHERE terminal.case_id=c.id AND json_extract(terminal.evidence_json,'$.status')='processed' AND json_extract(later.evidence_json,'$.status')<>'processed')
 AND NOT EXISTS(SELECT 1 FROM booking_collection_recoveries h WHERE h.reference=c.reference AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=c.reference AND prev.rowid<=h.rowid)>k.hold_watermark AND h.source='webhook' AND NOT (h.event IN('refund.pending','refund.processing','refund.processed') AND coalesce(
 (json_extract(h.detail,'$.refund.id')=json_extract(o.evidence_json,'$.id') AND json_extract(h.detail,'$.refund.transactionId')=s.provider_id AND json_extract(h.detail,'$.refund.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refund.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refund.mode')=s.mode AND json_extract(h.detail,'$.refund.currency')='ZAR' AND h.event='refund.'||json_extract(h.detail,'$.refund.status')) OR
 (json_extract(h.detail,'$.refundEvent.transactionReference')=s.reference AND json_extract(h.detail,'$.refundEvent.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refundEvent.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refundEvent.mode')=s.mode AND h.event='refund.'||json_extract(h.detail,'$.refundEvent.status')),0)));
--> statement-breakpoint
CREATE VIEW booking_refund_accounting AS SELECT s.reference,s.order_id,s.mode,s.amount_minor,
 coalesce((SELECT sum(r.bank_amount_minor) FROM booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' WHERE c.reference=s.reference),0) AS reconciled_minor,
 CASE WHEN EXISTS(SELECT 1 FROM booking_refund_claims k WHERE k.reference=s.reference AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' WHERE r.case_id=k.case_id))
 OR EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' JOIN booking_refund_observations o ON o.id=r.observation_id JOIN booking_refund_observations later ON later.case_id=c.id AND later.rowid>o.rowid WHERE c.reference=s.reference AND later.evidence_json<>o.evidence_json)
 OR EXISTS(SELECT 1 FROM booking_collection_recoveries h WHERE h.reference=s.reference AND (h.source='webhook' OR h.event<>'refund_investigation') AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts r JOIN booking_refund_cases c ON c.id=r.case_id JOIN booking_refund_receipt_decisions d ON d.receipt_id=r.id AND d.decision='approved' JOIN booking_refund_observations o ON o.id=r.observation_id WHERE c.reference=s.reference AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=s.reference AND prev.rowid<=h.rowid)<=o.hold_watermark)) THEN 1 ELSE 0 END AS currently_held
 FROM booking_refund_sources s;
--> statement-breakpoint
CREATE VIEW booking_refund_state AS SELECT a.*,CASE WHEN currently_held=1 THEN CASE WHEN reconciled_minor>0 THEN 'reconciled_history_currently_held' ELSE 'refund_claimed_held' END WHEN reconciled_minor=0 THEN 'investigation_held' WHEN mode='test' THEN 'test_refund_confirmed' WHEN reconciled_minor=amount_minor THEN 'refunded_funding_held' ELSE 'partially_refunded_funding_held' END AS state,0 AS funding_available,0 AS liabilities_cancelled FROM booking_refund_accounting a WHERE EXISTS(SELECT 1 FROM booking_collection_recoveries WHERE reference=a.reference);
--> statement-breakpoint
CREATE VIEW document_invoice_payment_states AS SELECT i.id AS source_id,r.reference,r.mode,r.state AS status,r.reference AS active_key,
 CASE WHEN r.mode='live' AND EXISTS(SELECT 1 FROM booking_refund_accounting a WHERE a.reference=r.reference AND a.reconciled_minor=a.amount_minor AND a.currently_held=0) THEN 'reversed' WHEN EXISTS(SELECT 1 FROM booking_collection_recoveries WHERE reference=r.reference) OR EXISTS(SELECT 1 FROM booking_funding_reconciliations WHERE provider_reference=r.reference AND status='held') THEN 'held'
 WHEN r.mode='live' AND EXISTS(SELECT 1 FROM booking_funding_reconciliations f JOIN booking_settlement_reviews s ON f.evidence_reference='settlement-review:'||s.id JOIN booking_settlement_decisions d ON d.review_id=s.id AND d.decision='cleared_live' WHERE f.provider_reference=r.reference AND f.booking_id=i.booking_id AND f.status='cleared_reconciled' AND f.cleared_amount_cents=i.total_cents) THEN 'paid'
 WHEN r.mode='live' AND r.state NOT IN('prepared','approved') THEN 'pending' ELSE 'unpaid' END AS state
 FROM client_invoices i JOIN booking_collection_requests r ON r.order_id=i.booking_id;
--> statement-breakpoint
CREATE VIEW booking_refund_matching_events AS SELECT o.id AS observation_id,h.id AS signed_event_id,h.payload_hash AS signed_event_hash,h.rowid AS event_order
 FROM booking_refund_observations o JOIN booking_refund_cases c ON c.id=o.case_id JOIN booking_refund_sources s ON s.reference=c.reference JOIN booking_refund_claims k ON k.case_id=c.id JOIN booking_collection_recoveries h ON h.reference=c.reference
 WHERE h.reference=c.reference AND h.source='webhook' AND h.event='refund.processed' AND (SELECT count(*) FROM booking_collection_recoveries prev WHERE prev.reference=c.reference AND prev.rowid<=h.rowid)>k.hold_watermark AND (
 (json_extract(h.detail,'$.refund.id')=json_extract(o.evidence_json,'$.id') AND json_extract(h.detail,'$.refund.transactionId')=s.provider_id AND json_extract(h.detail,'$.refund.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refund.mode')=s.mode AND json_extract(h.detail,'$.refund.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refund.currency')='ZAR' AND (json_extract(h.detail,'$.refund.merchantNote')=c.id OR json_extract(c.payload_json,'$.externalRefundId')=json_extract(o.evidence_json,'$.id')) AND json_extract(h.detail,'$.refund.status')='processed')
 OR (json_extract(h.detail,'$.refundEvent.transactionReference')=s.reference AND json_extract(h.detail,'$.refundEvent.integrationId')=json_extract(o.evidence_json,'$.integrationId') AND json_extract(h.detail,'$.refundEvent.mode')=s.mode AND json_extract(h.detail,'$.refundEvent.amountMinor')=json_extract(c.payload_json,'$.amountMinor') AND json_extract(h.detail,'$.refundEvent.status')='processed')) AND NOT EXISTS(SELECT 1 FROM booking_refund_receipts used JOIN booking_refund_receipt_decisions decision ON decision.receipt_id=used.id AND decision.decision='approved' WHERE json_extract(used.payload_json,'$.signedEventId')=h.id AND used.case_id<>c.id);
--> statement-breakpoint
CREATE VIEW payroll_correction_sources AS SELECT s.source_id AS item_id,s.party_id AS officer_id,s.recipient_user,i.gross_wage_cents AS review_amount_cents,r.id AS run_id,r.export_reference,s.source_json,f.financial_json FROM finance_document_sources s JOIN payroll_items i ON i.id=s.source_id JOIN payroll_runs r ON r.id=i.payroll_run_id JOIN finance_document_financial_snapshots f ON f.kind=s.kind AND f.source_id=s.source_id WHERE s.kind='payslip' AND r.status='exported' AND r.export_reference IS NOT NULL;
--> statement-breakpoint
CREATE VIEW finance_current_members AS SELECT m.* FROM finance_members m WHERE version=(SELECT max(version) FROM finance_members p WHERE p.workspace_id=m.workspace_id AND p.user_id=m.user_id);
--> statement-breakpoint
CREATE VIEW finance_current_records AS SELECT r.* FROM finance_records r WHERE version=(SELECT max(version) FROM finance_records p WHERE p.workspace_id=r.workspace_id AND p.id=r.id);
--> statement-breakpoint
CREATE VIEW finance_balances AS SELECT j.workspace_id,json_extract(e.value,'$.account') AS account,sum(json_extract(e.value,'$.delta')) AS balance FROM finance_journals j,json_each(j.entries_json) e GROUP BY j.workspace_id,json_extract(e.value,'$.account');
--> statement-breakpoint
CREATE TRIGGER operational_booking_delivery AFTER INSERT ON production_order_setups
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('booking:'||NEW.id,'booking_email',NEW.id,'production',NEW.prepared_at,NEW.prepared_at,NEW.prepared_at);
END;
--> statement-breakpoint
CREATE TRIGGER operational_contract_delivery AFTER INSERT ON production_signing_envelopes
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('contract:'||NEW.id,'contract_email',NEW.id,'production',NEW.issued_at,NEW.issued_at,NEW.issued_at);
END;
--> statement-breakpoint
CREATE TRIGGER operational_contract_cancel AFTER INSERT ON production_envelope_cancellations
BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='agreement_cancelled',updated_at=NEW.cancelled_at
 WHERE kind='contract_email' AND source_id=NEW.envelope_id AND state IN ('queued','blocked','retry_wait');
END;
--> statement-breakpoint
CREATE TRIGGER operational_document_withdraw AFTER INSERT ON signing_document_withdrawals
BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='document_withdrawn',updated_at=NEW.withdrawn_at
 WHERE kind='contract_email' AND state IN ('queued','blocked','retry_wait')
 AND source_id IN (SELECT id FROM production_signing_envelopes WHERE document_id=NEW.document_id);
END;
--> statement-breakpoint
CREATE TRIGGER operational_signup_withdraw AFTER UPDATE ON signup_cases WHEN NEW.status='withdrawn'
BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='intake_withdrawn',updated_at=NEW.updated_at
 WHERE state IN ('queued','blocked','retry_wait') AND
 ((NEW.kind='client' AND kind IN ('enquiry_crm','enquiry_email') AND source_id=NEW.source_id)
 OR (kind='contract_email' AND source_id IN (SELECT id FROM production_signing_envelopes WHERE case_id=NEW.source_id AND case_kind=NEW.kind)));
END;
--> statement-breakpoint
CREATE VIEW client_quote_sources AS
SELECT b.id AS order_id,b.client_id,l.owner_user_id,b.contracting_entity_id AS entity_id,l.case_version,b.agreement_version AS order_version,
 json_patch(json_patch(json_object('orderId',b.id,'orderVersion',b.agreement_version,'clientId',c.id,'clientName',c.organisation_name,
 'contactName',c.contact_name,'contactEmail',c.contact_email,'ownerUserId',l.owner_user_id,'caseVersion',l.case_version,
 'contractingEntityId',b.contracting_entity_id,'siteName',b.site_name,'siteArea',b.site_area,'address',s.address_label,
 'postName',b.post_name,'instructions',post.post_orders_content
 ),json_object('serviceType',b.service_type,'purposeLabel',b.purpose_label,'purposeCode',b.purpose_code,
 'startDate',b.start_date,'endDate',b.end_date,'shiftStart',b.shift_start,'shiftEnd',b.shift_end,
 'headcount',b.headcount,'rosterPattern',b.roster_pattern,'shiftCount',b.shift_count,'serviceDayCount',b.service_day_count,
 'contractMonths',b.contract_months,'engagementModel',b.engagement_model,'riskBand',b.risk_band
 )),json_object('minimumGrade',b.minimum_grade,'specialistServiceCode',b.specialist_service_code,'declaredSiteRisk',json_extract(p.request_json,'$.quoteRequest.riskInput'),'specialistConfiguration',b.specialist_configuration,'subtotalCents',b.quote_subtotal_cents,'vatCents',b.vat_cents,
 'totalCents',b.client_price_cents,'currency','ZAR','pricingVersion',b.pricing_version,
 'fundingModel',b.funding_model,'creditTermsDays',b.credit_terms_days,'releaseCadence',b.release_cadence)) AS source_json
FROM bookings b JOIN production_order_setups p ON p.id=b.id
JOIN clients c ON c.id=b.client_id
JOIN production_entity_links l ON l.kind='client' AND l.entity_id=c.id AND l.case_version=p.case_version
JOIN signup_cases a ON a.kind='client' AND a.source_id=l.case_id AND a.version=l.case_version AND a.owner_user_id=l.owner_user_id AND a.status='reviewed'
JOIN operational_sites s ON s.booking_id=b.id AND s.id='SITE-'||b.id
JOIN site_posts post ON post.booking_id=b.id AND post.id='POST-'||b.id
WHERE b.environment='production' AND b.integrity_state='production_verified' AND b.status NOT IN ('cancelled','completed')
AND c.environment='production' AND c.integrity_state='production_verified' AND c.approval_status='approved';
--> statement-breakpoint
CREATE TRIGGER client_quote_queue AFTER INSERT ON client_quote_offers BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='quote_superseded',updated_at=NEW.issued_at
 WHERE kind='contract_email' AND source_id IN(SELECT id FROM client_quote_offers WHERE order_id=NEW.order_id AND id!=NEW.id) AND state IN('queued','blocked','retry_wait');
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('quote:'||NEW.id,'contract_email',NEW.id,'production',NEW.issued_at,NEW.issued_at,NEW.issued_at);
END;
--> statement-breakpoint
CREATE TRIGGER client_quote_cancel_delivery AFTER INSERT ON client_quote_cancellations BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='quote_cancelled',updated_at=NEW.created_at
 WHERE kind='contract_email' AND source_id=NEW.quote_id AND state IN('queued','blocked','retry_wait');
END;
--> statement-breakpoint
CREATE TRIGGER client_terms_cancel_delivery AFTER INSERT ON client_terms_withdrawals BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='terms_withdrawn',updated_at=NEW.created_at
 WHERE kind='contract_email' AND source_id IN(SELECT id FROM client_quote_offers WHERE terms_id=NEW.terms_id) AND state IN('queued','blocked','retry_wait');
END;
--> statement-breakpoint
CREATE VIEW `specialist_pricing_validation_v33` AS
SELECT booking.`id`,
CASE WHEN
  booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat')
  AND booking.`service_day_count` >= 1
  AND booking.`headcount` >= 1
  AND booking.`shift_count` = booking.`service_day_count` * booking.`headcount`
  AND booking.`officer_total_cents` > 0
  AND booking.`quote_subtotal_cents` > 0
  AND booking.`vat_rate_basis_points` = CASE WHEN booking.`pricing_version` = 'LOKD-SPECIALIST-2026.09-v2-no-vat' THEN 0 ELSE 1500 END
  AND booking.`vat_cents` = CAST((booking.`quote_subtotal_cents` * booking.`vat_rate_basis_points` + 5000) / 10000 AS INTEGER)
  AND booking.`client_price_cents` = booking.`quote_subtotal_cents` + booking.`vat_cents`
  AND booking.`cost_floor_cents` > 0
  AND booking.`margin_cents` = booking.`quote_subtotal_cents` - booking.`cost_floor_cents`
  AND booking.`gross_platform_contribution_cents` = booking.`quote_subtotal_cents` - booking.`officer_total_cents`
  AND booking.`margin_basis_points` = CAST(booking.`margin_cents` * 10000 / booking.`quote_subtotal_cents` AS INTEGER)
  AND booking.`margin_basis_points` >= booking.`minimum_margin_basis_points`
  AND booking.`minimum_margin_basis_points` = CASE booking.`specialist_service_code`
    WHEN 'standard_unarmed' THEN 2500 WHEN 'armed_static' THEN 3000 WHEN 'armed_movement' THEN 3200
    WHEN 'vip_unarmed' THEN 3500 WHEN 'vip_armed' THEN 3700 WHEN 'vip_protective_driver' THEN 3600
    WHEN 'vip_team' THEN 3800 ELSE -1 END
  AND booking.`service_type` = CASE booking.`specialist_service_code`
    WHEN 'standard_unarmed' THEN 'Unarmed'
    WHEN 'armed_static' THEN 'Armed' WHEN 'armed_movement' THEN 'Armed'
    WHEN 'vip_unarmed' THEN 'VIP' WHEN 'vip_armed' THEN 'VIP'
    WHEN 'vip_protective_driver' THEN 'VIP' WHEN 'vip_team' THEN 'VIP' ELSE '' END
  AND json_valid(booking.`specialist_configuration`) = 1
  AND json_type(booking.`specialist_configuration`) = 'object'
  AND json_valid(booking.`pricing_breakdown`) = 1
  AND json_type(booking.`pricing_breakdown`) = 'object'
  AND CASE WHEN json_valid(booking.`specialist_configuration`) = 1 THEN
    json_type(booking.`specialist_configuration`,'$.serviceCode') = 'text'
    AND json_extract(booking.`specialist_configuration`,'$.serviceCode') = booking.`specialist_service_code`
    AND json_type(booking.`specialist_configuration`,'$.teamSize') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.teamSize') = booking.`headcount`
    AND json_type(booking.`specialist_configuration`,'$.travelKmPerServiceDay') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.travelKmPerServiceDay') BETWEEN 0 AND 1500
    AND json_type(booking.`specialist_configuration`,'$.planningHours') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.planningHours') BETWEEN
      CASE booking.`specialist_service_code` WHEN 'standard_unarmed' THEN 0 WHEN 'armed_static' THEN 1
        WHEN 'armed_movement' THEN 2 WHEN 'vip_unarmed' THEN 2 WHEN 'vip_armed' THEN 3
        WHEN 'vip_protective_driver' THEN 2 WHEN 'vip_team' THEN 4 ELSE 999 END AND 80
    AND json_type(booking.`specialist_configuration`,'$.overnightDays') = 'integer'
    AND json_extract(booking.`specialist_configuration`,'$.overnightDays') BETWEEN 0 AND 60
    AND json_type(booking.`specialist_configuration`,'$.vehicleClass') = 'text'
    AND ((booking.`specialist_service_code` IN ('standard_unarmed','armed_static')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') = 'none')
      OR (booking.`specialist_service_code` IN ('armed_movement','vip_protective_driver')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('client_vehicle','standard_suv','armoured_partner'))
      OR (booking.`specialist_service_code` IN ('vip_unarmed','vip_armed','vip_team')
          AND json_extract(booking.`specialist_configuration`,'$.vehicleClass') IN ('none','client_vehicle','standard_suv','armoured_partner')))
    AND booking.`headcount` BETWEEN
      CASE booking.`specialist_service_code` WHEN 'vip_team' THEN 2 ELSE 1 END
      AND CASE booking.`specialist_service_code` WHEN 'standard_unarmed' THEN 6 WHEN 'armed_static' THEN 6
        WHEN 'armed_movement' THEN 4 WHEN 'vip_unarmed' THEN 4 WHEN 'vip_armed' THEN 4
        WHEN 'vip_protective_driver' THEN 2 WHEN 'vip_team' THEN 6 ELSE 0 END
    AND booking.`pricing_status` = CASE
      WHEN json_extract(booking.`specialist_configuration`,'$.vehicleClass') = 'armoured_partner'
        THEN 'partner_review_required' ELSE 'authoritative' END
    AND booking.`cost_floor_cents` = booking.`officer_total_cents`
      + CAST((booking.`officer_total_cents` * 1150 + 9999) / 10000 AS INTEGER)
      + booking.`shift_count` * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 12000 WHEN 'armed_static' THEN 55000 WHEN 'armed_movement' THEN 75000
        WHEN 'vip_unarmed' THEN 70000 WHEN 'vip_armed' THEN 120000
        WHEN 'vip_protective_driver' THEN 90000 WHEN 'vip_team' THEN 80000 ELSE -999999999 END
      + booking.`service_day_count` * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 14000 WHEN 'armed_static' THEN 55000 WHEN 'armed_movement' THEN 85000
        WHEN 'vip_unarmed' THEN 120000 WHEN 'vip_armed' THEN 150000
        WHEN 'vip_protective_driver' THEN 130000 WHEN 'vip_team' THEN 180000 ELSE -999999999 END
      + json_extract(booking.`specialist_configuration`,'$.planningHours') * CASE booking.`specialist_service_code`
        WHEN 'standard_unarmed' THEN 0 WHEN 'armed_static' THEN 65000 WHEN 'armed_movement' THEN 75000
        ELSE 95000 END
      + json_extract(booking.`specialist_configuration`,'$.travelKmPerServiceDay') * booking.`service_day_count` * 900
      + booking.`service_day_count` * CASE json_extract(booking.`specialist_configuration`,'$.vehicleClass')
        WHEN 'standard_suv' THEN 220000 WHEN 'armoured_partner' THEN 1500000 ELSE 0 END
      + json_extract(booking.`specialist_configuration`,'$.overnightDays') * booking.`headcount` * 180000
    ELSE 0 END
  AND CASE WHEN json_valid(booking.`pricing_breakdown`) = 1 THEN
    json_type(booking.`pricing_breakdown`,'$.baseClientCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.calendarPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.dispatchPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.riskPremiumCents') = 'integer'
    AND json_type(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') = 'integer'
    AND json_extract(booking.`pricing_breakdown`,'$.baseClientCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.calendarPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.dispatchPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.riskPremiumCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') >= 0
    AND json_extract(booking.`pricing_breakdown`,'$.baseClientCents')
      + json_extract(booking.`pricing_breakdown`,'$.calendarPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.dispatchPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.riskPremiumCents')
      + json_extract(booking.`pricing_breakdown`,'$.marginFloorAdjustmentCents') = booking.`quote_subtotal_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.subtotalCents') = booking.`quote_subtotal_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.vatCents') = booking.`vat_cents`
    AND json_extract(booking.`pricing_breakdown`,'$.payrollBurdenCents')
      + json_extract(booking.`pricing_breakdown`,'$.readinessAndEquipmentCents')
      + json_extract(booking.`pricing_breakdown`,'$.commandAndSupervisionCents')
      + json_extract(booking.`pricing_breakdown`,'$.planningCents')
      + json_extract(booking.`pricing_breakdown`,'$.travelCents')
      + json_extract(booking.`pricing_breakdown`,'$.vehicleAndPartnerCents')
      + json_extract(booking.`pricing_breakdown`,'$.overnightCents')
      + booking.`officer_total_cents` = booking.`cost_floor_cents`
    ELSE 0 END
THEN 1 ELSE 0 END AS `valid`
FROM `bookings` booking
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat');
--> statement-breakpoint
CREATE VIEW `client_quote_offer_issues` AS
SELECT `id`, `order_id`, `owner_user_id`, `terms_id`, `source_json`, `source_hash`, `offer_hash`,
 `issued_by`, `issued_at`, `expires_at`, `sequence`, `case_version`, `public_number`, NULL AS `month_key`
FROM `client_quote_offers`;
--> statement-breakpoint
CREATE TRIGGER client_quote_offer_issue INSTEAD OF INSERT ON client_quote_offer_issues
BEGIN
 INSERT INTO lokd_quote_month_counters(month_key, last_sequence) VALUES(NEW.month_key, 1)
 ON CONFLICT(month_key) DO UPDATE SET last_sequence = last_sequence + 1
 WHERE lokd_quote_month_counters.last_sequence < 99;
 SELECT RAISE(ABORT, 'quote_month_sequence_exhausted') WHERE changes() = 0;
 INSERT INTO client_quote_offers(id, order_id, owner_user_id, terms_id, source_json, source_hash, offer_hash, issued_by, issued_at, expires_at, sequence, case_version, public_number)
 SELECT NEW.id, NEW.order_id, NEW.owner_user_id, NEW.terms_id, NEW.source_json, NEW.source_hash, NEW.offer_hash, NEW.issued_by, NEW.issued_at, NEW.expires_at, NEW.sequence, NEW.case_version,
  'LOKD' || NEW.month_key || printf('%02d', c.last_sequence)
 FROM lokd_quote_month_counters c
 WHERE c.month_key = NEW.month_key;
END;
--> statement-breakpoint
CREATE VIEW `specialist_booking_control_validation_v33` AS
SELECT booking.`id`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `operational_sites` site
    JOIN `site_posts` post ON post.`site_id` = site.`id` AND post.`booking_id` = booking.`id`
    JOIN `site_risk_assessments` risk ON risk.`site_id` = site.`id`
    JOIN `post_order_approvals` orders ON orders.`post_id` = post.`id`
    WHERE site.`booking_id` = booking.`id` AND site.`client_id` = booking.`client_id`
      AND site.`status` = 'active' AND post.`status` = 'active'
      AND site.`environment` = booking.`environment` AND site.`integrity_state` = booking.`integrity_state`
      AND post.`environment` = booking.`environment` AND post.`integrity_state` = booking.`integrity_state`
      AND risk.`environment` = booking.`environment` AND (risk.`integrity_state` = booking.`integrity_state` OR (booking.`environment`='production' AND risk.`integrity_state`='verified' AND EXISTS(SELECT 1 FROM production_evidence_reviews review WHERE review.kind='site' AND review.state='approved' AND risk.`id` = 'RISK-' || review.id AND json_extract(review.payload_json,'$.siteId')=site.id AND json_extract(review.payload_json,'$.postId')=post.id)))
      AND orders.`environment` = booking.`environment` AND (orders.`integrity_state` = booking.`integrity_state` OR (booking.`environment`='production' AND orders.`integrity_state`='verified' AND EXISTS(SELECT 1 FROM production_evidence_reviews review WHERE review.kind='site' AND review.state='approved' AND orders.`id` = 'POST-' || review.id AND json_extract(review.payload_json,'$.siteId')=site.id AND json_extract(review.payload_json,'$.postId')=post.id)))
      AND risk.`status` = 'approved' AND risk.`active_key` = site.`id`
      AND risk.`evidence_reference` IS NOT NULL AND length(trim(risk.`evidence_reference`)) >= 8
      AND risk.`approved_at` IS NOT NULL AND julianday(risk.`approved_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND risk.`valid_from` IS NOT NULL
      AND julianday(risk.`valid_from`) <= julianday((SELECT MIN(slot.`starts_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND risk.`expires_at` IS NOT NULL
      AND julianday(risk.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND orders.`status` = 'approved' AND orders.`active_key` = post.`id`
      AND orders.`post_orders_version` = post.`post_orders_version`
      AND orders.`evidence_reference` IS NOT NULL AND length(trim(orders.`evidence_reference`)) >= 8
      AND orders.`approved_at` IS NOT NULL AND julianday(orders.`approved_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND orders.`valid_from` IS NOT NULL
      AND julianday(orders.`valid_from`) <= julianday((SELECT MIN(slot.`starts_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND orders.`expires_at` IS NOT NULL
      AND julianday(orders.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
      AND EXISTS (SELECT 1 FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`)
  ) THEN 1 ELSE 0 END AS `assignment_plan_current`,
  1 AS `specialist_authority_current`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `booking_funding_reconciliations` funding
    WHERE funding.`booking_id` = booking.`id` AND funding.`active_key` = booking.`id`
      AND funding.`environment` = booking.`environment` AND funding.`integrity_state` = booking.`integrity_state`
      AND funding.`currency` = 'ZAR' AND funding.`status` = 'cleared_reconciled'
      AND funding.`expected_amount_cents` = booking.`client_price_cents`
      AND funding.`cleared_amount_cents` = booking.`client_price_cents`
      AND funding.`cleared_at` IS NOT NULL AND funding.`reconciled_at` IS NOT NULL
      AND funding.`evidence_reference` IS NOT NULL AND length(trim(funding.`evidence_reference`)) >= 8
      AND funding.`evidence_verified_at` IS NOT NULL
      AND julianday(funding.`evidence_verified_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND funding.`evidence_expires_at` IS NOT NULL
      AND julianday(funding.`evidence_expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
  ) THEN 1 ELSE 0 END AS `funding_current`
FROM `bookings` booking
WHERE booking.`pricing_version`  IN ('LOKD-SPECIALIST-2026.09-v1','LOKD-SPECIALIST-2026.09-v2-no-vat');
--> statement-breakpoint
CREATE VIEW finance_document_sources AS
 SELECT 'payslip' AS kind,i.id AS source_id,i.officer_id AS party_id,l.owner_user_id AS recipient_user,i.net_pay_cents AS amount_cents,
 json_object('itemId',i.id,'officerId',i.officer_id,'officerName',o.full_name,'employerId',r.employer_id,'employerName',e.legal_name,'runId',r.id,'periodStart',r.period_start,'periodEnd',r.period_end,'payDate',r.pay_date,'calendar',coalesce(json_extract(s.payload_json,'$.calendar'),'legacy UTC cutoff; SAST service dates'),'currency','ZAR','calculation',json(json_extract(j.value,'$.calculation')),'payrollHash',s.payload_hash,'sourceAllocations',json((SELECT json_group_array(json_object('timesheetId',timesheet_id,'version',timesheet_version,'minutes',payable_minutes,'grossCents',gross_wage_cents)) FROM (SELECT * FROM pay_item_sources WHERE payroll_item_id=i.id ORDER BY id)))) AS source_json
 FROM payroll_items i JOIN payroll_runs r ON r.id=i.payroll_run_id JOIN production_payroll_snapshots s ON s.run_id=r.id JOIN json_each(s.payload_json,'$.items') j ON json_extract(j.value,'$.id')=i.id JOIN officers o ON o.id=i.officer_id JOIN workforce_employers e ON e.id=r.employer_id JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=i.officer_id
 WHERE r.environment='production' AND i.environment='production' AND r.integrity_state='production_verified' AND i.integrity_state='production_verified' AND r.status IN('approved_for_export','exported')
 UNION ALL SELECT 'remittance',p.id,p.employer_id,json_extract(dest.payload_json,'$.representativeUserId'),p.amount_cents,
 json_object('payableId',p.id,'employerId',p.employer_id,'employerName',e.legal_name,'timesheetId',p.timesheet_id,'invoice',json(v.payload_json),'reviewHash',v.payload_hash,'currency','ZAR','amountCents',p.amount_cents,'serviceDate',json_extract(v.source_json,'$.serviceDate'))
 FROM partner_payables p JOIN production_partner_payable_reviews v ON p.id='PP-'||v.id JOIN production_partner_payable_decisions d ON d.review_id=v.id AND d.decision='approved' JOIN workforce_employers e ON e.id=p.employer_id JOIN partner_destination_reviews dest ON dest.id=(SELECT x.id FROM partner_destination_reviews x JOIN partner_destination_decisions xd ON xd.review_id=x.id AND xd.decision='verified_live' WHERE x.mode='live' AND x.employer_id=p.employer_id ORDER BY x.rowid DESC LIMIT 1)
 WHERE p.environment='production' AND p.integrity_state='production_verified'
 UNION ALL SELECT 'invoice',i.id,i.client_id,l.owner_user_id,i.total_cents,
 json_object('invoiceId',i.id,'bookingId',i.booking_id,'clientId',i.client_id,'issuer',json(i.issuer_snapshot),'client',json(i.client_snapshot),'periodStart',i.service_period_start,'periodEnd',i.service_period_end,'currency',i.currency,'subtotalCents',i.subtotal_cents,'taxCents',i.tax_cents,'totalCents',i.total_cents,'taxTreatment',i.tax_treatment,'taxEvidence',json(i.issue_reference),'pricingVersion',i.pricing_version,'dueDate',i.due_at,'lines',json((SELECT json_group_array(json_object('description',description,'quantity',quantity,'unitPriceCents',unit_price_cents,'netCents',net_cents,'taxCents',tax_cents,'grossCents',gross_cents)) FROM (SELECT * FROM client_invoice_lines WHERE invoice_id=i.id ORDER BY id))))
 FROM client_invoices i JOIN bookings b ON b.id=i.booking_id AND b.client_id=i.client_id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=i.client_id
 WHERE i.environment='production' AND i.integrity_state='production_verified' AND i.currency='ZAR' AND i.total_cents=b.client_price_cents AND i.tax_cents>=0 AND i.subtotal_cents+i.tax_cents=i.total_cents AND i.tax_treatment<>'pending_configuration' AND json_valid(i.issuer_snapshot) AND json_valid(i.client_snapshot)
 AND EXISTS(SELECT 1 FROM billing_profiles p WHERE p.id=i.issuer_billing_profile_id AND p.version=json_extract(i.issuer_snapshot,'$.version') AND p.active_key IS NOT NULL AND p.owner_id=b.contracting_entity_id AND p.environment='production' AND p.integrity_state='production_verified') AND EXISTS(SELECT 1 FROM billing_profiles p WHERE p.id=i.client_billing_profile_id AND p.version=json_extract(i.client_snapshot,'$.version') AND p.active_key IS NOT NULL AND p.owner_id=i.client_id AND p.environment='production' AND p.integrity_state='production_verified') AND i.pricing_version=b.pricing_version AND json_extract(i.issue_reference,'$.requestHash')=(SELECT request_hash FROM production_order_setups WHERE id=i.booking_id) AND i.tax_cents=b.vat_cents AND i.total_cents=(SELECT sum(gross_cents) FROM client_invoice_lines WHERE invoice_id=i.id);
--> statement-breakpoint
CREATE VIEW finance_document_payment_rows AS SELECT 'payslip' AS kind,source_id,reference,mode,status,active_key,state,paid_receipts FROM document_employee_payment_states WHERE mode='live' UNION ALL SELECT 'remittance',source_id,reference,mode,status,active_key,state,paid_receipts FROM document_partner_payment_states WHERE mode='live' UNION ALL SELECT 'invoice',source_id,reference,mode,status,active_key,state,CASE WHEN state='paid' THEN 1 ELSE 0 END FROM document_invoice_payment_states WHERE mode='live';
--> statement-breakpoint
CREATE VIEW finance_document_financial_snapshots AS SELECT s.kind,s.source_id,(SELECT json_group_array(json_object('reference',reference,'mode',mode,'status',status,'active',active_key IS NOT NULL,'state',state,'paidReceipts',paid_receipts)) FROM (SELECT * FROM finance_document_payment_rows p WHERE p.kind=s.kind AND p.source_id=s.source_id ORDER BY reference)) AS financial_json FROM finance_document_sources s;
--> statement-breakpoint
CREATE TRIGGER operations_intake_email AFTER INSERT ON signup_events WHEN NEW.kind='officer' AND NEW.action IN ('review','submit','correct') BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'intake:'||NEW.id,a.email_normalized,'LOKD Security — officer application update',
 'Your officer application has been updated. Sign in to your LOKD Officer account to read the decision and any information we need from you.'||char(10)||char(10)||'https://officers.lokd.co.za/officer'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM officer_applications a WHERE a.id=NEW.source_id AND a.integrity_state='user_submitted';
END;
--> statement-breakpoint
CREATE TRIGGER operations_identity_decision_email AFTER INSERT ON production_identity_decisions BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'identity-decision:'||NEW.outcome_id,a.email_normalized,'LOKD Security — identity review update',
 'Your identity review is complete. Open your Officer account to read the decision and any next steps.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/readiness'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM production_identity_outcomes o JOIN production_identity_cases c ON c.id=o.case_id JOIN officer_applications a ON a.id=c.applicant_id WHERE o.id=NEW.outcome_id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_identity_suspension_email AFTER INSERT ON production_identity_suspensions BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'identity-hold:'||NEW.id,a.email_normalized,'LOKD Security — identity review required',
 'Your identity approval has been suspended. Sign in to read the reason and contact Operations before accepting further work.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/readiness'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM production_identity_cases c JOIN officer_applications a ON a.id=c.applicant_id WHERE c.id=NEW.case_id;
END;
--> statement-breakpoint
CREATE TRIGGER operations_psira_email AFTER INSERT ON psira_verification_events BEGIN
 INSERT INTO production_notifications(id,recipient,subject,body,next_attempt_at,created_at,updated_at)
 SELECT 'psira:'||NEW.id,c.owner_email,'LOKD Security — PSiRA verification update',
 'Your PSiRA verification has been updated. Open your Officer account to see the result and any required action.'||char(10)||char(10)||'https://officers.lokd.co.za/officer/psira'||char(10)||char(10)||'LOKD Security',NEW.recorded_at,NEW.recorded_at,NEW.recorded_at
 FROM psira_verification_cases c WHERE c.id=NEW.case_id AND EXISTS(SELECT 1 FROM signup_cases sc JOIN officer_applications a ON a.id=sc.source_id WHERE sc.kind='officer' AND sc.owner_user_id=c.owner_user_id AND a.integrity_state='user_submitted');
END;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_receipts_immutable_delete BEFORE DELETE ON client_enquiry_receipts
WHEN NOT EXISTS(SELECT 1 FROM client_enquiries e WHERE e.id=OLD.enquiry_id
 AND julianday(e.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=e.id))
BEGIN SELECT RAISE(ABORT,'enquiry_receipt_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER officer_application_receipts_immutable_delete BEFORE DELETE ON officer_application_receipts
WHEN NOT EXISTS(SELECT 1 FROM officer_applications a WHERE a.id=OLD.application_id
 AND julianday(a.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=a.id))
BEGIN SELECT RAISE(ABORT,'application_receipt_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER `officer_application_provenance_immutable_v21`
BEFORE UPDATE OF `environment`,`integrity_state` ON `officer_applications`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN
	SELECT RAISE(ABORT, 'officer_application_provenance_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `officer_application_provenance_insert_v21`
BEFORE INSERT ON `officer_applications`
WHEN NOT (
	(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'user_submitted')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
)
BEGIN
	SELECT RAISE(ABORT, 'officer_application_provenance_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `officer_application_officer_binding_v21`
BEFORE UPDATE OF `officer_id` ON `officer_applications`
WHEN (OLD.`officer_id` IS NOT NULL AND NEW.`officer_id` IS NOT OLD.`officer_id`)
	OR (OLD.`officer_id` IS NULL AND NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = NEW.`environment` AND passport.`integrity_state` = NEW.`integrity_state`
	))
BEGIN
	SELECT RAISE(ABORT, 'officer_application_officer_binding_invalid');
END;
--> statement-breakpoint
CREATE TRIGGER `identity_case_parent_provenance_v21`
BEFORE INSERT ON `identity_verification_cases`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'user_submitted')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
	) OR NOT EXISTS (
		SELECT 1 FROM `integration_provider_configs` config
		WHERE config.`key` = NEW.`provider_key` AND config.`environment` = NEW.`environment`
			AND config.`integrity_state` = NEW.`integrity_state`
	) OR (NEW.`application_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` application WHERE application.`id` = NEW.`application_id`
			AND application.`environment` = NEW.`environment` AND application.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = NEW.`environment` AND passport.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`application_id` IS NULL AND NEW.`officer_id` IS NULL)
	OR (NEW.`application_id` IS NOT NULL AND NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` application WHERE application.`id` = NEW.`application_id`
			AND application.`officer_id` = NEW.`officer_id`
	)) OR NEW.`status` NOT IN ('created','consent_pending','submitted','processing','manual_review')
	OR NEW.`consent_version` = '' OR NEW.`consented_at` IS NULL
	THEN RAISE(ABORT, 'identity_case_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `outbox_parent_provenance_v21`
BEFORE INSERT ON `domain_outbox_events`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'user_submitted')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
	) OR NEW.`aggregate_type` NOT IN ('officer_application','booking','service_request','identity_case','payment_order')
	OR (NEW.`aggregate_type` = 'officer_application' AND NOT EXISTS (
		SELECT 1 FROM `officer_applications` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'booking' AND NOT EXISTS (
		SELECT 1 FROM `bookings` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'service_request' AND NOT EXISTS (
		SELECT 1 FROM `service_requests` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'identity_case' AND NOT EXISTS (
		SELECT 1 FROM `identity_verification_cases` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`aggregate_type` = 'payment_order' AND NOT EXISTS (
		SELECT 1 FROM `payment_orders` entity WHERE entity.`id` = NEW.`aggregate_id`
			AND entity.`environment` = NEW.`environment` AND entity.`integrity_state` = NEW.`integrity_state`
	)) OR NEW.`status` <> 'pending'
	THEN RAISE(ABORT, 'outbox_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `client_enquiry_update_guard_v30`
BEFORE UPDATE ON `client_enquiries`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NOT ((OLD.`status` = 'new' AND NEW.`status` IN ('triaged','closed'))
		OR (OLD.`status` = 'triaged' AND NEW.`status` = 'closed'))
		OR NEW.`owner_id` IS NULL OR length(trim(NEW.`owner_id`)) < 3
		OR (NEW.`status` = 'triaged' AND NEW.`resolution` IS NOT NULL)
		OR (NEW.`status` = 'closed' AND (NEW.`resolution` IS NULL OR length(trim(NEW.`resolution`)) < 3))
		OR NEW.`version` <> OLD.`version` + 1 OR NEW.`updated_at` <= OLD.`updated_at`
		OR NEW.`id` <> OLD.`id` OR NEW.`organisation_name` <> OLD.`organisation_name`
		OR NEW.`contact_name` <> OLD.`contact_name` OR NEW.`email_normalized` <> OLD.`email_normalized`
		OR COALESCE(NEW.`mobile_normalized`,'') <> COALESCE(OLD.`mobile_normalized`,'')
		OR NEW.`site_area` <> OLD.`site_area` OR NEW.`site_type` <> OLD.`site_type`
		OR NEW.`required_start` <> OLD.`required_start` OR NEW.`message` <> OLD.`message`
		OR NEW.`service_type` <> OLD.`service_type` OR NEW.`funding_model` <> OLD.`funding_model`
		OR NEW.`credit_terms_days` <> OLD.`credit_terms_days`
		OR NEW.`privacy_notice_version` <> OLD.`privacy_notice_version`
		OR NEW.`privacy_acknowledged_at` <> OLD.`privacy_acknowledged_at`
		OR NEW.`environment` <> OLD.`environment` OR NEW.`integrity_state` <> OLD.`integrity_state`
		OR NEW.`retention_review_at` <> OLD.`retention_review_at` OR NEW.`created_at` <> OLD.`created_at`
	THEN RAISE(ABORT, 'client_enquiry_controlled_transition_required') END);
END;
--> statement-breakpoint
CREATE TRIGGER signup_source_guard BEFORE INSERT ON signup_cases BEGIN
  SELECT RAISE(ABORT, 'signup requires a real submitted source') WHERE NOT (
    (NEW.kind='officer' AND EXISTS (SELECT 1 FROM officer_applications WHERE id=NEW.source_id AND environment='production' AND integrity_state='user_submitted'))
    OR (NEW.kind='client' AND EXISTS (SELECT 1 FROM client_enquiries WHERE id=NEW.source_id AND environment='production' AND integrity_state='user_submitted'))
  );
END;
--> statement-breakpoint
CREATE TRIGGER production_identity_case_guard BEFORE INSERT ON production_identity_cases BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM production_identity_cases c JOIN production_identity_outcomes o ON o.case_id=c.id AND o.sequence=(SELECT MAX(sequence) FROM production_identity_outcomes WHERE case_id=c.id) WHERE c.applicant_id=NEW.applicant_id AND o.outcome IN ('pending','delivery_unknown','unavailable','manual_review')) THEN RAISE(ABORT,'Previous identity delivery unresolved') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM signup_cases c JOIN officer_applications a ON a.id=c.source_id WHERE c.kind='officer' AND c.source_id=NEW.applicant_id AND c.version=NEW.applicant_version AND c.owner_user_id=NEW.owner_user_id AND c.status<>'withdrawn' AND a.environment='production' AND a.integrity_state='user_submitted') THEN RAISE(ABORT,'Identity applicant changed') END);
END;
--> statement-breakpoint
CREATE VIEW current_production_identity_evidence AS
 SELECT c.*,o.id AS outcome_id,o.sequence,o.provider_reference,o.evidence_reference,o.evidence_hash,o.checked_at,o.expires_at,d.actor_id AS reviewed_by,d.recorded_at AS reviewed_at
 FROM production_identity_cases c JOIN signup_cases s ON s.kind='officer' AND s.source_id=c.applicant_id AND s.version=c.applicant_version AND s.owner_user_id=c.owner_user_id AND s.status<>'withdrawn'
 JOIN officer_applications a ON a.id=s.source_id AND a.environment='production' AND a.integrity_state='user_submitted'
 JOIN production_identity_outcomes o ON o.case_id=c.id AND o.sequence=(SELECT MAX(sequence) FROM production_identity_outcomes WHERE case_id=c.id)
 JOIN production_identity_decisions d ON d.outcome_id=o.id AND d.decision='approve'
 WHERE o.outcome='verified' AND julianday(o.expires_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM production_identity_suspensions x WHERE x.case_id=c.id);
--> statement-breakpoint
CREATE VIEW current_production_officer_sources AS
 SELECT o.id AS officer_id,l.case_id AS applicant_id,l.case_version AS applicant_version,l.owner_user_id,
 o.full_name,o.mobile,o.email,o.city,o.psira_number,o.psira_grade,
 i.id AS identity_case_id,i.outcome_id AS identity_outcome_id,i.reviewed_by AS identity_reviewer,l.prepared_by AS entity_preparer,
 p.id AS psira_case_id,e.id AS psira_event_id,e.recorded_by AS psira_reviewer,
 json_extract(e.evidence_json,'$.certificateExpiry') AS certificate_expiry,
 strftime('%Y-%m-%dT%H:%M:%fZ',min(julianday(i.expires_at),julianday(e.recheck_at),julianday(json_extract(e.evidence_json,'$.certificateExpiry')||'T00:00:00+02:00'))) AS expires_at
 FROM officers o JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=o.id
 JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.owner_user_id=l.owner_user_id AND c.status='reviewed'
 JOIN officer_applications a ON a.id=c.source_id AND a.environment='production' AND a.integrity_state='user_submitted'
 JOIN current_production_identity_evidence i ON i.applicant_id=l.case_id AND i.applicant_version=l.case_version AND i.owner_user_id=l.owner_user_id
 JOIN psira_verification_cases p ON p.owner_user_id=l.owner_user_id AND p.psira_number=o.psira_number AND p.declaration='registered'
 JOIN psira_verification_events e ON e.id=p.latest_event_id AND e.case_id=p.id AND e.version=p.version AND e.psira_number=p.psira_number
 WHERE e.kind='review' AND e.declaration='registered' AND e.registration_status='registered' AND e.identity_match='confirmed'
 AND julianday(e.recheck_at)>julianday('now')
 AND julianday(json_extract(e.evidence_json,'$.checkedAt')) BETWEEN julianday('now','-30 days') AND julianday('now','+1 minute')
 AND julianday(e.recheck_at)<=julianday(json_extract(e.evidence_json,'$.checkedAt'),'+30 days')
 AND julianday(json_extract(e.evidence_json,'$.certificateExpiry')||'T00:00:00+02:00')>julianday('now')
 AND json_extract(e.evidence_json,'$.source')='https://digitalservices.psira.co.za/verify-user/4'
 AND json_extract(e.evidence_json,'$.returnedNumber')=o.psira_number
 AND lower(trim(json_extract(e.evidence_json,'$.returnedName')))=lower(trim(o.full_name))
 AND lower(json_extract(e.evidence_json,'$.returnedStatus'))='registered'
 AND upper(trim(replace(lower(json_extract(e.evidence_json,'$.grade')),'grade ','')))=upper(trim(replace(lower(o.psira_grade),'grade ','')))
 AND json_extract(e.evidence_json,'$.identityEvidence')='production-identity:'||i.outcome_id
 AND coalesce(json_extract(c.corrections_json,'$.pathway'),a.pathway)<>'training'
 AND coalesce(json_extract(c.corrections_json,'$.psiraStatus'),a.psira_status) IN ('active','expired')
 AND o.full_name=coalesce(json_extract(c.corrections_json,'$.fullName'),a.full_name)
 AND o.mobile=coalesce(json_extract(c.corrections_json,'$.mobile'),a.mobile_normalized)
 AND o.email=a.email_normalized
 AND o.city=coalesce(json_extract(c.corrections_json,'$.city'),a.city)
 AND o.psira_number=coalesce(json_extract(c.corrections_json,'$.psiraNumber'),a.psira_number)
 AND o.psira_grade=coalesce(json_extract(c.corrections_json,'$.psiraGrade'),a.psira_grade);
--> statement-breakpoint
CREATE VIEW production_rereview_sources AS
 SELECT t.*,c.version AS applicant_version,c.status AS applicant_status,c.latest_event_id,c.corrections_json
 FROM production_rereview_targets t JOIN signup_cases c ON c.kind='officer' AND c.source_id=t.applicant_id AND c.owner_user_id=t.owner_user_id
 JOIN officer_applications a ON a.id=c.source_id AND a.environment='production' AND a.integrity_state='user_submitted';
--> statement-breakpoint
CREATE TRIGGER operational_enquiry_delivery AFTER INSERT ON client_enquiries
WHEN NEW.environment='production' AND NEW.integrity_state='user_submitted'
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('crm:'||NEW.id,'enquiry_crm',NEW.id,'production',NEW.created_at,NEW.created_at,NEW.created_at);
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('team:'||NEW.id,'enquiry_email',NEW.id,'production',NEW.created_at,NEW.created_at,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_binding BEFORE UPDATE ON operational_delivery_jobs
WHEN NEW.id!=OLD.id OR NEW.kind!=OLD.kind OR NEW.source_id!=OLD.source_id OR NEW.environment!=OLD.environment
 OR NEW.created_at!=OLD.created_at OR NEW.attempts<OLD.attempts
 OR (OLD.request_json IS NOT NULL AND NEW.request_json IS NOT OLD.request_json)
 OR (OLD.recipient IS NOT NULL AND NEW.recipient IS NOT OLD.recipient)
 OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS NOT OLD.provider_id)
 OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS NOT OLD.first_attempt_at)
BEGIN SELECT RAISE(ABORT,'delivery_binding_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_original_claim BEFORE INSERT ON operational_delivery_jobs
WHEN EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE id=NEW.id OR (kind=NEW.kind AND source_id=NEW.source_id))
 OR NEW.state!='queued' OR NEW.attempts!=0 OR NEW.provider_id IS NOT NULL OR NEW.request_json IS NOT NULL
 OR NEW.recipient IS NOT NULL OR NEW.first_attempt_at IS NOT NULL
 OR NOT (
  (NEW.kind IN ('enquiry_crm','enquiry_email') AND NEW.environment='production' AND EXISTS(SELECT 1 FROM client_enquiries WHERE id=NEW.source_id AND environment='production' AND integrity_state='user_submitted'))
  OR (NEW.kind='booking_email' AND NEW.environment='production' AND EXISTS(SELECT 1 FROM production_order_setups WHERE id=NEW.source_id))
  OR (NEW.kind='contract_email' AND NEW.environment='production' AND (EXISTS(SELECT 1 FROM production_signing_envelopes WHERE id=NEW.source_id) OR EXISTS(SELECT 1 FROM client_quote_offers WHERE id=NEW.source_id)))
 )
BEGIN SELECT RAISE(ABORT,'delivery_original_claim_required'); END;
--> statement-breakpoint
CREATE TRIGGER `client_enquiry_insert_guard_v30`
BEFORE INSERT ON `client_enquiries`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'production' OR NEW.`integrity_state` <> 'user_submitted'
		OR NEW.`service_type` NOT IN ('scheduled_unarmed_fixed_site','armed_static','armed_movement','vip_unarmed','vip_armed','vip_protective_driver','vip_team')
		OR NEW.`funding_model` <> 'advance_only' OR NEW.`credit_terms_days` <> 0
		OR NEW.`status` <> 'new' OR NEW.`owner_id` IS NOT NULL OR NEW.`resolution` IS NOT NULL
		OR NEW.`version` <> 1 OR length(trim(NEW.`privacy_notice_version`)) < 3
		OR NEW.`privacy_acknowledged_at` IS NULL OR NEW.`retention_review_at` <= NEW.`created_at`
	THEN RAISE(ABORT, 'client_enquiry_control_boundary_invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_schedule_immutable
BEFORE UPDATE ON client_enquiries
WHEN NEW.site_address IS NOT OLD.site_address OR NEW.start_date IS NOT OLD.start_date
 OR NEW.end_date IS NOT OLD.end_date OR NEW.start_time IS NOT OLD.start_time
 OR NEW.end_time IS NOT OLD.end_time OR NEW.officer_count IS NOT OLD.officer_count OR NEW.schedule IS NOT OLD.schedule
BEGIN SELECT RAISE(ABORT,'enquiry_schedule_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_delete_guard_v30 BEFORE DELETE ON client_enquiries
WHEN julianday(OLD.retention_review_at) IS NULL OR julianday(OLD.retention_review_at)>julianday('now')
 OR EXISTS(SELECT 1 FROM signup_cases WHERE source_id=OLD.id)
 OR EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE source_id=OLD.id AND state='dispatching')
BEGIN SELECT RAISE(ABORT,'client_enquiry_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_history BEFORE DELETE ON operational_delivery_jobs
WHEN OLD.kind NOT IN ('enquiry_crm','enquiry_email') OR OLD.state='dispatching' OR NOT EXISTS(
 SELECT 1 FROM client_enquiries e WHERE e.id=OLD.source_id AND julianday(e.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=e.id))
BEGIN SELECT RAISE(ABORT,'delivery_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_retention_children BEFORE DELETE ON client_enquiries
WHEN julianday(OLD.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases WHERE source_id=OLD.id)
 AND NOT EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE source_id=OLD.id AND state='dispatching')
BEGIN
 DELETE FROM client_enquiry_receipts WHERE enquiry_id=OLD.id;
 DELETE FROM operational_delivery_jobs WHERE source_id=OLD.id AND kind IN ('enquiry_crm','enquiry_email');
END;
