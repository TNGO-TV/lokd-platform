CREATE TABLE `production_client_decisions` (
	`review_id` text PRIMARY KEY NOT NULL,
	`decision` text NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`decided_at` text NOT NULL,
	FOREIGN KEY (`review_id`) REFERENCES `production_client_reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_client_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`case_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`owner_user_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`snapshot_hash` text NOT NULL,
	`evidence_json` text NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `production_client_suspensions` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER production_client_review_immutable BEFORE UPDATE ON production_client_reviews BEGIN SELECT RAISE(ABORT,'Client review evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_review_no_delete BEFORE DELETE ON production_client_reviews BEGIN SELECT RAISE(ABORT,'Client review history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_decision_immutable BEFORE UPDATE ON production_client_decisions BEGIN SELECT RAISE(ABORT,'Client review decisions are immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_decision_no_delete BEFORE DELETE ON production_client_decisions BEGIN SELECT RAISE(ABORT,'Client decision history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_suspension_immutable BEFORE UPDATE ON production_client_suspensions BEGIN SELECT RAISE(ABORT,'Client suspension history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_suspension_no_delete BEFORE DELETE ON production_client_suspensions BEGIN SELECT RAISE(ABORT,'Client suspension history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_decision_guard BEFORE INSERT ON production_client_decisions BEGIN
 SELECT (CASE WHEN NEW.decision NOT IN ('approve','reject') OR NOT EXISTS(SELECT 1 FROM production_client_reviews r WHERE r.id=NEW.review_id AND r.prepared_by!=NEW.actor_id AND r.owner_user_id!=NEW.actor_id) THEN RAISE(ABORT,'Independent client review decision required') END);
 SELECT (CASE WHEN NEW.decision='approve' AND NOT EXISTS(
 SELECT 1 FROM production_client_reviews r JOIN clients x ON x.id=r.client_id
 JOIN production_entity_links l ON l.kind='client' AND l.entity_id=x.id AND l.case_id=r.case_id AND l.case_version=r.case_version
 JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=r.case_version AND c.owner_user_id=r.owner_user_id AND c.status='reviewed'
 WHERE r.id=NEW.review_id AND r.expires_at>NEW.decided_at AND x.environment='production'
 AND json_extract(r.snapshot_json,'$.organisationName')=x.organisation_name AND json_extract(r.snapshot_json,'$.contactName')=x.contact_name AND json_extract(r.snapshot_json,'$.email')=x.contact_email
 AND length(trim(json_extract(r.evidence_json,'$.identity')))>=3 AND length(trim(json_extract(r.evidence_json,'$.company')))>=3 AND length(trim(json_extract(r.evidence_json,'$.authority')))>=3
 AND NOT EXISTS(SELECT 1 FROM production_client_suspensions s WHERE s.client_id=x.id AND s.created_at>=r.prepared_at)
 ) THEN RAISE(ABORT,'Client review is stale or incomplete') END);
END;
--> statement-breakpoint
DROP TRIGGER client_provenance_immutable_v5;
--> statement-breakpoint
CREATE TRIGGER client_provenance_immutable_v5 BEFORE UPDATE OF environment,integrity_state ON clients
WHEN (NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state)
AND NOT (OLD.environment='production' AND NEW.environment='production' AND OLD.integrity_state='production_candidate' AND NEW.integrity_state='production_verified' AND NEW.approval_status='approved'
AND EXISTS(SELECT 1 FROM production_client_reviews r JOIN production_client_decisions d ON d.review_id=r.id AND d.decision='approve' JOIN production_entity_links l ON l.entity_id=NEW.id AND l.kind='client' AND l.case_version=r.case_version JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=r.case_version AND c.status='reviewed' WHERE r.client_id=NEW.id AND r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND NOT EXISTS(SELECT 1 FROM production_client_suspensions s WHERE s.client_id=NEW.id AND s.created_at>=r.prepared_at)))
BEGIN SELECT RAISE(ABORT,'client_provenance_immutable'); END;
--> statement-breakpoint
DROP TRIGGER production_candidate_cannot_approve;
--> statement-breakpoint
CREATE TRIGGER production_candidate_cannot_approve BEFORE UPDATE OF approval_status ON clients
WHEN NEW.approval_status='approved' AND EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=NEW.id)
AND NOT EXISTS(SELECT 1 FROM production_client_reviews r JOIN production_client_decisions d ON d.review_id=r.id AND d.decision='approve' JOIN production_entity_links l ON l.kind='client' AND l.entity_id=NEW.id AND l.case_version=r.case_version JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=r.case_version AND c.status='reviewed' WHERE r.client_id=NEW.id AND r.expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now') AND NOT EXISTS(SELECT 1 FROM production_client_suspensions s WHERE s.client_id=NEW.id AND s.created_at>=r.prepared_at))
BEGIN SELECT RAISE(ABORT,'Candidate intake is not verified production evidence'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_apply_decision AFTER INSERT ON production_client_decisions BEGIN
 UPDATE clients SET approval_status='approved',integrity_state='production_verified' WHERE id=(SELECT client_id FROM production_client_reviews WHERE id=NEW.review_id) AND NEW.decision='approve';
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.actor_id,'client_review_decided','client_review',NEW.review_id,NEW.decision||': '||NEW.reason,NEW.decided_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.decided_at WHERE singleton=1;
END;
--> statement-breakpoint
CREATE TRIGGER production_client_apply_suspension AFTER INSERT ON production_client_suspensions BEGIN
 UPDATE clients SET approval_status='suspended' WHERE id=NEW.client_id AND environment='production';
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.actor_id,'client_suspended','client',NEW.client_id,NEW.reason,NEW.created_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.created_at WHERE singleton=1;
END;
--> statement-breakpoint
CREATE TRIGGER production_client_intake_invalidation AFTER UPDATE ON signup_cases WHEN NEW.kind='client' AND NEW.version!=OLD.version BEGIN
 UPDATE clients SET approval_status='suspended' WHERE approval_status='approved' AND id IN(SELECT entity_id FROM production_entity_links WHERE kind='client' AND case_id=NEW.source_id);
END;

--> statement-breakpoint
DROP TRIGGER production_link_no_update;
--> statement-breakpoint
CREATE TRIGGER production_link_no_update BEFORE UPDATE ON production_entity_links BEGIN
 SELECT (CASE WHEN NEW.kind!=OLD.kind OR NEW.case_id!=OLD.case_id OR NEW.entity_id!=OLD.entity_id OR NEW.owner_user_id!=OLD.owner_user_id OR NEW.case_version<=OLD.case_version THEN RAISE(ABORT,'Production entity identity binding is immutable') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.kind=NEW.kind AND c.source_id=NEW.case_id AND c.version=NEW.case_version AND c.owner_user_id=NEW.owner_user_id AND c.status='reviewed') THEN RAISE(ABORT,'Reviewed intake changed during reconciliation') END);
 SELECT (CASE WHEN (NEW.kind='client' AND NOT EXISTS(SELECT 1 FROM clients WHERE id=NEW.entity_id AND approval_status IN ('pending','suspended'))) OR (NEW.kind='officer' AND NOT EXISTS(SELECT 1 FROM officers WHERE id=NEW.entity_id AND approval_status IN ('pending','suspended'))) THEN RAISE(ABORT,'Suspend operational approval before changing reviewed details') END);
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.prepared_by,'production_entity_reconciled',NEW.kind,NEW.entity_id,json_object('priorVersion',OLD.case_version,'version',NEW.case_version,'caseId',NEW.case_id),NEW.prepared_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.prepared_at WHERE singleton=1;
END;

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
CREATE TRIGGER production_client_details_invalidation AFTER UPDATE OF organisation_name,contact_name,contact_email ON clients
WHEN OLD.approval_status='approved' AND (OLD.organisation_name IS NOT NEW.organisation_name OR OLD.contact_name IS NOT NEW.contact_name OR OLD.contact_email IS NOT NEW.contact_email)
AND EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind='client' AND l.entity_id=NEW.id)
BEGIN INSERT INTO production_client_suspensions VALUES(lower(hex(randomblob(16))),NEW.id,'system','Approved client details changed',strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
--> statement-breakpoint
CREATE TRIGGER production_client_activation_commit_guard BEFORE UPDATE OF state ON assignment_activation_commands
WHEN NEW.state='activated' AND EXISTS(SELECT 1 FROM roster_slots r JOIN bookings b ON b.id=r.booking_id JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id WHERE r.id=NEW.roster_slot_id)
AND NOT EXISTS(SELECT 1 FROM roster_slots r JOIN bookings b ON b.id=r.booking_id JOIN current_production_client_approvals a ON a.client_id=b.client_id WHERE r.id=NEW.roster_slot_id)
BEGIN SELECT RAISE(ABORT,'Client approval changed or expired before activation'); END;
--> statement-breakpoint
CREATE TRIGGER production_client_checkin_commit_guard BEFORE UPDATE OF status ON shifts
WHEN NEW.status='on_post' AND EXISTS(SELECT 1 FROM bookings b JOIN production_entity_links l ON l.kind='client' AND l.entity_id=b.client_id WHERE b.id=NEW.booking_id)
AND NOT EXISTS(SELECT 1 FROM bookings b JOIN current_production_client_approvals a ON a.client_id=b.client_id WHERE b.id=NEW.booking_id)
BEGIN SELECT RAISE(ABORT,'Client approval changed or expired before check-in'); END;
