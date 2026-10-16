-- Anonymous contact details never deduplicate or establish ownership.
-- Immutable caller-held keys recover only the same normalized submission.
CREATE TABLE officer_application_receipts (
 request_key_hash TEXT PRIMARY KEY NOT NULL,
 payload_hash TEXT NOT NULL,
 application_id TEXT NOT NULL UNIQUE REFERENCES officer_applications(id),
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER officer_application_receipts_immutable_update BEFORE UPDATE ON officer_application_receipts
BEGIN SELECT RAISE(ABORT,'application_receipt_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER officer_application_receipts_immutable_delete BEFORE DELETE ON officer_application_receipts
BEGIN SELECT RAISE(ABORT,'application_receipt_history_required'); END;
