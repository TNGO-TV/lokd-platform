CREATE TABLE `payroll_shadow_validation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`policy_id` text NOT NULL,
	`policy_hash` text NOT NULL,
	`engine_version` text NOT NULL,
	`status` text NOT NULL,
	`scenario_count` integer NOT NULL,
	`passed_count` integer NOT NULL,
	`failed_count` integer NOT NULL,
	`result_json` text NOT NULL,
	`result_hash` text NOT NULL,
	`activation_eligible` integer DEFAULT 0 NOT NULL,
	`settlement_locked` integer DEFAULT 1 NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`run_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`policy_id`) REFERENCES `payroll_policy_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_shadow_validation_policy_idx` ON `payroll_shadow_validation_runs` (`policy_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `payroll_shadow_validation_status_idx` ON `payroll_shadow_validation_runs` (`environment`,`status`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `payroll_shadow_validation_insert_guard_v29`
BEFORE INSERT ON `payroll_shadow_validation_runs`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`activation_eligible` <> 0 OR NEW.`settlement_locked` <> 1
		OR NEW.`scenario_count` < 1 OR NEW.`passed_count` + NEW.`failed_count` <> NEW.`scenario_count`
		OR json_valid(NEW.`result_json`) <> 1 OR length(NEW.`result_hash`) <> 64
		OR NOT EXISTS (
			SELECT 1 FROM `payroll_policy_versions` policy
			WHERE policy.`id` = NEW.`policy_id` AND policy.`policy_hash` = NEW.`policy_hash`
				AND policy.`environment` = NEW.`environment` AND policy.`integrity_state` = NEW.`integrity_state`
		) OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` account
			JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
			WHERE account.`id` = NEW.`run_by` AND account.`environment` = NEW.`environment`
				AND account.`integrity_state` = NEW.`integrity_state` AND account.`status` = 'active'
				AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
				AND datetime(account.`mfa_verified_at`, '+30 minutes') >= datetime('now')
				AND role.`role` = 'payroll_preparer' AND role.`status` = 'active'
				AND role.`environment` = NEW.`environment` AND role.`integrity_state` = NEW.`integrity_state`
		)
	THEN RAISE(ABORT, 'payroll_shadow_validation_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `payroll_shadow_validation_update_guard_v29`
BEFORE UPDATE ON `payroll_shadow_validation_runs`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'payroll_shadow_validation_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `payroll_shadow_validation_delete_guard_v29`
BEFORE DELETE ON `payroll_shadow_validation_runs`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'payroll_shadow_validation_append_only'); END;--> statement-breakpoint
CREATE TABLE `payroll_export_previews` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_run_id` text NOT NULL,
	`export_type` text NOT NULL,
	`mime_type` text NOT NULL,
	`content_hash` text NOT NULL,
	`file_name` text NOT NULL,
	`row_count` integer NOT NULL,
	`status` text DEFAULT 'shadow_generated' NOT NULL,
	`watermark` text DEFAULT 'SHADOW ONLY - NOT FOR SUBMISSION OR PAYMENT' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_export_preview_run_type_idx` ON `payroll_export_previews` (`payroll_run_id`,`export_type`,`version`);--> statement-breakpoint
