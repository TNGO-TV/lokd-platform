CREATE TABLE `operator_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mfa_status` text DEFAULT 'not_verified' NOT NULL,
	`mfa_verified_at` text,
	`approval_limit_cents` integer DEFAULT 0 NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_accounts_email_env_idx` ON `operator_accounts` (`email`,`environment`);--> statement-breakpoint
CREATE INDEX `operator_accounts_status_idx` ON `operator_accounts` (`environment`,`status`);--> statement-breakpoint
CREATE TABLE `operator_action_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`action_code` text NOT NULL,
	`label` text NOT NULL,
	`required_role` text NOT NULL,
	`mfa_max_age_minutes` integer NOT NULL,
	`max_amount_cents` integer,
	`second_approval_required` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_action_policy_code_idx` ON `operator_action_policies` (`environment`,`action_code`);--> statement-breakpoint
CREATE INDEX `operator_action_policy_role_idx` ON `operator_action_policies` (`environment`,`required_role`,`status`);--> statement-breakpoint
CREATE TABLE `operator_approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`action_code` text NOT NULL,
	`aggregate_type` text NOT NULL,
	`aggregate_id` text NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending_first_approval' NOT NULL,
	`requested_by` text NOT NULL,
	`first_approved_by` text,
	`second_approved_by` text,
	`requested_at` text NOT NULL,
	`first_approved_at` text,
	`second_approved_at` text,
	`expires_at` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`requested_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`first_approved_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`second_approved_by`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_approval_active_idx` ON `operator_approval_requests` (`environment`,`action_code`,`aggregate_id`);--> statement-breakpoint
CREATE INDEX `operator_approval_queue_idx` ON `operator_approval_requests` (`environment`,`status`,`requested_at`);--> statement-breakpoint
CREATE TABLE `operator_role_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`operator_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`granted_by` text NOT NULL,
	`granted_at` text NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`operator_id`) REFERENCES `operator_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_role_active_idx` ON `operator_role_assignments` (`operator_id`,`role`,`environment`);--> statement-breakpoint
CREATE INDEX `operator_role_queue_idx` ON `operator_role_assignments` (`environment`,`role`,`status`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `funding_model` text DEFAULT 'advance_only' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `credit_terms_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE TRIGGER `booking_zero_credit_insert_guard_v28`
BEFORE INSERT ON `bookings`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`credit_terms_days` <> 0 OR NEW.`funding_model` <> 'advance_only'
		THEN RAISE(ABORT, 'zero_credit_advance_funding_required') END);
END;--> statement-breakpoint
CREATE TRIGGER `booking_zero_credit_update_guard_v28`
BEFORE UPDATE OF `credit_terms_days`, `funding_model`, `funding_status`, `client_price_cents` ON `bookings`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`credit_terms_days` <> 0 OR NEW.`funding_model` <> 'advance_only'
		THEN RAISE(ABORT, 'zero_credit_advance_funding_required') END);
	SELECT (CASE WHEN NEW.`environment` = 'production' AND NEW.`funding_status` = 'paid_in_full' AND NOT EXISTS (
		SELECT 1 FROM `booking_funding_reconciliations` funding
		WHERE funding.`booking_id` = NEW.`id` AND funding.`active_key` = NEW.`id`
			AND funding.`environment` = 'production' AND funding.`integrity_state` = 'production_verified'
			AND funding.`status` = 'cleared_reconciled'
			AND funding.`expected_amount_cents` = NEW.`client_price_cents`
			AND funding.`cleared_amount_cents` = NEW.`client_price_cents`
			AND funding.`evidence_reference` IS NOT NULL AND funding.`evidence_verified_at` IS NOT NULL
	) THEN RAISE(ABORT, 'production_cleared_reconciled_funding_required') END);
	SELECT (CASE WHEN OLD.`funding_status` = 'paid_in_full' AND NEW.`funding_status` <> 'paid_in_full' AND EXISTS (
		SELECT 1 FROM `offers` offer WHERE offer.`booking_id` = OLD.`id` AND offer.`status` IN ('open','accepted')
	) THEN RAISE(ABORT, 'open_offer_requires_funding_hold') END);
END;--> statement-breakpoint
CREATE TRIGGER `offer_advance_funding_insert_guard_v28`
BEFORE INSERT ON `offers`
FOR EACH ROW WHEN NEW.`status` IN ('open','accepted')
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `bookings` booking
		WHERE booking.`id` = NEW.`booking_id` AND booking.`credit_terms_days` = 0
			AND booking.`funding_model` = 'advance_only' AND booking.`funding_status` = 'paid_in_full'
			AND (booking.`environment` <> 'production' OR EXISTS (
				SELECT 1 FROM `booking_funding_reconciliations` funding
				WHERE funding.`booking_id` = booking.`id` AND funding.`active_key` = booking.`id`
					AND funding.`environment` = 'production' AND funding.`integrity_state` = 'production_verified'
					AND funding.`status` = 'cleared_reconciled'
					AND funding.`expected_amount_cents` = booking.`client_price_cents`
					AND funding.`cleared_amount_cents` = booking.`client_price_cents`
					AND funding.`evidence_reference` IS NOT NULL AND funding.`evidence_verified_at` IS NOT NULL
			))
	) THEN RAISE(ABORT, 'offer_release_requires_full_cleared_advance_funding') END);
