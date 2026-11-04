-- Public intake records are production records. Rebuild every guard, trigger and view that keyed on the old environment value.
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
DROP TRIGGER IF EXISTS `service_request_parent_provenance_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `outbox_parent_provenance_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `identity_case_parent_provenance_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_provider_provenance_insert_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_application_officer_binding_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_application_provenance_insert_v21`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `officer_application_provenance_immutable_v21`;
--> statement-breakpoint
UPDATE `officer_applications` SET environment='production' WHERE environment<>'production';
--> statement-breakpoint
UPDATE `client_enquiries` SET environment='production' WHERE environment<>'production';
--> statement-breakpoint
UPDATE `operational_delivery_jobs` SET environment='production' WHERE environment<>'production';
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
CREATE TRIGGER `integration_provider_provenance_insert_v21`
BEFORE INSERT ON `integration_provider_configs`
WHEN NOT (
	(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'user_submitted')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
)
BEGIN
	SELECT RAISE(ABORT, 'integration_provider_provenance_invalid');
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
CREATE TRIGGER `service_request_parent_provenance_v21`
BEFORE INSERT ON `service_requests`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'user_submitted')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` IN ('verified','production_verified'))
	) OR (NEW.`client_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `clients` client WHERE client.`id` = NEW.`client_id`
			AND client.`environment` = NEW.`environment` AND client.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`officer_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `officer_passports` passport WHERE passport.`officer_id` = NEW.`officer_id`
			AND passport.`environment` = NEW.`environment` AND passport.`integrity_state` = NEW.`integrity_state`
	)) OR (NEW.`booking_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `bookings` booking WHERE booking.`id` = NEW.`booking_id`
			AND booking.`environment` = NEW.`environment` AND booking.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`client_id` IS NULL OR booking.`client_id` = NEW.`client_id`)
	)) OR (NEW.`shift_id` IS NOT NULL AND NOT EXISTS (
		SELECT 1 FROM `shifts` shift JOIN `bookings` booking ON booking.`id` = shift.`booking_id`
		WHERE shift.`id` = NEW.`shift_id` AND shift.`environment` = NEW.`environment`
			AND shift.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`booking_id` IS NULL OR shift.`booking_id` = NEW.`booking_id`)
			AND (NEW.`client_id` IS NULL OR booking.`client_id` = NEW.`client_id`)
			AND (NEW.`officer_id` IS NULL OR shift.`officer_id` = NEW.`officer_id`)
	)) THEN RAISE(ABORT, 'service_request_parent_provenance_mismatch') END);
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