CREATE INDEX `payroll_export_preview_status_idx` ON `payroll_export_previews` (`environment`,`status`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `payroll_export_preview_insert_guard_v29`
BEFORE INSERT ON `payroll_export_previews`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`status` <> 'shadow_generated'
		OR NEW.`watermark` <> 'SHADOW ONLY - NOT FOR SUBMISSION OR PAYMENT'
		OR NEW.`export_type` NOT IN ('payroll_register','emp201_summary','payslip_preview')
		OR length(NEW.`content_hash`) <> 64 OR NEW.`row_count` < 1
		OR NOT EXISTS (
			SELECT 1 FROM `payroll_runs` run
			WHERE run.`id` = NEW.`payroll_run_id` AND run.`status` = 'approved_for_export'
				AND run.`approved_by` IS NOT NULL AND run.`second_approved_by` IS NOT NULL
				AND run.`settlement_reference` IS NULL AND run.`settled_at` IS NULL
				AND run.`environment` = NEW.`environment` AND run.`integrity_state` = NEW.`integrity_state`
		) OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` account
			JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
			JOIN `payroll_runs` run ON run.`id` = NEW.`payroll_run_id`
			WHERE account.`id` = NEW.`created_by` AND account.`environment` = NEW.`environment`
				AND account.`integrity_state` = NEW.`integrity_state` AND account.`status` = 'active'
				AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
				AND datetime(account.`mfa_verified_at`, '+15 minutes') >= datetime('now')
				AND account.`id` NOT IN (run.`approved_by`, run.`second_approved_by`)
				AND role.`role` = 'payroll_preparer' AND role.`status` = 'active'
				AND role.`environment` = NEW.`environment` AND role.`integrity_state` = NEW.`integrity_state`
		)
	THEN RAISE(ABORT, 'shadow_export_requires_approved_unsettled_payroll') END);
END;--> statement-breakpoint
CREATE TRIGGER `payroll_export_preview_update_guard_v29`
BEFORE UPDATE ON `payroll_export_previews`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'payroll_export_preview_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `payroll_export_preview_delete_guard_v29`
BEFORE DELETE ON `payroll_export_previews`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'payroll_export_preview_append_only'); END;--> statement-breakpoint
CREATE TABLE `payroll_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_run_id` text NOT NULL,
	`code` text NOT NULL,
	`severity` text NOT NULL,
	`detail` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`evidence_reference` text,
	`created_by` text NOT NULL,
	`resolved_by` text,
	`created_at` text NOT NULL,
	`resolved_at` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`resolved_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payroll_exceptions_queue_idx` ON `payroll_exceptions` (`environment`,`status`,`severity`,`created_at`);--> statement-breakpoint
CREATE INDEX `payroll_exceptions_run_idx` ON `payroll_exceptions` (`payroll_run_id`,`status`);--> statement-breakpoint
CREATE TRIGGER `payroll_exception_resolution_guard_v29`
BEFORE UPDATE ON `payroll_exceptions`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN OLD.`status` <> 'open' OR NEW.`status` <> 'resolved'
		OR NEW.`resolved_by` IS NULL OR NEW.`resolved_at` IS NULL
		OR NEW.`evidence_reference` IS NULL OR length(trim(NEW.`evidence_reference`)) < 8
		OR NEW.`id` <> OLD.`id` OR NEW.`payroll_run_id` <> OLD.`payroll_run_id`
		OR NEW.`code` <> OLD.`code` OR NEW.`severity` <> OLD.`severity`
		OR NEW.`detail` <> OLD.`detail` OR NEW.`environment` <> OLD.`environment`
		OR NEW.`integrity_state` <> OLD.`integrity_state` OR NEW.`created_by` <> OLD.`created_by`
		OR NEW.`created_at` <> OLD.`created_at` OR NEW.`version` <> OLD.`version` + 1
		OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` account
			JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
			JOIN `payroll_runs` run ON run.`id` = NEW.`payroll_run_id`
			WHERE account.`id` = NEW.`resolved_by` AND account.`environment` = NEW.`environment`
				AND account.`integrity_state` = NEW.`integrity_state` AND account.`status` = 'active'
				AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
				AND datetime(account.`mfa_verified_at`, '+15 minutes') >= datetime('now')
				AND account.`id` <> run.`created_by`
				AND role.`role` = 'payroll_reviewer' AND role.`status` = 'active'
				AND role.`environment` = NEW.`environment` AND role.`integrity_state` = NEW.`integrity_state`
		)
	THEN RAISE(ABORT, 'payroll_exception_resolution_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `payroll_exception_delete_guard_v29`
BEFORE DELETE ON `payroll_exceptions`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'payroll_exception_history_required'); END;--> statement-breakpoint
CREATE TRIGGER `payroll_settlement_lock_v29`
BEFORE UPDATE OF `status`,`settlement_reference`,`settled_at` ON `payroll_runs`
FOR EACH ROW
WHEN NEW.`status` IN ('released_for_settlement','settlement_processing','paid','settled')
	OR NEW.`settlement_reference` IS NOT NULL OR NEW.`settled_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'payroll_settlement_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
CREATE TRIGGER `payroll_settlement_insert_lock_v29`
BEFORE INSERT ON `payroll_runs`
FOR EACH ROW
WHEN NEW.`status` IN ('released_for_settlement','settlement_processing','paid','settled')
	OR NEW.`settlement_reference` IS NOT NULL OR NEW.`settled_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'payroll_settlement_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
CREATE TRIGGER `payroll_disbursement_insert_lock_v29`
BEFORE INSERT ON `disbursement_batches`
FOR EACH ROW
BEGIN
	SELECT RAISE(ABORT, 'payroll_disbursement_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
CREATE TRIGGER `payroll_disbursement_update_lock_v29`
BEFORE UPDATE OF `status`,`provider_reference`,`evidence_reference`,`settled_at` ON `disbursement_batches`
FOR EACH ROW
WHEN NEW.`status` <> 'draft' OR NEW.`provider_reference` IS NOT NULL
	OR NEW.`evidence_reference` IS NOT NULL OR NEW.`settled_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'payroll_disbursement_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
CREATE TRIGGER `payroll_disbursement_item_insert_lock_v29`
BEFORE INSERT ON `disbursement_items`
FOR EACH ROW
BEGIN
	SELECT RAISE(ABORT, 'payroll_disbursement_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
CREATE TRIGGER `payroll_disbursement_item_update_lock_v29`
BEFORE UPDATE ON `disbursement_items`
FOR EACH ROW
BEGIN
	SELECT RAISE(ABORT, 'payroll_disbursement_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
CREATE TRIGGER `payroll_payslip_insert_lock_v29`
BEFORE INSERT ON `payslips`
FOR EACH ROW
BEGIN
	SELECT RAISE(ABORT, 'payroll_payslip_issue_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
CREATE TRIGGER `payroll_payslip_update_lock_v29`
BEFORE UPDATE ON `payslips`
FOR EACH ROW
BEGIN
	SELECT RAISE(ABORT, 'payroll_payslip_issue_locked_until_controlled_pilot_authorisation');
END;--> statement-breakpoint
UPDATE `operator_action_policies` SET `label` = 'Create controlled shadow exports',
	`updated_at` = datetime('now'), `version` = `version` + 1
WHERE `environment` = 'demo' AND `integrity_state` = 'synthetic'
	AND `action_code` = 'payroll.export';
