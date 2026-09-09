CREATE TABLE `agreement_receipt_revocations` (
	`receipt_id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`revoked_by` text NOT NULL,
	`revoked_at` text NOT NULL,
	FOREIGN KEY (`receipt_id`) REFERENCES `agreement_acceptance_receipts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `contracting_entity_id` text;--> statement-breakpoint
CREATE INDEX `agreement_receipt_context_idx` ON `agreement_acceptance_receipts` (`context_hash`);
--> statement-breakpoint
CREATE TRIGGER agreement_epoch_agreement_acceptance_receipts_insert AFTER INSERT ON agreement_acceptance_receipts
BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;
--> statement-breakpoint
CREATE TRIGGER agreement_epoch_agreement_receipt_revocations_insert AFTER INSERT ON agreement_receipt_revocations
BEGIN UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE singleton=1; END;
--> statement-breakpoint
CREATE TRIGGER agreement_revocation_no_update BEFORE UPDATE ON agreement_receipt_revocations
BEGIN SELECT RAISE(ABORT, 'Agreement revocations are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER agreement_revocation_no_delete BEFORE DELETE ON agreement_receipt_revocations
BEGIN SELECT RAISE(ABORT, 'Agreement revocations are append-only'); END;