END;--> statement-breakpoint
CREATE TRIGGER `offer_advance_funding_update_guard_v28`
BEFORE UPDATE OF `status` ON `offers`
FOR EACH ROW WHEN NEW.`status` IN ('open','accepted')
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `bookings` booking
		WHERE booking.`id` = NEW.`booking_id` AND booking.`credit_terms_days` = 0
			AND booking.`funding_model` = 'advance_only' AND booking.`funding_status` = 'paid_in_full'
			AND (booking.`environment` <> 'production' OR EXISTS (
				SELECT 1 FROM `booking_funding_reconciliations` funding
				WHERE funding.`booking_id` = booking.`id` AND funding.`active_key` = booking.`id`
					AND funding.`environment` = 'production' AND funding.`integrity_state` = 'production_verified'
					AND funding.`status` = 'cleared_reconciled'
					AND funding.`expected_amount_cents` = booking.`client_price_cents`
					AND funding.`cleared_amount_cents` = booking.`client_price_cents`
					AND funding.`evidence_reference` IS NOT NULL AND funding.`evidence_verified_at` IS NOT NULL
			))
	) THEN RAISE(ABORT, 'offer_release_requires_full_cleared_advance_funding') END);
END;
--> statement-breakpoint
CREATE TRIGGER `payroll_run_first_approval_guard_v28`
BEFORE UPDATE OF `approved_by`, `status` ON `payroll_runs`
FOR EACH ROW WHEN (NEW.`status` = 'first_approved' AND OLD.`status` <> 'first_approved')
	OR (NEW.`approved_by` IS NOT NULL AND OLD.`approved_by` IS NULL)
BEGIN
	SELECT (CASE WHEN NEW.`approved_by` IS NULL OR NEW.`approved_by` = NEW.`created_by`
		OR NEW.`status` <> 'first_approved'
		THEN RAISE(ABORT, 'payroll_maker_checker_first_approval_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operator_accounts` account
		JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
		WHERE account.`id` = NEW.`approved_by` AND account.`environment` = NEW.`environment`
			AND account.`integrity_state` = NEW.`integrity_state` AND account.`status` = 'active'
			AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
			AND datetime(account.`mfa_verified_at`, '+15 minutes') >= datetime('now')
			AND account.`approval_limit_cents` >= COALESCE(NEW.`net_pay_cents`, NEW.`gross_cents`)
			AND role.`role` = 'payroll_reviewer' AND role.`status` = 'active'
			AND role.`environment` = NEW.`environment` AND role.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'active_mfa_payroll_reviewer_required') END);
END;--> statement-breakpoint
CREATE TRIGGER `payroll_run_second_approval_guard_v28`
BEFORE UPDATE OF `second_approved_by`, `status` ON `payroll_runs`
FOR EACH ROW WHEN (NEW.`status` = 'approved_for_export' AND OLD.`status` <> 'approved_for_export')
	OR (NEW.`second_approved_by` IS NOT NULL AND OLD.`second_approved_by` IS NULL)
BEGIN
	SELECT (CASE WHEN NEW.`approved_by` IS NULL OR NEW.`second_approved_by` IS NULL
		OR NEW.`second_approved_by` IN (NEW.`created_by`, NEW.`approved_by`)
		OR NEW.`status` <> 'approved_for_export'
		THEN RAISE(ABORT, 'payroll_maker_checker_second_approval_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operator_accounts` account
		JOIN `operator_role_assignments` role ON role.`operator_id` = account.`id`
		WHERE account.`id` = NEW.`second_approved_by` AND account.`environment` = NEW.`environment`
			AND account.`integrity_state` = NEW.`integrity_state` AND account.`status` = 'active'
			AND account.`mfa_status` = 'verified' AND account.`mfa_verified_at` IS NOT NULL
			AND datetime(account.`mfa_verified_at`, '+15 minutes') >= datetime('now')
			AND account.`approval_limit_cents` >= COALESCE(NEW.`net_pay_cents`, NEW.`gross_cents`)
			AND role.`role` = 'finance_approver' AND role.`status` = 'active'
			AND role.`environment` = NEW.`environment` AND role.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'active_mfa_finance_approver_required') END);
END;--> statement-breakpoint
CREATE TRIGGER `payroll_policy_activation_guard_v28`
BEFORE UPDATE OF `status` ON `payroll_policy_versions`
FOR EACH ROW WHEN NEW.`status` = 'active' AND OLD.`status` <> 'active'
BEGIN
	SELECT (CASE WHEN NEW.`reviewed_by` IS NULL OR NEW.`approved_by` IS NULL
		OR NEW.`created_by` IN (NEW.`reviewed_by`, NEW.`approved_by`) OR NEW.`reviewed_by` = NEW.`approved_by`
		OR NEW.`reviewed_at` IS NULL OR NEW.`activated_at` IS NULL OR NEW.`active_key` IS NULL
		OR length(NEW.`policy_hash`) < 32 OR length(NEW.`source_reference`) < 8
		THEN RAISE(ABORT, 'payroll_policy_three_person_approval_required') END);
END;
