DROP INDEX `production_envelope_binding_idx`;--> statement-breakpoint
ALTER TABLE `production_signing_envelopes` ADD `issuance_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `production_envelope_binding_idx` ON `production_signing_envelopes` (`owner_user_id`,`document_id`,`context_hash`,`issuance_number`);
--> statement-breakpoint
CREATE TRIGGER production_signup_evidence_changed AFTER UPDATE ON signup_cases WHEN EXISTS(SELECT 1 FROM production_entity_links l WHERE l.kind=NEW.kind AND l.case_id=NEW.source_id) BEGIN
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.updated_at WHERE singleton=1;
END;
--> statement-breakpoint
DROP TRIGGER client_provenance_insert_v5;
--> statement-breakpoint
CREATE TRIGGER client_provenance_insert_v5 BEFORE INSERT ON clients
WHEN NOT ((NEW.environment='demo' AND NEW.integrity_state='synthetic')
 OR (NEW.environment='production' AND NEW.integrity_state='production_verified')
 OR (NEW.environment='production' AND NEW.integrity_state='production_candidate' AND NEW.approval_status='pending'
 AND EXISTS(SELECT 1 FROM production_entity_links l JOIN signup_cases c ON c.kind=l.kind AND c.source_id=l.case_id AND c.version=l.case_version
 WHERE l.kind='client' AND l.entity_id=NEW.id AND c.status='reviewed' AND c.owner_user_id=l.owner_user_id)))
BEGIN SELECT RAISE(ABORT,'client_provenance_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER production_candidate_cannot_approve BEFORE UPDATE ON clients
WHEN OLD.integrity_state='production_candidate' AND NEW.approval_status NOT IN ('pending','suspended','rejected')
BEGIN SELECT RAISE(ABORT,'Candidate intake is not verified production evidence'); END;
