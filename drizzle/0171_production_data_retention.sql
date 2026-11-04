-- Keep the existing immutable-history guards, with a narrowly scoped retention
-- exception using database time. Linked intake and in-flight delivery are held.
DROP TRIGGER IF EXISTS client_enquiry_delete_guard_v30;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_delete_guard_v30 BEFORE DELETE ON client_enquiries
WHEN julianday(OLD.retention_review_at) IS NULL OR julianday(OLD.retention_review_at)>julianday('now')
 OR EXISTS(SELECT 1 FROM signup_cases WHERE source_id=OLD.id)
 OR EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE source_id=OLD.id AND state='dispatching')
BEGIN SELECT RAISE(ABORT,'client_enquiry_history_required'); END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS client_enquiry_receipts_immutable_delete;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_receipts_immutable_delete BEFORE DELETE ON client_enquiry_receipts
WHEN NOT EXISTS(SELECT 1 FROM client_enquiries e WHERE e.id=OLD.enquiry_id
 AND julianday(e.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=e.id))
BEGIN SELECT RAISE(ABORT,'enquiry_receipt_history_required'); END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS officer_application_receipts_immutable_delete;
--> statement-breakpoint
CREATE TRIGGER officer_application_receipts_immutable_delete BEFORE DELETE ON officer_application_receipts
WHEN NOT EXISTS(SELECT 1 FROM officer_applications a WHERE a.id=OLD.application_id
 AND julianday(a.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=a.id))
BEGIN SELECT RAISE(ABORT,'application_receipt_history_required'); END;
--> statement-breakpoint
DROP TRIGGER IF EXISTS operational_delivery_history;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_history BEFORE DELETE ON operational_delivery_jobs
WHEN OLD.kind NOT IN ('enquiry_crm','enquiry_email') OR OLD.state='dispatching' OR NOT EXISTS(
 SELECT 1 FROM client_enquiries e WHERE e.id=OLD.source_id AND julianday(e.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases c WHERE c.source_id=e.id))
BEGIN SELECT RAISE(ABORT,'delivery_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS client_enquiry_retention_children BEFORE DELETE ON client_enquiries
WHEN julianday(OLD.retention_review_at)<=julianday('now')
 AND NOT EXISTS(SELECT 1 FROM signup_cases WHERE source_id=OLD.id)
 AND NOT EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE source_id=OLD.id AND state='dispatching')
BEGIN
 DELETE FROM client_enquiry_receipts WHERE enquiry_id=OLD.id;
 DELETE FROM operational_delivery_jobs WHERE source_id=OLD.id AND kind IN ('enquiry_crm','enquiry_email');
END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS client_enquiries_retention_idx ON client_enquiries(retention_review_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS officer_applications_retention_idx ON officer_applications(retention_review_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS public_presence_expiry_idx ON public_officer_presence(expires_at);
