CREATE TABLE `client_enquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`email_normalized` text NOT NULL,
	`mobile_normalized` text,
	`site_area` text NOT NULL,
	`site_type` text NOT NULL,
	`required_start` text NOT NULL,
	`message` text NOT NULL,
	`service_type` text DEFAULT 'scheduled_unarmed_fixed_site' NOT NULL,
	`funding_model` text DEFAULT 'advance_only' NOT NULL,
	`credit_terms_days` integer DEFAULT 0 NOT NULL,
	`privacy_notice_version` text NOT NULL,
	`privacy_acknowledged_at` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`owner_id` text,
	`resolution` text,
	`environment` text DEFAULT 'prelaunch' NOT NULL,
	`integrity_state` text DEFAULT 'user_submitted' NOT NULL,
	`retention_review_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `client_enquiries_queue_idx` ON `client_enquiries` (`environment`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `client_enquiries_email_idx` ON `client_enquiries` (`email_normalized`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `client_enquiry_insert_guard_v30`
BEFORE INSERT ON `client_enquiries`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'prelaunch' OR NEW.`integrity_state` <> 'user_submitted'
		OR NEW.`service_type` <> 'scheduled_unarmed_fixed_site'
		OR NEW.`funding_model` <> 'advance_only' OR NEW.`credit_terms_days` <> 0
		OR NEW.`status` <> 'new' OR NEW.`owner_id` IS NOT NULL OR NEW.`resolution` IS NOT NULL
		OR NEW.`version` <> 1 OR length(trim(NEW.`privacy_notice_version`)) < 3
		OR NEW.`privacy_acknowledged_at` IS NULL OR NEW.`retention_review_at` <= NEW.`created_at`
	THEN RAISE(ABORT, 'client_enquiry_control_boundary_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `client_enquiry_update_guard_v30`
BEFORE UPDATE ON `client_enquiries`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NOT ((OLD.`status` = 'new' AND NEW.`status` IN ('triaged','closed'))
		OR (OLD.`status` = 'triaged' AND NEW.`status` = 'closed'))
		OR NEW.`owner_id` IS NULL OR length(trim(NEW.`owner_id`)) < 3
		OR (NEW.`status` = 'triaged' AND NEW.`resolution` IS NOT NULL)
		OR (NEW.`status` = 'closed' AND (NEW.`resolution` IS NULL OR length(trim(NEW.`resolution`)) < 3))
		OR NEW.`version` <> OLD.`version` + 1 OR NEW.`updated_at` <= OLD.`updated_at`
		OR NEW.`id` <> OLD.`id` OR NEW.`organisation_name` <> OLD.`organisation_name`
		OR NEW.`contact_name` <> OLD.`contact_name` OR NEW.`email_normalized` <> OLD.`email_normalized`
		OR COALESCE(NEW.`mobile_normalized`,'') <> COALESCE(OLD.`mobile_normalized`,'')
		OR NEW.`site_area` <> OLD.`site_area` OR NEW.`site_type` <> OLD.`site_type`
		OR NEW.`required_start` <> OLD.`required_start` OR NEW.`message` <> OLD.`message`
		OR NEW.`service_type` <> OLD.`service_type` OR NEW.`funding_model` <> OLD.`funding_model`
		OR NEW.`credit_terms_days` <> OLD.`credit_terms_days`
		OR NEW.`privacy_notice_version` <> OLD.`privacy_notice_version`
		OR NEW.`privacy_acknowledged_at` <> OLD.`privacy_acknowledged_at`
		OR NEW.`environment` <> OLD.`environment` OR NEW.`integrity_state` <> OLD.`integrity_state`
		OR NEW.`retention_review_at` <> OLD.`retention_review_at` OR NEW.`created_at` <> OLD.`created_at`
	THEN RAISE(ABORT, 'client_enquiry_controlled_transition_required') END);
END;--> statement-breakpoint
CREATE TRIGGER `client_enquiry_delete_guard_v30`
BEFORE DELETE ON `client_enquiries`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'client_enquiry_history_required'); END;
