-- Independent enquiries are never deduplicated by contact details.
-- A random caller-held key can replay only the exact normalized submission.
CREATE TABLE client_enquiry_receipts (
  request_key_hash TEXT PRIMARY KEY NOT NULL,
  payload_hash TEXT NOT NULL,
  enquiry_id TEXT NOT NULL UNIQUE REFERENCES client_enquiries(id),
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER client_enquiry_receipts_immutable_update BEFORE UPDATE ON client_enquiry_receipts
BEGIN SELECT RAISE(ABORT,'enquiry_receipt_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER client_enquiry_receipts_immutable_delete BEFORE DELETE ON client_enquiry_receipts
BEGIN SELECT RAISE(ABORT,'enquiry_receipt_history_required'); END;

--> statement-breakpoint
-- Match the existing public service choices while preserving every intake hold.
DROP TRIGGER client_enquiry_insert_guard_v30;
--> statement-breakpoint
CREATE TRIGGER `client_enquiry_insert_guard_v30`
BEFORE INSERT ON `client_enquiries`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'prelaunch' OR NEW.`integrity_state` <> 'user_submitted'
		OR NEW.`service_type` NOT IN ('scheduled_unarmed_fixed_site','armed_static','armed_movement','vip_unarmed','vip_armed','vip_protective_driver','vip_team')
		OR NEW.`funding_model` <> 'advance_only' OR NEW.`credit_terms_days` <> 0
		OR NEW.`status` <> 'new' OR NEW.`owner_id` IS NOT NULL OR NEW.`resolution` IS NOT NULL
		OR NEW.`version` <> 1 OR length(trim(NEW.`privacy_notice_version`)) < 3
		OR NEW.`privacy_acknowledged_at` IS NULL OR NEW.`retention_review_at` <= NEW.`created_at`
	THEN RAISE(ABORT, 'client_enquiry_control_boundary_invalid') END);
END;--> statement-breakpoint
