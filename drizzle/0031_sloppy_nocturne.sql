CREATE TABLE `agreement_acceptance_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_json` text NOT NULL,
	`receipt_hash` text NOT NULL,
	`context_hash` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER agreement_receipt_no_update BEFORE UPDATE ON agreement_acceptance_receipts
BEGIN SELECT RAISE(ABORT, 'Agreement receipts are append-only'); END;
--> statement-breakpoint
CREATE TRIGGER agreement_receipt_no_delete BEFORE DELETE ON agreement_acceptance_receipts
BEGIN SELECT RAISE(ABORT, 'Agreement receipts are append-only'); END;
