CREATE TABLE `production_entity_links` (
	`kind` text NOT NULL,
	`case_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`owner_user_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL,
	PRIMARY KEY(`kind`, `case_id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_entity_link_idx` ON `production_entity_links` (`kind`,`entity_id`);--> statement-breakpoint
CREATE TABLE `production_envelope_cancellations` (
	`envelope_id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`cancelled_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `production_signing_envelopes` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`role` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`case_kind` text NOT NULL,
	`case_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`roster_slot_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`slot_version` integer NOT NULL,
	`context_json` text NOT NULL,
	`context_hash` text NOT NULL,
	`content_hash` text NOT NULL,
	`identity_evidence` text NOT NULL,
	`authority_evidence` text,
	`issued_by` text NOT NULL,
	`issued_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `production_envelope_owner_idx` ON `production_signing_envelopes` (`owner_user_id`,`issued_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_envelope_binding_idx` ON `production_signing_envelopes` (`owner_user_id`,`document_id`,`context_hash`);--> statement-breakpoint
CREATE TABLE `signing_document_bodies` (
	`id` text PRIMARY KEY NOT NULL,
	`document_code` text NOT NULL,
	`document_version` text NOT NULL,
	`entity_id` text NOT NULL,
	`locale` text NOT NULL,
	`wording` text NOT NULL,
	`content_hash` text NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signing_document_withdrawals` (
	`document_id` text PRIMARY KEY NOT NULL,
	`withdrawn_by` text NOT NULL,
	`reason` text NOT NULL,
	`withdrawn_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER live_signing_commit_guard BEFORE INSERT ON agreement_acceptance_receipts WHEN NEW.id LIKE 'LIVE-SIGN-%' AND NOT EXISTS(
 SELECT 1 FROM production_signing_envelopes e JOIN signup_cases c ON c.kind=e.case_kind AND c.source_id=e.case_id
 JOIN agreement_document_versions d ON d.id=e.document_id JOIN roster_slots r ON r.id=e.roster_slot_id
 WHERE NEW.id='LIVE-SIGN-'||e.id AND c.version=e.case_version AND c.owner_user_id=e.owner_user_id AND c.status!='withdrawn'
 AND r.version=e.slot_version AND d.status='approved' AND d.environment='production' AND d.integrity_state='production_verified'
 AND json_extract(NEW.receipt_json,'$.actorUserId')=e.owner_user_id AND NEW.context_hash=e.context_hash
 AND json_extract(NEW.receipt_json,'$.contentHash')=e.content_hash AND d.content_hash=e.content_hash
 AND e.expires_at>json_extract(NEW.receipt_json,'$.acceptedAt')
 AND json_extract(NEW.receipt_json,'$.evidenceRevision')=(SELECT revision FROM activation_evidence_epoch WHERE singleton=1)
 AND NOT EXISTS(SELECT 1 FROM production_envelope_cancellations x WHERE x.envelope_id=e.id)
 AND NOT EXISTS(SELECT 1 FROM signing_document_withdrawals w WHERE w.document_id=d.id)
) BEGIN SELECT RAISE(ABORT,'Signing evidence changed before acceptance'); END;
--> statement-breakpoint
CREATE TRIGGER signing_withdrawal_epoch AFTER INSERT ON signing_document_withdrawals BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;
--> statement-breakpoint
CREATE TRIGGER production_link_no_update BEFORE UPDATE ON production_entity_links BEGIN
 SELECT CASE WHEN NEW.kind!=OLD.kind OR NEW.case_id!=OLD.case_id OR NEW.entity_id!=OLD.entity_id OR NEW.owner_user_id!=OLD.owner_user_id OR NEW.case_version<=OLD.case_version THEN RAISE(ABORT,'Production entity identity binding is immutable') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.kind=NEW.kind AND c.source_id=NEW.case_id AND c.version=NEW.case_version AND c.owner_user_id=NEW.owner_user_id AND c.status='reviewed') THEN RAISE(ABORT,'Reviewed intake changed during reconciliation') END;
 SELECT CASE WHEN (NEW.kind='client' AND NOT EXISTS(SELECT 1 FROM clients WHERE id=NEW.entity_id AND approval_status='pending')) OR (NEW.kind='officer' AND NOT EXISTS(SELECT 1 FROM officers WHERE id=NEW.entity_id AND approval_status='pending')) THEN RAISE(ABORT,'Suspend operational approval before changing reviewed details') END;
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.prepared_by,'production_entity_reconciled',NEW.kind,NEW.entity_id,json_object('priorVersion',OLD.case_version,'version',NEW.case_version,'caseId',NEW.case_id),NEW.prepared_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.prepared_at WHERE singleton=1;
END;
--> statement-breakpoint
CREATE TRIGGER production_link_no_delete BEFORE DELETE ON production_entity_links BEGIN SELECT RAISE(ABORT,'Production entity binding is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER signing_body_no_update BEFORE UPDATE ON signing_document_bodies BEGIN SELECT RAISE(ABORT,'Document wording is immutable; create a new version'); END;
--> statement-breakpoint
CREATE TRIGGER signing_body_no_delete BEFORE DELETE ON signing_document_bodies BEGIN SELECT RAISE(ABORT,'Document history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_envelope_no_update BEFORE UPDATE ON production_signing_envelopes BEGIN SELECT RAISE(ABORT,'Signing envelope is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_envelope_no_delete BEFORE DELETE ON production_signing_envelopes BEGIN SELECT RAISE(ABORT,'Signing history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER signing_withdrawal_no_update BEFORE UPDATE ON signing_document_withdrawals BEGIN SELECT RAISE(ABORT,'Document withdrawal is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER signing_withdrawal_no_delete BEFORE DELETE ON signing_document_withdrawals BEGIN SELECT RAISE(ABORT,'Document withdrawal is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_cancel_no_update BEFORE UPDATE ON production_envelope_cancellations BEGIN SELECT RAISE(ABORT,'Cancellation history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_cancel_no_delete BEFORE DELETE ON production_envelope_cancellations BEGIN SELECT RAISE(ABORT,'Cancellation history is immutable'); END;
