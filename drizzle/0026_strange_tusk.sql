CREATE TABLE `contract_envelopes` (
	`id` text PRIMARY KEY NOT NULL,
	`onboarding_case_id` text NOT NULL,
	`template_version_id` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`variables_json` text NOT NULL,
	`variables_hash` text NOT NULL,
	`document_reference` text NOT NULL,
	`document_hash` text NOT NULL,
	`status` text DEFAULT 'preview' NOT NULL,
	`watermark` text,
	`generated_by` text NOT NULL,
	`approved_by` text,
	`signed_by_email` text,
	`generated_at` text NOT NULL,
	`approved_at` text,
	`signed_at` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`onboarding_case_id`) REFERENCES `onboarding_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_version_id`) REFERENCES `contract_template_versions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`generated_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contract_envelope_case_template_idx` ON `contract_envelopes` (`onboarding_case_id`,`template_version_id`);--> statement-breakpoint
CREATE INDEX `contract_envelope_status_idx` ON `contract_envelopes` (`environment`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `contract_envelope_subject_idx` ON `contract_envelopes` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE TABLE `contract_template_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`template_code` text NOT NULL,
	`label` text NOT NULL,
	`jurisdiction` text DEFAULT 'ZA' NOT NULL,
	`template_version` text NOT NULL,
	`variable_schema_json` text NOT NULL,
	`body_reference` text NOT NULL,
	`template_hash` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`watermark` text,
	`approved_by` text,
	`approved_at` text,
	`effective_from` text,
	`effective_to` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`active_key` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`approved_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contract_template_version_idx` ON `contract_template_versions` (`template_code`,`template_version`,`environment`);--> statement-breakpoint
