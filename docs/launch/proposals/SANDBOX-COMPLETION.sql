-- Unnumbered additive sandbox-only database proposal. Central owns numbering.
-- Load into an empty dedicated SANDBOX_DB after canonical migrations; never DB.
-- An explicit initializer supplies the policy hash; no production seed evidence.
CREATE TABLE sandbox_completion_instance(singleton INTEGER PRIMARY KEY CHECK(singleton=1),mode TEXT NOT NULL CHECK(mode='sandbox'),policy_version TEXT NOT NULL,policy_hash TEXT NOT NULL);
CREATE TABLE sandbox_identity_captures(id TEXT PRIMARY KEY,applicant_id TEXT NOT NULL,applicant_version INTEGER NOT NULL,owner_user_id TEXT NOT NULL,consent_version TEXT NOT NULL,policy_version TEXT NOT NULL,scenario TEXT NOT NULL,binding_hash TEXT NOT NULL,captured_at TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE sandbox_identity_consent_events(id TEXT PRIMARY KEY,capture_id TEXT NOT NULL REFERENCES sandbox_identity_captures(id),action TEXT NOT NULL CHECK(action IN ('consent','withdraw')),actor_id TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TABLE sandbox_identity_dispatches(case_id TEXT PRIMARY KEY REFERENCES production_identity_cases(id),capture_id TEXT NOT NULL REFERENCES sandbox_identity_captures(id),result_json TEXT NOT NULL CHECK(json_valid(result_json)),dispatched_at TEXT NOT NULL);
CREATE TABLE sandbox_identity_objects(case_id TEXT PRIMARY KEY REFERENCES sandbox_identity_dispatches(case_id),reference TEXT NOT NULL UNIQUE,body TEXT NOT NULL,sha256 TEXT NOT NULL,expires_at TEXT NOT NULL,policy_version TEXT NOT NULL);
CREATE TABLE sandbox_identity_access(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES production_identity_cases(id),reader_user_id TEXT NOT NULL,granted_by TEXT NOT NULL,policy_version TEXT NOT NULL,expires_at TEXT NOT NULL,UNIQUE(case_id,reader_user_id));
CREATE TABLE sandbox_identity_access_revocations(id TEXT PRIMARY KEY,grant_id TEXT NOT NULL REFERENCES sandbox_identity_access(id),actor_id TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TRIGGER sandbox_completion_instance_update BEFORE UPDATE ON sandbox_completion_instance BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_completion_instance_delete BEFORE DELETE ON sandbox_completion_instance BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_completion_instance_replace BEFORE INSERT ON sandbox_completion_instance WHEN EXISTS(SELECT 1 FROM sandbox_completion_instance WHERE singleton=NEW.singleton) BEGIN SELECT RAISE(ABORT,'immutable sandbox identity'); END;
CREATE TRIGGER sandbox_identity_captures_update BEFORE UPDATE ON sandbox_identity_captures BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_captures_delete BEFORE DELETE ON sandbox_identity_captures BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_captures_replace BEFORE INSERT ON sandbox_identity_captures WHEN EXISTS(SELECT 1 FROM sandbox_identity_captures WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox identity'); END;
CREATE TRIGGER sandbox_identity_consent_events_update BEFORE UPDATE ON sandbox_identity_consent_events BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_consent_events_delete BEFORE DELETE ON sandbox_identity_consent_events BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_consent_events_replace BEFORE INSERT ON sandbox_identity_consent_events WHEN EXISTS(SELECT 1 FROM sandbox_identity_consent_events WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox identity'); END;
CREATE TRIGGER sandbox_identity_dispatches_update BEFORE UPDATE ON sandbox_identity_dispatches BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_dispatches_delete BEFORE DELETE ON sandbox_identity_dispatches BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_dispatches_replace BEFORE INSERT ON sandbox_identity_dispatches WHEN EXISTS(SELECT 1 FROM sandbox_identity_dispatches WHERE case_id=NEW.case_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox identity'); END;
CREATE TRIGGER sandbox_identity_objects_update BEFORE UPDATE ON sandbox_identity_objects BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_objects_delete BEFORE DELETE ON sandbox_identity_objects BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_objects_replace BEFORE INSERT ON sandbox_identity_objects WHEN EXISTS(SELECT 1 FROM sandbox_identity_objects WHERE case_id=NEW.case_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox identity'); END;
CREATE TRIGGER sandbox_identity_access_update BEFORE UPDATE ON sandbox_identity_access BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_access_delete BEFORE DELETE ON sandbox_identity_access BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_access_replace BEFORE INSERT ON sandbox_identity_access WHEN EXISTS(SELECT 1 FROM sandbox_identity_access WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox identity'); END;
CREATE TRIGGER sandbox_identity_access_revocations_update BEFORE UPDATE ON sandbox_identity_access_revocations BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_access_revocations_delete BEFORE DELETE ON sandbox_identity_access_revocations BEGIN SELECT RAISE(ABORT,'immutable sandbox history'); END;
CREATE TRIGGER sandbox_identity_access_revocations_replace BEFORE INSERT ON sandbox_identity_access_revocations WHEN EXISTS(SELECT 1 FROM sandbox_identity_access_revocations WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox identity'); END;
CREATE TRIGGER sandbox_object_reference_replace BEFORE INSERT ON sandbox_identity_objects WHEN EXISTS(SELECT 1 FROM sandbox_identity_objects WHERE reference=NEW.reference) BEGIN SELECT RAISE(ABORT,'immutable sandbox object reference'); END;
CREATE TRIGGER sandbox_access_scope_replace BEFORE INSERT ON sandbox_identity_access WHEN EXISTS(SELECT 1 FROM sandbox_identity_access WHERE case_id=NEW.case_id AND reader_user_id=NEW.reader_user_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox access grant'); END;
CREATE TABLE sandbox_company_authority(id TEXT PRIMARY KEY,employer_id TEXT NOT NULL REFERENCES workforce_employers(id),user_id TEXT NOT NULL,mandate_reference TEXT NOT NULL,mandate_hash TEXT NOT NULL,granted_by TEXT NOT NULL,expires_at TEXT NOT NULL,policy_version TEXT NOT NULL);
CREATE TABLE sandbox_partner_responsibilities(id TEXT PRIMARY KEY,engagement_id TEXT NOT NULL REFERENCES workforce_engagements(id),engagement_version INTEGER NOT NULL,employer_id TEXT NOT NULL REFERENCES workforce_employers(id),authority_id TEXT NOT NULL REFERENCES sandbox_company_authority(id),source_json TEXT NOT NULL CHECK(json_valid(source_json)),source_hash TEXT NOT NULL,confirmed_by TEXT NOT NULL,confirmed_at TEXT NOT NULL,expires_at TEXT NOT NULL,policy_version TEXT NOT NULL);
CREATE TABLE sandbox_partner_decisions(responsibility_id TEXT PRIMARY KEY REFERENCES sandbox_partner_responsibilities(id),decision TEXT NOT NULL CHECK(decision IN ('approve','reject')),reviewer_user_id TEXT NOT NULL,reason TEXT NOT NULL,recorded_at TEXT NOT NULL);
CREATE TRIGGER sandbox_partner_decision_guard BEFORE INSERT ON sandbox_partner_decisions WHEN NOT EXISTS(
 SELECT 1 FROM sandbox_partner_responsibilities r JOIN workforce_engagements w ON w.id=r.engagement_id JOIN sandbox_company_authority a ON a.id=r.authority_id
 WHERE r.id=NEW.responsibility_id AND w.version=r.engagement_version AND w.model='partner' AND w.status='active' AND w.active_key=w.officer_id AND w.employer_id=r.employer_id AND a.employer_id=r.employer_id AND a.user_id=r.confirmed_by AND r.confirmed_by!=NEW.reviewer_user_id AND a.granted_by!=r.confirmed_by AND r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND a.expires_at>=r.expires_at AND a.policy_version=r.policy_version
 AND NOT EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='officer' AND l.entity_id=w.officer_id AND l.owner_user_id=NEW.reviewer_user_id)
) BEGIN SELECT RAISE(ABORT,'current independent partner responsibility required'); END;
CREATE TRIGGER sandbox_partner_decision_project AFTER INSERT ON sandbox_partner_decisions WHEN NEW.decision='approve' BEGIN
 UPDATE workforce_engagements SET payroll_status='partner_confirmed',benefits_status='partner_confirmed',review_due_at=min(review_due_at,(SELECT expires_at FROM sandbox_partner_responsibilities WHERE id=NEW.responsibility_id)),version=version+1 WHERE id=(SELECT engagement_id FROM sandbox_partner_responsibilities WHERE id=NEW.responsibility_id);
END;
CREATE TRIGGER sandbox_company_authority_update BEFORE UPDATE ON sandbox_company_authority BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce history'); END;
CREATE TRIGGER sandbox_company_authority_delete BEFORE DELETE ON sandbox_company_authority BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce history'); END;
CREATE TRIGGER sandbox_company_authority_replace BEFORE INSERT ON sandbox_company_authority WHEN EXISTS(SELECT 1 FROM sandbox_company_authority WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce identity'); END;
CREATE TRIGGER sandbox_partner_responsibilities_update BEFORE UPDATE ON sandbox_partner_responsibilities BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce history'); END;
CREATE TRIGGER sandbox_partner_responsibilities_delete BEFORE DELETE ON sandbox_partner_responsibilities BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce history'); END;
CREATE TRIGGER sandbox_partner_responsibilities_replace BEFORE INSERT ON sandbox_partner_responsibilities WHEN EXISTS(SELECT 1 FROM sandbox_partner_responsibilities WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce identity'); END;
CREATE TRIGGER sandbox_partner_decisions_update BEFORE UPDATE ON sandbox_partner_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce history'); END;
CREATE TRIGGER sandbox_partner_decisions_delete BEFORE DELETE ON sandbox_partner_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce history'); END;
CREATE TRIGGER sandbox_partner_decisions_replace BEFORE INSERT ON sandbox_partner_decisions WHEN EXISTS(SELECT 1 FROM sandbox_partner_decisions WHERE responsibility_id=NEW.responsibility_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox workforce identity'); END;
CREATE TABLE sandbox_scan_receipts(request_key TEXT PRIMARY KEY,request_hash TEXT NOT NULL,shift_id TEXT NOT NULL REFERENCES shifts(id),officer_user_id TEXT NOT NULL,scenario TEXT NOT NULL,policy_version TEXT NOT NULL,result_json TEXT NOT NULL CHECK(json_valid(result_json)),recorded_at TEXT NOT NULL);
CREATE TABLE sandbox_incident_commands(request_key TEXT PRIMARY KEY,request_hash TEXT NOT NULL,incident_id TEXT NOT NULL REFERENCES site_incidents(id),expected_version INTEGER NOT NULL,actor_id TEXT NOT NULL,policy_version TEXT NOT NULL,result_json TEXT NOT NULL CHECK(json_valid(result_json)),UNIQUE(incident_id,expected_version));
CREATE TRIGGER sandbox_incident_version_claim BEFORE INSERT ON sandbox_incident_commands WHEN EXISTS(SELECT 1 FROM sandbox_incident_commands WHERE incident_id=NEW.incident_id AND expected_version=NEW.expected_version) BEGIN SELECT RAISE(ABORT,'incident version already consumed'); END;
CREATE TRIGGER sandbox_scan_receipts_update BEFORE UPDATE ON sandbox_scan_receipts BEGIN SELECT RAISE(ABORT,'immutable sandbox service receipt'); END;
CREATE TRIGGER sandbox_scan_receipts_delete BEFORE DELETE ON sandbox_scan_receipts BEGIN SELECT RAISE(ABORT,'immutable sandbox service receipt'); END;
CREATE TRIGGER sandbox_scan_receipts_replace BEFORE INSERT ON sandbox_scan_receipts WHEN EXISTS(SELECT 1 FROM sandbox_scan_receipts WHERE request_key=NEW.request_key) BEGIN SELECT RAISE(ABORT,'immutable sandbox service key'); END;
CREATE TRIGGER sandbox_incident_commands_update BEFORE UPDATE ON sandbox_incident_commands BEGIN SELECT RAISE(ABORT,'immutable sandbox service receipt'); END;
CREATE TRIGGER sandbox_incident_commands_delete BEFORE DELETE ON sandbox_incident_commands BEGIN SELECT RAISE(ABORT,'immutable sandbox service receipt'); END;
CREATE TRIGGER sandbox_incident_commands_replace BEFORE INSERT ON sandbox_incident_commands WHEN EXISTS(SELECT 1 FROM sandbox_incident_commands WHERE request_key=NEW.request_key) BEGIN SELECT RAISE(ABORT,'immutable sandbox service key'); END;

-- Finance entitlement boundary is a simulator. No purchase grants readiness.
CREATE TABLE sandbox_training_entitlements(id TEXT PRIMARY KEY,officer_id TEXT NOT NULL REFERENCES officers(id),owner_user_id TEXT NOT NULL,applicant_version INTEGER NOT NULL,course TEXT NOT NULL,course_version TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,issued_by TEXT NOT NULL,expires_at TEXT NOT NULL,policy_version TEXT NOT NULL);
CREATE TABLE sandbox_training_assessments(id TEXT PRIMARY KEY,entitlement_id TEXT NOT NULL REFERENCES sandbox_training_entitlements(id),score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),source_json TEXT NOT NULL,source_hash TEXT NOT NULL,assessor TEXT NOT NULL,assessed_at TEXT NOT NULL,expires_at TEXT NOT NULL,policy_version TEXT NOT NULL);
CREATE TABLE sandbox_training_revocations(entitlement_id TEXT PRIMARY KEY REFERENCES sandbox_training_entitlements(id),actor TEXT NOT NULL,reason TEXT NOT NULL,revoked_at TEXT NOT NULL);
CREATE TRIGGER sandbox_training_readiness_guard BEFORE INSERT ON production_readiness_reviews
WHEN EXISTS(SELECT 1 FROM production_readiness_rules p,json_each(p.requirements_json) j WHERE p.id=NEW.rule_id AND j.value LIKE 'training:%')
BEGIN
 SELECT CASE WHEN NOT EXISTS(
 SELECT 1 FROM json_each(NEW.evidence_json) j JOIN sandbox_training_assessments a ON json_extract(j.value,'$.reference')='sandbox-training:'||a.id
 JOIN sandbox_training_entitlements e ON e.id=a.entitlement_id
 JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=e.officer_id AND l.owner_user_id=e.owner_user_id AND l.case_version=e.applicant_version
 JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed'
 WHERE e.officer_id=NEW.officer_id AND json_extract(j.value,'$.sha256')=a.source_hash
 AND json_extract(j.value,'$.requirement')='training:'||e.course
 AND a.assessor=NEW.prepared_by AND a.assessor!=e.issued_by AND a.assessor!=e.owner_user_id
 AND a.score>=json_extract(a.source_json,'$.passPercent') AND a.policy_version=e.policy_version
 AND julianday(e.expires_at)>julianday('now') AND julianday(a.expires_at)>julianday('now')
 AND NOT EXISTS(SELECT 1 FROM sandbox_training_revocations r WHERE r.entitlement_id=e.id)
 ) THEN RAISE(ABORT,'current independently assessed sandbox training source required') END;
END;
CREATE TRIGGER sandbox_training_decision_guard BEFORE INSERT ON production_readiness_decisions
WHEN NEW.kind='review' AND NEW.decision='approve'
BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM production_readiness_reviews r,json_each(r.evidence_json) j
 JOIN sandbox_training_assessments a ON json_extract(j.value,'$.reference')='sandbox-training:'||a.id
 JOIN sandbox_training_entitlements e ON e.id=a.entitlement_id
 WHERE r.id=NEW.target_id AND (NEW.actor_id=e.issued_by OR NEW.actor_id=e.owner_user_id OR NEW.actor_id=json_extract(e.source_json,'$.completionReviewer')
 OR julianday(e.expires_at)<=julianday('now') OR EXISTS(SELECT 1 FROM sandbox_training_revocations x WHERE x.entitlement_id=e.id)))
 THEN RAISE(ABORT,'independent current training decision required') END;
END;
-- Revoke derived readiness atomically, even if the HTTP process stops afterward.
CREATE TRIGGER sandbox_training_revoke_hold AFTER INSERT ON sandbox_training_revocations BEGIN
 INSERT INTO production_readiness_holds
 SELECT lower(hex(randomblob(16))),'review',r.id,'revoke',NEW.actor,NEW.reason,NEW.revoked_at
 FROM production_readiness_reviews r,json_each(r.evidence_json) j JOIN sandbox_training_assessments a
 ON json_extract(j.value,'$.reference')='sandbox-training:'||a.id WHERE a.entitlement_id=NEW.entitlement_id;
END;

CREATE TRIGGER sandbox_training_entitlements_update BEFORE UPDATE ON sandbox_training_entitlements BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_training_entitlements_delete BEFORE DELETE ON sandbox_training_entitlements BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_training_entitlements_replace BEFORE INSERT ON sandbox_training_entitlements WHEN EXISTS(SELECT 1 FROM sandbox_training_entitlements WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_training_assessments_update BEFORE UPDATE ON sandbox_training_assessments BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_training_assessments_delete BEFORE DELETE ON sandbox_training_assessments BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_training_assessments_replace BEFORE INSERT ON sandbox_training_assessments WHEN EXISTS(SELECT 1 FROM sandbox_training_assessments WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_training_revocations_update BEFORE UPDATE ON sandbox_training_revocations BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_training_revocations_delete BEFORE DELETE ON sandbox_training_revocations BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_training_revocations_replace BEFORE INSERT ON sandbox_training_revocations WHEN EXISTS(SELECT 1 FROM sandbox_training_revocations WHERE entitlement_id=NEW.entitlement_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TABLE sandbox_engagement_transitions(id TEXT PRIMARY KEY,previous_id TEXT NOT NULL REFERENCES workforce_engagements(id),previous_version INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,prepared_by TEXT NOT NULL,prepared_at TEXT NOT NULL);
CREATE TABLE sandbox_engagement_decisions(transition_id TEXT PRIMARY KEY REFERENCES sandbox_engagement_transitions(id),decision TEXT NOT NULL CHECK(decision IN('approve','reject')),reviewer TEXT NOT NULL,reason TEXT NOT NULL,effective_at TEXT NOT NULL);
CREATE TRIGGER sandbox_engagement_decision_guard BEFORE INSERT ON sandbox_engagement_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sandbox_engagement_transitions t JOIN workforce_engagements w ON w.id=t.previous_id
 JOIN production_entity_links l ON l.kind='officer' AND l.entity_id=w.officer_id JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version AND c.status='reviewed'
 JOIN workforce_employers e ON e.id=json_extract(t.source_json,'$.employerId') AND e.status='current' AND julianday(e.review_due_at)>julianday('now')
 WHERE t.id=NEW.transition_id AND t.prepared_by!=NEW.reviewer AND l.owner_user_id!=NEW.reviewer
 AND w.version=t.previous_version AND w.status='active' AND w.active_key=w.officer_id
 AND json_extract(t.source_json,'$.policyVersion')=(SELECT policy_version FROM sandbox_completion_instance)
 AND ((json_extract(t.source_json,'$.model')='partner' AND e.employer_type='partner_company') OR (json_extract(t.source_json,'$.model') IN ('managed','direct_flex') AND e.employer_type='lokd_employer'))
 AND NOT EXISTS(SELECT 1 FROM shifts s WHERE s.officer_id=w.officer_id AND s.status IN('confirmed','on_post'))
 AND NOT EXISTS(SELECT 1 FROM workforce_engagements n WHERE n.id=json_extract(t.source_json,'$.nextId'))
 ) THEN RAISE(ABORT,'current independent transition with no unresolved assignment required') END;
END;
CREATE TRIGGER sandbox_engagement_apply AFTER INSERT ON sandbox_engagement_decisions WHEN NEW.decision='approve' BEGIN
 UPDATE workforce_engagements SET status='suspended',active_key=NULL,version=version+1,updated_at=NEW.effective_at WHERE id=(SELECT previous_id FROM sandbox_engagement_transitions WHERE id=NEW.transition_id);
 INSERT INTO audit_events
 SELECT lower(hex(randomblob(16))),'operations',NEW.reviewer,'production_evidence_suspended','evidence_review',r.id,
 json_object('reason',NEW.reason,'engagementId',t.previous_id,'sourceVersion',t.previous_version),NEW.effective_at
 FROM sandbox_engagement_transitions t JOIN production_evidence_reviews r ON r.kind='engagement' AND r.state='approved' AND json_extract(r.payload_json,'$.engagementId')=t.previous_id WHERE t.id=NEW.transition_id;
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.reviewer,'sandbox_engagement_transition','engagement',NEW.transition_id,NEW.reason,NEW.effective_at);
END;

CREATE TRIGGER sandbox_engagement_transitions_update BEFORE UPDATE ON sandbox_engagement_transitions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_engagement_transitions_delete BEFORE DELETE ON sandbox_engagement_transitions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_engagement_transitions_replace BEFORE INSERT ON sandbox_engagement_transitions WHEN EXISTS(SELECT 1 FROM sandbox_engagement_transitions WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_engagement_decisions_update BEFORE UPDATE ON sandbox_engagement_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_engagement_decisions_delete BEFORE DELETE ON sandbox_engagement_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_engagement_decisions_replace BEFORE INSERT ON sandbox_engagement_decisions WHEN EXISTS(SELECT 1 FROM sandbox_engagement_decisions WHERE transition_id=NEW.transition_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TABLE sandbox_specialist_authorities(id TEXT PRIMARY KEY,code TEXT NOT NULL REFERENCES launch_controls(code),source_json TEXT NOT NULL,source_hash TEXT NOT NULL,prepared_by TEXT NOT NULL,prepared_at TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE sandbox_specialist_decisions(authority_id TEXT PRIMARY KEY REFERENCES sandbox_specialist_authorities(id),decision TEXT NOT NULL CHECK(decision IN('approve','reject')),reviewer TEXT NOT NULL,reason TEXT NOT NULL,decided_at TEXT NOT NULL);
CREATE TRIGGER sandbox_specialist_guard BEFORE INSERT ON sandbox_specialist_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sandbox_specialist_authorities a WHERE a.id=NEW.authority_id AND a.prepared_by!=NEW.reviewer AND julianday(a.expires_at)>julianday('now') AND json_extract(a.source_json,'$.policyVersion')=(SELECT policy_version FROM sandbox_completion_instance)) THEN RAISE(ABORT,'independent current specialist source required') END;
END;
CREATE TRIGGER sandbox_specialist_project AFTER INSERT ON sandbox_specialist_decisions WHEN NEW.decision='approve' BEGIN
 UPDATE launch_controls SET status='passed',evidence_level='independently_verified',evidence_reference='sandbox:authority:'||NEW.authority_id,verified_by=NEW.reviewer,verified_at=NEW.decided_at,expires_at=(SELECT expires_at FROM sandbox_specialist_authorities WHERE id=NEW.authority_id),version=version+1,updated_at=NEW.decided_at WHERE code=(SELECT code FROM sandbox_specialist_authorities WHERE id=NEW.authority_id);
END;

CREATE TRIGGER sandbox_specialist_authorities_update BEFORE UPDATE ON sandbox_specialist_authorities BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_specialist_authorities_delete BEFORE DELETE ON sandbox_specialist_authorities BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_specialist_authorities_replace BEFORE INSERT ON sandbox_specialist_authorities WHEN EXISTS(SELECT 1 FROM sandbox_specialist_authorities WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_specialist_decisions_update BEFORE UPDATE ON sandbox_specialist_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_specialist_decisions_delete BEFORE DELETE ON sandbox_specialist_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_specialist_decisions_replace BEFORE INSERT ON sandbox_specialist_decisions WHEN EXISTS(SELECT 1 FROM sandbox_specialist_decisions WHERE authority_id=NEW.authority_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

-- SANDBOX_DB ONLY: explicit independent test-settlement boundary. This never
-- changes the integrity label on a reconciliation or claims provider acceptance.
CREATE TABLE sandbox_funding_acceptances(id TEXT PRIMARY KEY,reconciliation_id TEXT NOT NULL REFERENCES booking_funding_reconciliations(id),reconciliation_version INTEGER NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,prepared_by TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE sandbox_funding_decisions(acceptance_id TEXT PRIMARY KEY REFERENCES sandbox_funding_acceptances(id),decision TEXT NOT NULL CHECK(decision IN('approve','reject')),reviewer TEXT NOT NULL,reason TEXT NOT NULL,decided_at TEXT NOT NULL);
CREATE TRIGGER sandbox_funding_decision_guard BEFORE INSERT ON sandbox_funding_decisions BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM sandbox_funding_acceptances a JOIN booking_funding_reconciliations f ON f.id=a.reconciliation_id AND f.version=a.reconciliation_version JOIN bookings b ON b.id=f.booking_id
 WHERE a.id=NEW.acceptance_id AND a.prepared_by!=NEW.reviewer AND julianday(a.expires_at)>julianday('now') AND f.expected_amount_cents=b.client_price_cents AND f.cleared_amount_cents=b.client_price_cents
 AND json_extract(a.source_json,'$.client_price_cents')=b.client_price_cents AND json_extract(a.source_json,'$.provider_reference')=f.provider_reference
 AND json_extract(a.source_json,'$.policyVersion')=(SELECT policy_version FROM sandbox_completion_instance)) THEN RAISE(ABORT,'independent exact sandbox funding source required') END;
END;

CREATE TRIGGER sandbox_funding_acceptances_update BEFORE UPDATE ON sandbox_funding_acceptances BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_funding_acceptances_delete BEFORE DELETE ON sandbox_funding_acceptances BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_funding_acceptances_replace BEFORE INSERT ON sandbox_funding_acceptances WHEN EXISTS(SELECT 1 FROM sandbox_funding_acceptances WHERE id=NEW.id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_funding_decisions_update BEFORE UPDATE ON sandbox_funding_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

CREATE TRIGGER sandbox_funding_decisions_delete BEFORE DELETE ON sandbox_funding_decisions BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;
CREATE TRIGGER sandbox_funding_decisions_replace BEFORE INSERT ON sandbox_funding_decisions WHEN EXISTS(SELECT 1 FROM sandbox_funding_decisions WHERE acceptance_id=NEW.acceptance_id) BEGIN SELECT RAISE(ABORT,'immutable sandbox evidence'); END;

-- Preserve every canonical specialist guard; add only the isolated, explicit
-- simulator settlement source for this marked database. Never install on DB.
DROP VIEW specialist_booking_control_validation_v33;
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
  CASE WHEN booking.`specialist_service_code` = 'standard_unarmed' THEN 1
    WHEN (SELECT COUNT(*) FROM `launch_controls` gate
      WHERE gate.`code` IN (
        'S3_SPECIALIST_INSURANCE','S4_SPECIALIST_BOARD_APPROVAL',
        CASE WHEN booking.`specialist_service_code` IN ('armed_static','armed_movement','vip_armed') THEN 'S1_ARMED_SERVICE_AUTHORITY' ELSE 'S2_VIP_SERVICE_AUTHORITY' END,
        CASE WHEN booking.`specialist_service_code` = 'vip_armed' THEN 'S2_VIP_SERVICE_AUTHORITY' ELSE '' END
      )
      AND gate.`status` = 'passed'
      AND gate.`evidence_level` IN ('system_verified','independently_verified')
      AND gate.`evidence_reference` IS NOT NULL AND length(trim(gate.`evidence_reference`)) >= 8
      AND gate.`verified_at` IS NOT NULL AND julianday(gate.`verified_at`) <= julianday(strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      AND gate.`expires_at` IS NOT NULL
      AND julianday(gate.`expires_at`) >= julianday((SELECT MAX(slot.`ends_at`) FROM `roster_slots` slot WHERE slot.`booking_id` = booking.`id`))
    ) = CASE WHEN booking.`specialist_service_code` = 'vip_armed' THEN 4 ELSE 3 END
    THEN 1 ELSE 0 END AS `specialist_authority_current`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `booking_funding_reconciliations` funding
    WHERE funding.`booking_id` = booking.`id` AND funding.`active_key` = booking.`id`
      AND funding.`environment` = booking.`environment` AND (funding.`integrity_state` = booking.`integrity_state` OR EXISTS(
 SELECT 1 FROM sandbox_funding_acceptances a JOIN sandbox_funding_decisions d ON d.acceptance_id=a.id AND d.decision='approve'
 WHERE a.reconciliation_id=funding.id AND a.reconciliation_version=funding.version
 AND json_extract(a.source_json,'$.client_price_cents')=booking.client_price_cents
 AND json_extract(a.source_json,'$.provider_reference')=funding.provider_reference
 AND json_extract(a.source_json,'$.mode')='simulator'
 AND json_extract(a.source_json,'$.policyVersion')=(SELECT policy_version FROM sandbox_completion_instance WHERE mode='sandbox')
 AND julianday(a.expires_at)>=julianday((SELECT MAX(slot.ends_at) FROM roster_slots slot WHERE slot.booking_id=booking.id))))
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
WHERE booking.`pricing_version` = 'LOKD-SPECIALIST-2026.09-v1';

-- Same explicit simulator boundary for the zero-credit state transition.
-- The zero-credit and open-offer hold requirements are retained verbatim.
DROP TRIGGER booking_zero_credit_update_guard_v28;
CREATE TRIGGER `booking_zero_credit_update_guard_v28`
BEFORE UPDATE OF `credit_terms_days`, `funding_model`, `funding_status`, `client_price_cents` ON `bookings`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`credit_terms_days` <> 0 OR NEW.`funding_model` <> 'advance_only'
		THEN RAISE(ABORT, 'zero_credit_advance_funding_required') END);
	SELECT (CASE WHEN NEW.`environment` = 'production' AND NEW.`funding_status` = 'paid_in_full' AND NOT EXISTS (
		SELECT 1 FROM `booking_funding_reconciliations` funding
		WHERE funding.`booking_id` = NEW.`id` AND funding.`active_key` = NEW.`id`
			AND funding.`environment` = 'production' AND (funding.`integrity_state` = 'production_verified' OR EXISTS(
 SELECT 1 FROM sandbox_funding_acceptances a JOIN sandbox_funding_decisions d ON d.acceptance_id=a.id AND d.decision='approve'
 WHERE a.reconciliation_id=funding.id AND a.reconciliation_version=funding.version
 AND json_extract(a.source_json,'$.client_price_cents')=NEW.client_price_cents
 AND json_extract(a.source_json,'$.provider_reference')=funding.provider_reference
 AND json_extract(a.source_json,'$.mode')='simulator'
 AND json_extract(a.source_json,'$.policyVersion')=(SELECT policy_version FROM sandbox_completion_instance WHERE mode='sandbox')
 AND julianday(a.expires_at)>julianday('now')))
			AND funding.`status` = 'cleared_reconciled'
			AND funding.`expected_amount_cents` = NEW.`client_price_cents`
			AND funding.`cleared_amount_cents` = NEW.`client_price_cents`
			AND funding.`evidence_reference` IS NOT NULL AND funding.`evidence_verified_at` IS NOT NULL
	) THEN RAISE(ABORT, 'production_cleared_reconciled_funding_required') END);
	SELECT (CASE WHEN OLD.`funding_status` = 'paid_in_full' AND NEW.`funding_status` <> 'paid_in_full' AND EXISTS (
		SELECT 1 FROM `offers` offer WHERE offer.`booking_id` = OLD.`id` AND offer.`status` IN ('open','accepted')
	) THEN RAISE(ABORT, 'open_offer_requires_funding_hold') END);
END;

-- Central 0073 finance source consumption, isolated SANDBOX_DB only.
CREATE UNIQUE INDEX sandbox_training_finance_once ON sandbox_training_entitlements(json_extract(source_json,'$.workspace'),json_extract(source_json,'$.financeEntitlementId')) WHERE json_extract(source_json,'$.contract')='lokd.finance-training-readiness.v1';
CREATE TRIGGER sandbox_training_finance_fence BEFORE INSERT ON sandbox_training_entitlements
WHEN json_extract(NEW.source_json,'$.contract')='lokd.finance-training-readiness.v1'
BEGIN
 SELECT CASE WHEN json_extract(NEW.source_json,'$.financeFence.records')<>coalesce((SELECT max(sequence) FROM finance_records WHERE workspace_id=json_extract(NEW.source_json,'$.workspace')),0)
 OR json_extract(NEW.source_json,'$.financeFence.evidence')<>coalesce((SELECT max(sequence) FROM finance_provider_evidence WHERE workspace_id=json_extract(NEW.source_json,'$.workspace')),0)
 OR json_extract(NEW.source_json,'$.financeFence.conflicts')<>(SELECT count(*) FROM finance_provider_conflicts WHERE workspace_id=json_extract(NEW.source_json,'$.workspace'))
 THEN RAISE(ABORT,'Finance source changed during training import') END;
END;
-- A new version or provider observation cannot silently preserve a qualification
-- based on the old financial source. Even a later favourable recovery needs review.
CREATE TRIGGER sandbox_training_finance_record_hold AFTER INSERT ON finance_records BEGIN
 INSERT INTO sandbox_training_revocations
 SELECT e.id,'finance-command:'||NEW.command_id,'Finance source version changed',NEW.created_at
 FROM sandbox_training_entitlements e WHERE json_extract(e.source_json,'$.workspace')=NEW.workspace_id
 AND NEW.id IN(SELECT value FROM json_each(e.source_json,'$.financeRecordIds'))
 AND NOT EXISTS(SELECT 1 FROM sandbox_training_revocations r WHERE r.entitlement_id=e.id);
END;
CREATE TRIGGER sandbox_training_finance_evidence_hold AFTER INSERT ON finance_provider_evidence BEGIN
 INSERT INTO sandbox_training_revocations
 SELECT e.id,'finance-evidence:'||NEW.sequence,'Payment evidence changed after qualification source import',NEW.created_at
 FROM sandbox_training_entitlements e WHERE json_extract(e.source_json,'$.workspace')=NEW.workspace_id
 AND NEW.operation_id IN(SELECT value FROM json_each(e.source_json,'$.financeRecordIds'))
 AND NOT EXISTS(SELECT 1 FROM sandbox_training_revocations r WHERE r.entitlement_id=e.id);
END;
CREATE TRIGGER sandbox_training_finance_conflict_hold AFTER INSERT ON finance_provider_conflicts BEGIN
 INSERT INTO sandbox_training_revocations
 SELECT e.id,'finance-conflict:'||NEW.id,'Payment evidence conflict',strftime('%Y-%m-%dT%H:%M:%fZ','now')
 FROM sandbox_training_entitlements e WHERE json_extract(e.source_json,'$.workspace')=NEW.workspace_id
 AND NEW.operation_id IN(SELECT value FROM json_each(e.source_json,'$.financeRecordIds'))
 AND NOT EXISTS(SELECT 1 FROM sandbox_training_revocations r WHERE r.entitlement_id=e.id);
END;
