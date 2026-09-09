CREATE TABLE `agreement_document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`document_code` text NOT NULL,
	`document_version` text NOT NULL,
	`entity_id` text NOT NULL,
	`locale` text NOT NULL,
	`content_hash` text NOT NULL,
	`document_reference` text NOT NULL,
	`status` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agreement_document_version_idx` ON `agreement_document_versions` (`document_code`,`document_version`,`entity_id`,`locale`);
--> statement-breakpoint
CREATE TRIGGER agreement_document_epoch AFTER INSERT ON agreement_document_versions
BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;
--> statement-breakpoint
CREATE TRIGGER agreement_document_no_update BEFORE UPDATE ON agreement_document_versions
BEGIN SELECT RAISE(ABORT, 'Agreement document versions are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER agreement_document_no_delete BEFORE DELETE ON agreement_document_versions
BEGIN SELECT RAISE(ABORT, 'Agreement document versions are append-only'); END;