CREATE UNIQUE INDEX `contract_template_active_idx` ON `contract_template_versions` (`active_key`);--> statement-breakpoint
CREATE INDEX `contract_template_status_idx` ON `contract_template_versions` (`environment`,`status`,`template_code`);--> statement-breakpoint
CREATE TABLE `controlled_pilot_rehearsals` (
	`id` text PRIMARY KEY NOT NULL,
	`flow_version` text NOT NULL,
	`status` text NOT NULL,
	`steps_json` text NOT NULL,
	`steps_hash` text NOT NULL,
	`blockers_json` text NOT NULL,
	`credit_terms_days` integer DEFAULT 0 NOT NULL,
	`funding_model` text DEFAULT 'advance_only' NOT NULL,
	`settlement_locked` integer DEFAULT 1 NOT NULL,
	`production_authorised` integer DEFAULT 0 NOT NULL,
	`run_by` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `controlled_pilot_rehearsal_status_idx` ON `controlled_pilot_rehearsals` (`environment`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `onboarding_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`display_name` text NOT NULL,
	`contact_email_normalized` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`current_stage` text DEFAULT 'details' NOT NULL,
	`owner_id` text NOT NULL,
	`identity_status` text DEFAULT 'pending' NOT NULL,
	`compliance_status` text DEFAULT 'pending' NOT NULL,
	`contract_status` text DEFAULT 'pending' NOT NULL,
	`banking_status` text DEFAULT 'not_required' NOT NULL,
	`access_status` text DEFAULT 'not_invited' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`owner_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_case_subject_idx` ON `onboarding_cases` (`environment`,`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `onboarding_case_queue_idx` ON `onboarding_cases` (`environment`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `onboarding_case_email_idx` ON `onboarding_cases` (`contact_email_normalized`,`status`);--> statement-breakpoint
CREATE TABLE `onboarding_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`required` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`evidence_reference` text,
	`evidence_hash` text,
	`verified_by` text,
	`verified_at` text,
	`expires_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `onboarding_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`verified_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_checklist_case_code_idx` ON `onboarding_checklist_items` (`case_id`,`code`);--> statement-breakpoint
CREATE INDEX `onboarding_checklist_status_idx` ON `onboarding_checklist_items` (`environment`,`status`,`category`);--> statement-breakpoint
CREATE TABLE `workspace_access_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`onboarding_case_id` text NOT NULL,
	`email_normalized` text NOT NULL,
	`role` text NOT NULL,
	`client_id` text,
	`officer_id` text,
	`operator_id` text,
	`status` text DEFAULT 'prepared' NOT NULL,
	`requested_by` text NOT NULL,
	`approved_by` text,
	`requested_at` text NOT NULL,
	`approved_at` text,
	`claimed_at` text,
	`activated_at` text,
	`expires_at` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`active_key` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`onboarding_case_id`) REFERENCES `onboarding_cases`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`requested_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_access_invitation_active_idx` ON `workspace_access_invitations` (`active_key`);--> statement-breakpoint
CREATE INDEX `workspace_access_invitation_email_idx` ON `workspace_access_invitations` (`email_normalized`,`status`);--> statement-breakpoint
CREATE INDEX `workspace_access_invitation_queue_idx` ON `workspace_access_invitations` (`environment`,`status`,`updated_at`);
--> statement-breakpoint
CREATE TRIGGER `onboarding_case_insert_guard_v32`
BEFORE INSERT ON `onboarding_cases`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`subject_type` NOT IN ('client','officer','operations')
		OR NEW.`status` <> 'complete' OR NEW.`current_stage` <> 'ready_for_pilot'
		OR NEW.`identity_status` <> 'verified_demo' OR NEW.`compliance_status` <> 'verified_demo'
		OR NEW.`contract_status` NOT IN ('signed_demo','not_required')
		OR NEW.`banking_status` NOT IN ('verified_demo','not_required')
		OR NEW.`access_status` <> 'active_demo' OR NEW.`completed_at` IS NULL
		OR NEW.`version` <> 1 OR NEW.`updated_at` < NEW.`created_at`
		OR NEW.`contact_email_normalized` <> lower(trim(NEW.`contact_email_normalized`))
		OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` account
			JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
			WHERE account.`id` = NEW.`owner_id` AND account.`environment` = 'demo'
				AND account.`integrity_state` = 'synthetic' AND account.`status` = 'active'
				AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
				AND datetime(account.`mfa_verified_at`, '+30 minutes') >= datetime('now')
				AND role.`role` = 'operations_owner' AND role.`status` = 'active'
				AND role.`environment` = 'demo' AND role.`integrity_state` = 'synthetic'
		) OR (NEW.`subject_type` = 'client' AND (
			NEW.`contract_status` <> 'signed_demo' OR NEW.`banking_status` <> 'not_required'
			OR NOT EXISTS (SELECT 1 FROM `clients` client WHERE client.`id` = NEW.`subject_id`
				AND client.`environment` = 'demo' AND client.`integrity_state` = 'synthetic')
		)) OR (NEW.`subject_type` = 'officer' AND (
			NEW.`contract_status` <> 'signed_demo' OR NEW.`banking_status` <> 'verified_demo'
			OR NOT EXISTS (SELECT 1 FROM `officers` officer WHERE officer.`id` = NEW.`subject_id`
				AND officer.`approval_status` = 'approved' AND officer.`banking_status` = 'verified')
		)) OR (NEW.`subject_type` = 'operations' AND (
			NEW.`subject_id` <> NEW.`owner_id` OR NEW.`contract_status` <> 'not_required'
			OR NEW.`banking_status` <> 'not_required'
		))
	THEN RAISE(ABORT, 'controlled_onboarding_case_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `onboarding_case_update_guard_v32`
BEFORE UPDATE ON `onboarding_cases`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_onboarding_case_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `onboarding_case_delete_guard_v32`
BEFORE DELETE ON `onboarding_cases`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_onboarding_case_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `onboarding_check_insert_guard_v32`
BEFORE INSERT ON `onboarding_checklist_items`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`required` <> 1 OR NEW.`status` <> 'verified_demo'
		OR NEW.`evidence_reference` IS NULL OR length(trim(NEW.`evidence_reference`)) < 12
		OR NEW.`evidence_hash` IS NULL OR length(NEW.`evidence_hash`) <> 64
		OR NEW.`verified_by` IS NULL OR NEW.`verified_at` IS NULL OR NEW.`version` <> 1
		OR NEW.`updated_at` < NEW.`created_at`
		OR NOT EXISTS (SELECT 1 FROM `onboarding_cases` case_record
			WHERE case_record.`id` = NEW.`case_id` AND case_record.`environment` = 'demo'
				AND case_record.`integrity_state` = 'synthetic' AND case_record.`status` = 'complete'
				AND case_record.`owner_id` <> NEW.`verified_by`)
		OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` account
			JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
			WHERE account.`id` = NEW.`verified_by` AND account.`environment` = 'demo'
				AND account.`integrity_state` = 'synthetic' AND account.`status` = 'active'
				AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
				AND datetime(account.`mfa_verified_at`, '+30 minutes') >= datetime('now')
				AND role.`role` = 'compliance_reviewer' AND role.`status` = 'active'
				AND role.`environment` = 'demo' AND role.`integrity_state` = 'synthetic'
		)
	THEN RAISE(ABORT, 'controlled_onboarding_check_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `onboarding_check_update_guard_v32`
BEFORE UPDATE ON `onboarding_checklist_items`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_onboarding_check_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `onboarding_check_delete_guard_v32`
BEFORE DELETE ON `onboarding_checklist_items`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_onboarding_check_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `contract_template_insert_guard_v32`
BEFORE INSERT ON `contract_template_versions`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`jurisdiction` <> 'ZA' OR NEW.`template_version` <> 'demo-v1'
		OR NEW.`template_code` NOT IN ('CLIENT_MSA','SERVICE_ORDER','OFFICER_EMPLOYMENT','OFFICER_PAYROLL_CONSENT')
		OR NEW.`status` <> 'demo_approved'
		OR NEW.`watermark` <> 'SIMULATION ONLY — NOT A CONTRACT'
		OR json_valid(NEW.`variable_schema_json`) <> 1
		OR json_type(NEW.`variable_schema_json`) <> 'array'
		OR json_array_length(NEW.`variable_schema_json`) < 1
		OR NEW.`body_reference` NOT LIKE 'demo://contract-template/%'
		OR length(NEW.`template_hash`) <> 64 OR NEW.`approved_by` IS NULL
		OR NEW.`approved_at` IS NULL OR NEW.`effective_from` IS NULL
		OR NEW.`effective_to` IS NOT NULL OR NEW.`active_key` <> 'demo:' || NEW.`template_code`
		OR NEW.`version` <> 1 OR NEW.`updated_at` < NEW.`created_at`
		OR EXISTS (SELECT 1 FROM json_each(NEW.`variable_schema_json`) item
			WHERE item.`type` <> 'text' OR length(trim(item.`value`)) < 2)
		OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` account
			JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
			WHERE account.`id` = NEW.`approved_by` AND account.`environment` = 'demo'
				AND account.`integrity_state` = 'synthetic' AND account.`status` = 'active'
				AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
				AND datetime(account.`mfa_verified_at`, '+30 minutes') >= datetime('now')
				AND role.`role` = 'compliance_reviewer' AND role.`status` = 'active'
				AND role.`environment` = 'demo' AND role.`integrity_state` = 'synthetic'
		)
	THEN RAISE(ABORT, 'controlled_contract_template_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `contract_template_update_guard_v32`
BEFORE UPDATE ON `contract_template_versions`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_contract_template_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `contract_template_delete_guard_v32`
BEFORE DELETE ON `contract_template_versions`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_contract_template_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `contract_envelope_insert_guard_v32`
BEFORE INSERT ON `contract_envelopes`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`subject_type` NOT IN ('client','officer') OR NEW.`status` <> 'demo_signed'
		OR NEW.`watermark` <> 'SIMULATION ONLY — NOT A CONTRACT'
		OR json_valid(NEW.`variables_json`) <> 1 OR json_type(NEW.`variables_json`) <> 'object'
		OR length(NEW.`variables_hash`) <> 64 OR length(NEW.`document_hash`) <> 64
		OR NEW.`document_reference` NOT LIKE 'demo://contract-envelope/%'
		OR NEW.`generated_by` = NEW.`approved_by` OR NEW.`approved_by` IS NULL
		OR NEW.`signed_by_email` IS NULL OR NEW.`signed_by_email` <> lower(trim(NEW.`signed_by_email`))
		OR NEW.`generated_at` IS NULL OR NEW.`approved_at` IS NULL OR NEW.`signed_at` IS NULL
		OR NEW.`approved_at` < NEW.`generated_at` OR NEW.`signed_at` < NEW.`approved_at`
		OR NEW.`version` <> 1 OR NEW.`updated_at` < NEW.`created_at`
		OR NOT EXISTS (
			SELECT 1 FROM `onboarding_cases` case_record
			WHERE case_record.`id` = NEW.`onboarding_case_id`
				AND case_record.`subject_type` = NEW.`subject_type`
				AND case_record.`subject_id` = NEW.`subject_id`
				AND case_record.`environment` = 'demo' AND case_record.`integrity_state` = 'synthetic'
				AND case_record.`status` = 'complete'
		) OR NOT EXISTS (
			SELECT 1 FROM `contract_template_versions` template
			WHERE template.`id` = NEW.`template_version_id` AND template.`environment` = 'demo'
				AND template.`integrity_state` = 'synthetic' AND template.`status` = 'demo_approved'
				AND template.`watermark` = NEW.`watermark`
				AND ((NEW.`subject_type` = 'client' AND template.`template_code` IN ('CLIENT_MSA','SERVICE_ORDER'))
					OR (NEW.`subject_type` = 'officer' AND template.`template_code` IN ('OFFICER_EMPLOYMENT','OFFICER_PAYROLL_CONSENT')))
				AND (SELECT COUNT(*) FROM json_each(NEW.`variables_json`)) =
					(SELECT COUNT(*) FROM json_each(template.`variable_schema_json`))
				AND NOT EXISTS (SELECT 1 FROM json_each(NEW.`variables_json`) supplied
					WHERE supplied.`key` NOT IN (SELECT expected.`value` FROM json_each(template.`variable_schema_json`) expected))
				AND (template.`template_code` <> 'SERVICE_ORDER'
					OR json_extract(NEW.`variables_json`, '$.creditTermsDays') = 0)
		) OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` maker
			JOIN `operator_role_assignments` maker_role ON maker_role.`operator_id` = maker.`id`
			WHERE maker.`id` = NEW.`generated_by` AND maker.`environment` = 'demo'
				AND maker.`integrity_state` = 'synthetic' AND maker.`status` = 'active'
				AND maker_role.`role` = 'operations_owner' AND maker_role.`status` = 'active'
				AND maker_role.`environment` = 'demo' AND maker_role.`integrity_state` = 'synthetic'
		) OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` checker
			JOIN `operator_role_assignments` checker_role ON checker_role.`operator_id` = checker.`id`
			WHERE checker.`id` = NEW.`approved_by` AND checker.`environment` = 'demo'
				AND checker.`integrity_state` = 'synthetic' AND checker.`status` = 'active'
				AND checker.`mfa_status` = 'verified' AND checker.`mfa_verified_at` IS NOT NULL
				AND datetime(checker.`mfa_verified_at`, '+30 minutes') >= datetime('now')
				AND checker_role.`role` = 'compliance_reviewer' AND checker_role.`status` = 'active'
				AND checker_role.`environment` = 'demo' AND checker_role.`integrity_state` = 'synthetic'
		)
	THEN RAISE(ABORT, 'controlled_contract_envelope_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `contract_envelope_update_guard_v32`
BEFORE UPDATE ON `contract_envelopes`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_contract_envelope_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `contract_envelope_delete_guard_v32`
BEFORE DELETE ON `contract_envelopes`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_contract_envelope_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `workspace_access_insert_guard_v32`
BEFORE INSERT ON `workspace_access_invitations`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`role` NOT IN ('client','officer','operations') OR NEW.`status` <> 'demo_active'
		OR NEW.`email_normalized` <> lower(trim(NEW.`email_normalized`))
		OR NEW.`requested_by` = NEW.`approved_by` OR NEW.`approved_by` IS NULL
		OR NEW.`requested_at` IS NULL OR NEW.`approved_at` IS NULL
		OR NEW.`claimed_at` IS NULL OR NEW.`activated_at` IS NULL
		OR NEW.`approved_at` < NEW.`requested_at` OR NEW.`claimed_at` < NEW.`approved_at`
		OR NEW.`activated_at` < NEW.`claimed_at` OR NEW.`expires_at` <= NEW.`activated_at`
		OR NEW.`active_key` <> 'demo:' || NEW.`role` || ':' || NEW.`email_normalized`
		OR NEW.`version` <> 1 OR NEW.`updated_at` < NEW.`created_at`
		OR (NEW.`role` = 'client' AND (NEW.`client_id` IS NULL OR NEW.`officer_id` IS NOT NULL OR NEW.`operator_id` IS NOT NULL))
		OR (NEW.`role` = 'officer' AND (NEW.`client_id` IS NOT NULL OR NEW.`officer_id` IS NULL OR NEW.`operator_id` IS NOT NULL))
		OR (NEW.`role` = 'operations' AND (NEW.`client_id` IS NOT NULL OR NEW.`officer_id` IS NOT NULL OR NEW.`operator_id` IS NULL))
		OR NOT EXISTS (
			SELECT 1 FROM `onboarding_cases` case_record
			WHERE case_record.`id` = NEW.`onboarding_case_id`
				AND case_record.`subject_type` = NEW.`role`
				AND case_record.`contact_email_normalized` = NEW.`email_normalized`
				AND case_record.`owner_id` = NEW.`requested_by`
				AND case_record.`environment` = 'demo' AND case_record.`integrity_state` = 'synthetic'
				AND case_record.`status` = 'complete'
				AND ((NEW.`role` = 'client' AND case_record.`subject_id` = NEW.`client_id`)
					OR (NEW.`role` = 'officer' AND case_record.`subject_id` = NEW.`officer_id`)
					OR (NEW.`role` = 'operations' AND case_record.`subject_id` = NEW.`operator_id`))
		) OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` checker
			JOIN `operator_role_assignments` role ON role.`operator_id` = checker.`id`
			WHERE checker.`id` = NEW.`approved_by` AND checker.`environment` = 'demo'
				AND checker.`integrity_state` = 'synthetic' AND checker.`status` = 'active'
				AND checker.`mfa_status` = 'verified' AND checker.`mfa_verified_at` IS NOT NULL
				AND datetime(checker.`mfa_verified_at`, '+30 minutes') >= datetime('now')
				AND role.`role` = 'compliance_reviewer' AND role.`status` = 'active'
				AND role.`environment` = 'demo' AND role.`integrity_state` = 'synthetic'
		)
	THEN RAISE(ABORT, 'controlled_workspace_access_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `workspace_access_update_guard_v32`
BEFORE UPDATE ON `workspace_access_invitations`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_workspace_access_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `workspace_access_delete_guard_v32`
BEFORE DELETE ON `workspace_access_invitations`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_workspace_access_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `controlled_pilot_rehearsal_insert_guard_v32`
BEFORE INSERT ON `controlled_pilot_rehearsals`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`environment` <> 'demo' OR NEW.`integrity_state` <> 'synthetic'
		OR NEW.`flow_version` <> 'LOKD-CONTROLLED-ONBOARDING-2026.09-v1'
		OR NEW.`status` NOT IN ('passed','blocked')
		OR json_valid(NEW.`steps_json`) <> 1 OR json_type(NEW.`steps_json`) <> 'array'
		OR json_array_length(NEW.`steps_json`) <> 8 OR length(NEW.`steps_hash`) <> 64
		OR json_valid(NEW.`blockers_json`) <> 1 OR json_type(NEW.`blockers_json`) <> 'array'
		OR json_array_length(NEW.`blockers_json`) < 1
		OR NEW.`credit_terms_days` <> 0 OR NEW.`funding_model` <> 'advance_only'
		OR NEW.`settlement_locked` <> 1 OR NEW.`production_authorised` <> 0
		OR EXISTS (SELECT 1 FROM json_each(NEW.`steps_json`) item
			WHERE json_extract(item.`value`, '$.status') NOT IN ('passed','blocked'))
		OR (NEW.`status` = 'passed' AND EXISTS (SELECT 1 FROM json_each(NEW.`steps_json`) item
			WHERE json_extract(item.`value`, '$.status') <> 'passed'))
		OR (NEW.`status` = 'blocked' AND NOT EXISTS (SELECT 1 FROM json_each(NEW.`steps_json`) item
			WHERE json_extract(item.`value`, '$.status') = 'blocked'))
		OR NOT EXISTS (
			SELECT 1 FROM `operator_accounts` account
			JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
			WHERE account.`id` = NEW.`run_by` AND account.`environment` = 'demo'
				AND account.`integrity_state` = 'synthetic' AND account.`status` = 'active'
				AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
				AND datetime(account.`mfa_verified_at`, '+30 minutes') >= datetime('now')
				AND role.`role` = 'operations_owner' AND role.`status` = 'active'
				AND role.`environment` = 'demo' AND role.`integrity_state` = 'synthetic'
		)
	THEN RAISE(ABORT, 'controlled_pilot_rehearsal_invalid') END);
END;--> statement-breakpoint
CREATE TRIGGER `controlled_pilot_rehearsal_update_guard_v32`
BEFORE UPDATE ON `controlled_pilot_rehearsals`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_pilot_rehearsal_append_only'); END;--> statement-breakpoint
CREATE TRIGGER `controlled_pilot_rehearsal_delete_guard_v32`
BEFORE DELETE ON `controlled_pilot_rehearsals`
FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'controlled_pilot_rehearsal_append_only'); END;
