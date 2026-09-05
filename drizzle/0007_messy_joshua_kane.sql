CREATE TABLE `assignment_activation_blockers` (
	`id` text PRIMARY KEY NOT NULL,
	`decision_id` text NOT NULL,
	`code` text NOT NULL,
	`category` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`decision_id`) REFERENCES `assignment_activation_decisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_blockers_decision_code_idx` ON `assignment_activation_blockers` (`decision_id`,`code`);--> statement-breakpoint
CREATE INDEX `activation_blockers_code_idx` ON `assignment_activation_blockers` (`code`,`created_at`);--> statement-breakpoint
CREATE TABLE `assignment_activation_commands` (
	`id` text PRIMARY KEY NOT NULL,
	`activation_key` text NOT NULL,
	`request_hash` text NOT NULL,
	`roster_slot_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`expected_slot_version` integer NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`state` text DEFAULT 'reserved' NOT NULL,
	`roster_assignment_id` text,
	`shift_id` text,
	`requested_by` text NOT NULL,
	`requested_at` text NOT NULL,
	`completed_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`roster_slot_id`) REFERENCES `roster_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roster_assignment_id`) REFERENCES `roster_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_commands_key_idx` ON `assignment_activation_commands` (`activation_key`);--> statement-breakpoint
CREATE INDEX `activation_commands_slot_state_idx` ON `assignment_activation_commands` (`roster_slot_id`,`state`);--> statement-breakpoint
CREATE INDEX `activation_commands_officer_state_idx` ON `assignment_activation_commands` (`officer_id`,`state`);--> statement-breakpoint
CREATE TABLE `assignment_activation_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`checkpoint` text NOT NULL,
	`decision` text NOT NULL,
	`environment` text NOT NULL,
	`summary` text NOT NULL,
	`evaluation_hash` text NOT NULL,
	`evaluated_at` text NOT NULL,
	FOREIGN KEY (`command_id`) REFERENCES `assignment_activation_commands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_decisions_command_sequence_idx` ON `assignment_activation_decisions` (`command_id`,`sequence`);--> statement-breakpoint
CREATE INDEX `activation_decisions_checkpoint_idx` ON `assignment_activation_decisions` (`checkpoint`,`evaluated_at`);--> statement-breakpoint
CREATE TABLE `assignment_activation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`roster_assignment_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`booking_id` text NOT NULL,
	`client_id` text NOT NULL,
	`site_id` text NOT NULL,
	`site_version` integer NOT NULL,
	`post_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`funding_reconciliation_id` text NOT NULL,
	`risk_assessment_id` text NOT NULL,
	`post_order_approval_id` text NOT NULL,
	`induction_id` text NOT NULL,
	`workforce_engagement_id` text NOT NULL,
	`workforce_model` text NOT NULL,
	`employer_id` text NOT NULL,
	`employer_legal_name` text NOT NULL,
	`employer_version` integer NOT NULL,
	`terms_acceptance_id` text NOT NULL,
	`terms_version` text NOT NULL,
	`pricing_version` text NOT NULL,
	`calendar_category` text NOT NULL,
	`ordinary_wage_cents` integer NOT NULL,
	`holiday_premium_cents` integer NOT NULL,
	`statutory_cost_cents` integer NOT NULL,
	`funded_offer_cents` integer NOT NULL,
	`reserved_minutes` integer NOT NULL,
	`launch_evidence` text NOT NULL,
	`officer_evidence` text NOT NULL,
	`employer_evidence` text NOT NULL,
	`schedule_evidence` text NOT NULL,
	`evidence_valid_through` text NOT NULL,
	`final` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`command_id`) REFERENCES `assignment_activation_commands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roster_assignment_id`) REFERENCES `roster_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `site_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`funding_reconciliation_id`) REFERENCES `booking_funding_reconciliations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`risk_assessment_id`) REFERENCES `site_risk_assessments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_order_approval_id`) REFERENCES `post_order_approvals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`induction_id`) REFERENCES `officer_site_inductions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`terms_acceptance_id`) REFERENCES `workforce_terms_acceptances`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activation_snapshots_command_idx` ON `assignment_activation_snapshots` (`command_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activation_snapshots_assignment_idx` ON `assignment_activation_snapshots` (`roster_assignment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `activation_snapshots_shift_idx` ON `assignment_activation_snapshots` (`shift_id`);--> statement-breakpoint
CREATE TABLE `assignment_revalidations` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`checkpoint` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_id` text,
	`evaluated_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `assignment_activation_snapshots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decision_id`) REFERENCES `assignment_activation_decisions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_revalidations_snapshot_checkpoint_idx` ON `assignment_revalidations` (`snapshot_id`,`checkpoint`);--> statement-breakpoint
CREATE INDEX `assignment_revalidations_status_time_idx` ON `assignment_revalidations` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `booking_funding_reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`provider` text NOT NULL,
	`provider_reference` text NOT NULL,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`expected_amount_cents` integer NOT NULL,
	`cleared_amount_cents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`cleared_at` text,
	`reconciled_at` text,
	`evidence_reference` text,
	`evidence_verified_at` text,
	`evidence_expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `funding_reconciliation_booking_idx` ON `booking_funding_reconciliations` (`booking_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `funding_reconciliation_active_idx` ON `booking_funding_reconciliations` (`active_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `funding_reconciliation_provider_ref_idx` ON `booking_funding_reconciliations` (`provider`,`provider_reference`);--> statement-breakpoint
CREATE TABLE `employer_compliance_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`employer_id` text NOT NULL,
	`control_code` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`evidence_reference` text,
	`verified_at` text,
	`expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `employer_evidence_employer_control_idx` ON `employer_compliance_evidence` (`employer_id`,`control_code`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `employer_evidence_active_idx` ON `employer_compliance_evidence` (`active_key`);--> statement-breakpoint
CREATE TABLE `officer_site_inductions` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`site_id` text NOT NULL,
	`induction_version` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`evidence_reference` text,
	`completed_at` text,
	`expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `officer_induction_officer_site_idx` ON `officer_site_inductions` (`officer_id`,`site_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `officer_induction_active_idx` ON `officer_site_inductions` (`active_key`);--> statement-breakpoint
CREATE TABLE `officer_travel_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`site_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`estimated_minutes` integer,
	`source` text NOT NULL,
	`evidence_reference` text,
	`assessed_at` text,
	`valid_until` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `travel_assessment_officer_site_idx` ON `officer_travel_assessments` (`officer_id`,`site_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `travel_assessment_active_idx` ON `officer_travel_assessments` (`active_key`);--> statement-breakpoint
CREATE TABLE `officer_work_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_reference` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`status` text DEFAULT 'declared' NOT NULL,
	`evidence_reference` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `officer_commitments_window_idx` ON `officer_work_commitments` (`officer_id`,`starts_at`,`ends_at`,`status`);--> statement-breakpoint
CREATE TABLE `post_order_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`post_orders_version` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`evidence_reference` text,
	`approved_by` text,
	`approved_at` text,
	`valid_from` text,
	`expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `site_posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `post_orders_post_status_idx` ON `post_order_approvals` (`post_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `post_orders_active_idx` ON `post_order_approvals` (`active_key`);--> statement-breakpoint
CREATE TABLE `site_risk_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`risk_rules_version` text NOT NULL,
	`risk_band` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`evidence_reference` text,
	`approved_by` text,
	`approved_at` text,
	`valid_from` text,
	`expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `site_risk_site_status_idx` ON `site_risk_assessments` (`site_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_risk_active_idx` ON `site_risk_assessments` (`active_key`);--> statement-breakpoint
CREATE TABLE `workforce_hour_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text,
	`roster_assignment_id` text,
	`relief_dispatch_id` text,
	`officer_id` text NOT NULL,
	`workforce_engagement_id` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`iso_week_start` text NOT NULL,
	`iso_week_end` text NOT NULL,
	`segment_starts_at` text NOT NULL,
	`segment_ends_at` text NOT NULL,
	`reserved_minutes` integer NOT NULL,
	`weekly_cap_minutes` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`active_key` text,
	`created_at` text NOT NULL,
	`released_at` text,
	`release_reason` text,
	FOREIGN KEY (`command_id`) REFERENCES `assignment_activation_commands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roster_assignment_id`) REFERENCES `roster_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`relief_dispatch_id`) REFERENCES `relief_dispatches`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `hour_reservations_officer_week_idx` ON `workforce_hour_reservations` (`officer_id`,`iso_week_start`,`status`);--> statement-breakpoint
CREATE INDEX `hour_reservations_assignment_idx` ON `workforce_hour_reservations` (`roster_assignment_id`,`status`);--> statement-breakpoint
CREATE INDEX `hour_reservations_relief_idx` ON `workforce_hour_reservations` (`relief_dispatch_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `hour_reservations_active_idx` ON `workforce_hour_reservations` (`active_key`);--> statement-breakpoint
CREATE TABLE `workforce_terms_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`workforce_engagement_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`terms_version` text NOT NULL,
	`acceptance_mode` text NOT NULL,
	`evidence_reference` text NOT NULL,
	`accepted_at` text NOT NULL,
	`expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workforce_terms_engagement_idx` ON `workforce_terms_acceptances` (`workforce_engagement_id`,`accepted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `workforce_terms_active_idx` ON `workforce_terms_acceptances` (`active_key`);
--> statement-breakpoint
UPDATE `assignment_workforce_snapshots`
SET `decision` = 'synthetic_demo_only'
WHERE `decision` = 'synthetic_authorised';
--> statement-breakpoint
UPDATE `launch_controls`
SET `status` = 'passed', `evidence_level` = 'system_verified',
	`evidence_reference` = 'system:assignment-activation-v19',
	`detail` = 'The atomic activation engine, immutable final snapshots, hour reservations and revalidation controls are database enforced.',
	`verified_by` = 'LOKD Version 19 build', `verified_at` = CURRENT_TIMESTAMP,
	`expires_at` = datetime(CURRENT_TIMESTAMP, '+90 days'),
	`version` = `version` + 1, `updated_at` = CURRENT_TIMESTAMP
WHERE `code` = 'G4_WORKFORCE_ENGINE';
--> statement-breakpoint
UPDATE `launch_controls`
SET `expires_at` = COALESCE(`expires_at`, datetime(CURRENT_TIMESTAMP, '+90 days')),
	`version` = `version` + 1, `updated_at` = CURRENT_TIMESTAMP
WHERE `code` = 'G0_PHASE1_SCOPE' AND `status` = 'passed';
--> statement-breakpoint
CREATE UNIQUE INDEX `offers_one_accepted_per_booking_idx`
ON `offers` (`booking_id`) WHERE `status` = 'accepted';
--> statement-breakpoint
CREATE TRIGGER `activation_decisions_no_update`
BEFORE UPDATE ON `assignment_activation_decisions`
BEGIN
	SELECT RAISE(ABORT, 'activation_decisions_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_decisions_no_delete`
BEFORE DELETE ON `assignment_activation_decisions`
BEGIN
	SELECT RAISE(ABORT, 'activation_decisions_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_blockers_no_update`
BEFORE UPDATE ON `assignment_activation_blockers`
BEGIN
	SELECT RAISE(ABORT, 'activation_blockers_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_blockers_no_delete`
BEFORE DELETE ON `assignment_activation_blockers`
BEGIN
	SELECT RAISE(ABORT, 'activation_blockers_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshots_no_update`
BEFORE UPDATE ON `assignment_activation_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'activation_snapshots_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshots_no_delete`
BEFORE DELETE ON `assignment_activation_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'activation_snapshots_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `legacy_workforce_snapshots_no_update`
BEFORE UPDATE ON `assignment_workforce_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'assignment_workforce_snapshots_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `legacy_workforce_snapshots_no_delete`
BEFORE DELETE ON `assignment_workforce_snapshots`
BEGIN
	SELECT RAISE(ABORT, 'assignment_workforce_snapshots_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_commands_identity_immutable`
BEFORE UPDATE ON `assignment_activation_commands`
WHEN NEW.`activation_key` <> OLD.`activation_key`
	OR NEW.`request_hash` <> OLD.`request_hash`
	OR NEW.`roster_slot_id` <> OLD.`roster_slot_id`
	OR NEW.`officer_id` <> OLD.`officer_id`
	OR NEW.`expected_slot_version` <> OLD.`expected_slot_version`
	OR NEW.`environment` <> OLD.`environment`
	OR NEW.`integrity_state` <> OLD.`integrity_state`
	OR NEW.`requested_by` <> OLD.`requested_by`
	OR NEW.`requested_at` <> OLD.`requested_at`
BEGIN
	SELECT RAISE(ABORT, 'activation_command_identity_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_commands_terminal_immutable`
BEFORE UPDATE ON `assignment_activation_commands`
WHEN OLD.`state` IN ('activated', 'blocked', 'cancelled')
BEGIN
	SELECT RAISE(ABORT, 'activation_command_terminal');
END;
--> statement-breakpoint
CREATE TRIGGER `roster_assignment_active_key_insert_guard`
BEFORE INSERT ON `roster_assignments`
WHEN NEW.`active_key` IS NOT NULL AND NEW.`active_key` <> NEW.`roster_slot_id`
BEGIN
	SELECT RAISE(ABORT, 'active_assignment_key_must_equal_slot');
END;
--> statement-breakpoint
CREATE TRIGGER `roster_assignment_active_key_update_guard`
BEFORE UPDATE OF `active_key`, `roster_slot_id` ON `roster_assignments`
WHEN NEW.`active_key` IS NOT NULL AND NEW.`active_key` <> NEW.`roster_slot_id`
BEGIN
	SELECT RAISE(ABORT, 'active_assignment_key_must_equal_slot');
END;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_insert_guard`
BEFORE INSERT ON `workforce_hour_reservations`
WHEN NEW.`status` = 'active'
BEGIN
	SELECT (CASE WHEN NEW.`active_key` IS NULL
		OR NEW.`reserved_minutes` <= 0
		OR NEW.`weekly_cap_minutes` <= 0
		OR NEW.`segment_starts_at` >= NEW.`segment_ends_at`
		THEN RAISE(ABORT, 'invalid_hour_reservation') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `workforce_engagements` we
		WHERE we.`id` = NEW.`workforce_engagement_id`
			AND we.`officer_id` = NEW.`officer_id`
			AND we.`model` = 'direct_flex'
			AND we.`status` = 'active'
			AND we.`active_key` = we.`officer_id`
			AND we.`weekly_hour_cap` IS NOT NULL
			AND NEW.`weekly_cap_minutes` = we.`weekly_hour_cap` * 60
	) THEN RAISE(ABORT, 'invalid_direct_flex_engagement') END);
	SELECT (CASE WHEN COALESCE((
		SELECT SUM(r.`reserved_minutes`)
		FROM `workforce_hour_reservations` r
		WHERE r.`officer_id` = NEW.`officer_id`
			AND r.`iso_week_start` = NEW.`iso_week_start`
			AND r.`status` = 'active'
	), 0) + NEW.`reserved_minutes` > NEW.`weekly_cap_minutes`
	THEN RAISE(ABORT, 'direct_flex_weekly_cap_exceeded') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `workforce_hour_reservations` r
		WHERE r.`officer_id` = NEW.`officer_id`
			AND r.`status` = 'active'
			AND r.`source_id` <> NEW.`source_id`
			AND r.`segment_starts_at` < NEW.`segment_ends_at`
			AND r.`segment_ends_at` > NEW.`segment_starts_at`
	) THEN RAISE(ABORT, 'officer_work_overlap') END);
END;
--> statement-breakpoint
CREATE TRIGGER `hour_reservation_release_only`
BEFORE UPDATE ON `workforce_hour_reservations`
WHEN NOT (
	OLD.`status` = 'active'
	AND NEW.`status` = 'released'
	AND NEW.`active_key` IS NULL
	AND NEW.`released_at` IS NOT NULL
	AND NEW.`release_reason` IS NOT NULL
	AND NEW.`id` = OLD.`id`
	AND NEW.`command_id` IS OLD.`command_id`
	AND NEW.`roster_assignment_id` IS OLD.`roster_assignment_id`
	AND NEW.`relief_dispatch_id` IS OLD.`relief_dispatch_id`
	AND NEW.`officer_id` = OLD.`officer_id`
	AND NEW.`workforce_engagement_id` = OLD.`workforce_engagement_id`
	AND NEW.`source_type` = OLD.`source_type`
	AND NEW.`source_id` = OLD.`source_id`
	AND NEW.`iso_week_start` = OLD.`iso_week_start`
	AND NEW.`iso_week_end` = OLD.`iso_week_end`
	AND NEW.`segment_starts_at` = OLD.`segment_starts_at`
	AND NEW.`segment_ends_at` = OLD.`segment_ends_at`
	AND NEW.`reserved_minutes` = OLD.`reserved_minutes`
	AND NEW.`weekly_cap_minutes` = OLD.`weekly_cap_minutes`
	AND NEW.`created_at` = OLD.`created_at`
)
BEGIN
	SELECT RAISE(ABORT, 'hour_reservations_release_only');
END;
--> statement-breakpoint
CREATE TRIGGER `hour_reservations_no_delete`
BEFORE DELETE ON `workforce_hour_reservations`
BEGIN
	SELECT RAISE(ABORT, 'hour_reservations_append_only');
END;
--> statement-breakpoint
CREATE TRIGGER `roster_assignment_release_hours`
AFTER UPDATE OF `status`, `active_key` ON `roster_assignments`
WHEN NEW.`status` IN ('cancelled', 'replaced', 'released')
	AND OLD.`status` NOT IN ('cancelled', 'replaced', 'released')
BEGIN
	UPDATE `workforce_hour_reservations`
	SET `status` = 'released', `active_key` = NULL, `released_at` = CURRENT_TIMESTAMP,
		`release_reason` = 'assignment_' || NEW.`status`
	WHERE `roster_assignment_id` = NEW.`id` AND `status` = 'active';
END;
--> statement-breakpoint
CREATE TRIGGER `relief_dispatch_release_hours`
AFTER UPDATE OF `status`, `active_key` ON `relief_dispatches`
WHEN NEW.`status` IN ('cancelled', 'closed', 'replaced')
	AND OLD.`status` NOT IN ('cancelled', 'closed', 'replaced')
BEGIN
	UPDATE `workforce_hour_reservations`
	SET `status` = 'released', `active_key` = NULL, `released_at` = CURRENT_TIMESTAMP,
		`release_reason` = 'relief_' || NEW.`status`
	WHERE `relief_dispatch_id` = NEW.`id` AND `status` = 'active';
END;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshot_insert_guard`
BEFORE INSERT ON `assignment_activation_snapshots`
BEGIN
	SELECT (CASE WHEN NEW.`final` <> 1
		OR NEW.`environment` <> 'production'
		OR NEW.`integrity_state` <> 'production_verified'
		THEN RAISE(ABORT, 'final_snapshot_requires_verified_production') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_commands` c
		WHERE c.`id` = NEW.`command_id`
			AND c.`state` = 'reserved'
			AND c.`environment` = NEW.`environment`
			AND c.`integrity_state` = NEW.`integrity_state`
			AND c.`officer_id` = NEW.`officer_id`
	) THEN RAISE(ABORT, 'snapshot_command_mismatch') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `roster_assignments` ra
		WHERE ra.`id` = NEW.`roster_assignment_id`
			AND ra.`officer_id` = NEW.`officer_id`
			AND ra.`status` = 'reserved'
			AND ra.`active_key` IS NULL
	) THEN RAISE(ABORT, 'snapshot_requires_inactive_assignment') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `shifts` sh
		WHERE sh.`id` = NEW.`shift_id`
			AND sh.`booking_id` = NEW.`booking_id`
			AND sh.`officer_id` = NEW.`officer_id`
			AND sh.`status` = 'reserved'
	) THEN RAISE(ABORT, 'snapshot_requires_inactive_shift') END);
END;
--> statement-breakpoint
CREATE TRIGGER `activation_command_final_guard`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT (CASE WHEN OLD.`state` <> 'reserved'
		OR NEW.`environment` <> 'production'
		OR NEW.`integrity_state` <> 'production_verified'
		THEN RAISE(ABORT, 'production_activation_required') END);
	SELECT (CASE WHEN (
		SELECT COUNT(*) FROM `launch_controls`
		WHERE `code` IN ('G0_PHASE1_SCOPE','G1_PSIRA_PAPERWORK','G2_CONTROL_ROOM_INSPECTION','G3_PSIRA_CERTIFICATE','G4_WORKFORCE_ENGINE','G5_WORKFORCE_TERMS','G6_IDENTITY_PROVIDER','G7_CLIENT_FUNDS','G8_PAYROLL_INSURANCE','G9_PRODUCTION_CONTROLS')
	) <> 10 THEN RAISE(ABORT, 'required_launch_gate_missing') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `launch_controls` lc
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE lc.`code` IN ('G0_PHASE1_SCOPE','G1_PSIRA_PAPERWORK','G2_CONTROL_ROOM_INSPECTION','G3_PSIRA_CERTIFICATE','G4_WORKFORCE_ENGINE','G5_WORKFORCE_TERMS','G6_IDENTITY_PROVIDER','G7_CLIENT_FUNDS','G8_PAYROLL_INSURANCE','G9_PRODUCTION_CONTROLS')
			AND (lc.`status` <> 'passed'
				OR lc.`evidence_level` NOT IN ('system_verified','independently_verified')
				OR lc.`evidence_reference` IS NULL OR length(trim(lc.`evidence_reference`)) = 0
				OR lc.`verified_at` IS NULL
				OR (lc.`expires_at` IS NOT NULL AND julianday(lc.`expires_at`) < julianday(rs.`ends_at`)))
	) THEN RAISE(ABORT, 'required_launch_gate_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `booking_funding_reconciliations` fr ON fr.`id` = snap.`funding_reconciliation_id`
		JOIN `bookings` b ON b.`id` = snap.`booking_id`
		WHERE snap.`command_id` = NEW.`id`
			AND snap.`final` = 1
			AND fr.`status` = 'cleared_reconciled'
			AND fr.`environment` = 'production'
			AND fr.`provider` <> 'demo_manual'
			AND fr.`currency` = 'ZAR'
			AND fr.`cleared_amount_cents` >= b.`client_price_cents`
			AND fr.`evidence_reference` IS NOT NULL
			AND fr.`evidence_verified_at` IS NOT NULL
			AND (fr.`evidence_expires_at` IS NULL OR julianday(fr.`evidence_expires_at`) >= julianday(snap.`evidence_valid_through`))
	) THEN RAISE(ABORT, 'cleared_reconciled_funding_required') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `clients` c ON c.`id` = snap.`client_id`
		JOIN `operational_sites` os ON os.`id` = snap.`site_id`
		JOIN `site_posts` sp ON sp.`id` = snap.`post_id`
		JOIN `site_risk_assessments` sra ON sra.`id` = snap.`risk_assessment_id`
		JOIN `post_order_approvals` poa ON poa.`id` = snap.`post_order_approval_id`
		JOIN `officer_site_inductions` osi ON osi.`id` = snap.`induction_id`
		WHERE snap.`command_id` = NEW.`id`
			AND c.`approval_status` = 'approved'
			AND os.`status` = 'active' AND os.`version` = snap.`site_version`
			AND sp.`status` = 'active'
			AND sra.`status` = 'approved' AND sra.`evidence_reference` IS NOT NULL
			AND sra.`active_key` = os.`id`
			AND (sra.`expires_at` IS NULL OR julianday(sra.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND poa.`status` = 'approved' AND poa.`evidence_reference` IS NOT NULL
			AND poa.`active_key` = sp.`id` AND poa.`post_orders_version` = sp.`post_orders_version`
			AND (poa.`expires_at` IS NULL OR julianday(poa.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND osi.`status` = 'completed' AND osi.`evidence_reference` IS NOT NULL
			AND osi.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND (osi.`expires_at` IS NULL OR julianday(osi.`expires_at`) >= julianday(snap.`evidence_valid_through`))
	) THEN RAISE(ABORT, 'site_post_risk_induction_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `officers` o ON o.`id` = snap.`officer_id`
		JOIN `officer_passports` op ON op.`officer_id` = o.`id`
		JOIN `site_posts` sp ON sp.`id` = snap.`post_id`
		JOIN `officer_services` svc ON svc.`officer_id` = o.`id` AND svc.`service_type` = sp.`service_type`
		WHERE snap.`command_id` = NEW.`id`
			AND o.`approval_status` = 'approved'
			AND julianday(o.`psira_expiry` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`)
			AND op.`status` IN ('active','expiring')
			AND op.`next_review_at` IS NOT NULL AND julianday(op.`next_review_at`) >= julianday(snap.`evidence_valid_through`)
			AND svc.`qualified` = 1 AND svc.`opted_in` = 1
			AND svc.`qualification_expiry` IS NOT NULL
			AND julianday(svc.`qualification_expiry` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`)
			AND EXISTS (SELECT 1 FROM `compliance_records` cr WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'identity' AND cr.`status` = 'current' AND cr.`verified_at` IS NOT NULL AND (cr.`expires_at` IS NULL OR julianday(cr.`expires_at`) >= julianday(snap.`evidence_valid_through`)))
			AND EXISTS (SELECT 1 FROM `compliance_records` cr WHERE cr.`officer_id` = o.`id` AND cr.`record_type` = 'psira' AND cr.`status` = 'current' AND cr.`verified_at` IS NOT NULL AND cr.`expires_at` IS NOT NULL AND julianday(cr.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe WHERE oe.`officer_id` = o.`id` AND oe.`code` = 'core_ready' AND oe.`status` = 'current' AND oe.`expires_at` IS NOT NULL AND julianday(oe.`expires_at` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`))
			AND EXISTS (SELECT 1 FROM `officer_endorsements` oe WHERE oe.`officer_id` = o.`id` AND oe.`category` = 'purpose' AND oe.`purpose_code` = sp.`purpose_code` AND oe.`status` = 'current' AND oe.`expires_at` IS NOT NULL AND julianday(oe.`expires_at` || 'T23:59:59Z') >= julianday(snap.`evidence_valid_through`))
	) THEN RAISE(ABORT, 'officer_readiness_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `workforce_engagements` we ON we.`id` = snap.`workforce_engagement_id`
		JOIN `workforce_employers` emp ON emp.`id` = snap.`employer_id`
		JOIN `workforce_terms_acceptances` wta ON wta.`id` = snap.`terms_acceptance_id`
		WHERE snap.`command_id` = NEW.`id`
			AND we.`officer_id` = snap.`officer_id`
			AND we.`status` = 'active' AND we.`active_key` = we.`officer_id`
			AND we.`model` = snap.`workforce_model`
			AND we.`terms_version` = snap.`terms_version`
			AND (we.`review_due_at` IS NULL OR julianday(we.`review_due_at`) >= julianday(snap.`evidence_valid_through`))
			AND emp.`status` = 'current' AND emp.`version` = snap.`employer_version`
			AND emp.`environment` = 'production'
			AND (emp.`review_due_at` IS NULL OR julianday(emp.`review_due_at`) >= julianday(snap.`evidence_valid_through`))
			AND wta.`workforce_engagement_id` = we.`id` AND wta.`officer_id` = snap.`officer_id`
			AND wta.`terms_version` = we.`terms_version` AND wta.`active_key` = we.`id`
			AND (wta.`expires_at` IS NULL OR julianday(wta.`expires_at`) >= julianday(snap.`evidence_valid_through`))
			AND ((we.`model` IN ('direct_flex','managed') AND we.`payroll_status` = 'ready' AND we.`benefits_status` = 'ready')
				OR (we.`model` = 'partner' AND we.`payroll_status` = 'partner_confirmed' AND we.`benefits_status` = 'partner_confirmed'))
	) THEN RAISE(ABORT, 'workforce_route_invalid') END);
	SELECT (CASE WHEN (
		SELECT COUNT(DISTINCT ece.`control_code`)
		FROM `assignment_activation_snapshots` snap
		JOIN `employer_compliance_evidence` ece ON ece.`employer_id` = snap.`employer_id`
		WHERE snap.`command_id` = NEW.`id`
			AND ece.`control_code` IN ('psira','nbcpss','psspf','uif','coida','insurance','service_agreement')
			AND ece.`status` = 'current' AND ece.`evidence_reference` IS NOT NULL
			AND ece.`verified_at` IS NOT NULL AND ece.`active_key` = ece.`employer_id` || ':' || ece.`control_code`
			AND (ece.`expires_at` IS NULL OR julianday(ece.`expires_at`) >= julianday(snap.`evidence_valid_through`))
	) <> 7 THEN RAISE(ABORT, 'employer_compliance_evidence_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		JOIN `officer_availability_windows` av ON av.`officer_id` = snap.`officer_id`
		JOIN `officer_travel_assessments` ota ON ota.`officer_id` = snap.`officer_id` AND ota.`site_id` = snap.`site_id`
		WHERE snap.`command_id` = NEW.`id`
			AND av.`status` = 'available' AND av.`starts_at` <= rs.`starts_at` AND av.`ends_at` >= rs.`ends_at`
			AND ota.`status` = 'feasible' AND ota.`active_key` = snap.`officer_id` || ':' || snap.`site_id`
			AND ota.`evidence_reference` IS NOT NULL AND ota.`assessed_at` IS NOT NULL
			AND ota.`valid_until` IS NOT NULL AND julianday(ota.`valid_until`) >= julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'availability_or_travel_invalid') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `officer_work_commitments` owc
		JOIN `roster_slots` rs ON rs.`id` = NEW.`roster_slot_id`
		WHERE owc.`officer_id` = NEW.`officer_id` AND owc.`status` <> 'cancelled'
			AND julianday(owc.`starts_at`) < julianday(rs.`ends_at`, '+8 hours')
			AND julianday(owc.`ends_at`) > julianday(rs.`starts_at`, '-8 hours')
	) THEN RAISE(ABORT, 'external_work_rest_conflict') END);
	SELECT (CASE WHEN EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		WHERE snap.`command_id` = NEW.`id` AND snap.`workforce_model` = 'direct_flex'
			AND COALESCE((SELECT SUM(whr.`reserved_minutes`) FROM `workforce_hour_reservations` whr
				WHERE whr.`command_id` = NEW.`id` AND whr.`status` = 'active'), 0) <> snap.`reserved_minutes`
	) THEN RAISE(ABORT, 'direct_flex_hour_snapshot_mismatch') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `roster_assignments` ra
		JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
		WHERE ra.`id` = NEW.`roster_assignment_id` AND ra.`roster_slot_id` = NEW.`roster_slot_id`
			AND ra.`officer_id` = NEW.`officer_id` AND ra.`active_key` = NEW.`roster_slot_id`
			AND ra.`status` = 'confirmed'
			AND rs.`version` = NEW.`expected_slot_version` + 1 AND rs.`status` = 'scheduled'
	) THEN RAISE(ABORT, 'active_assignment_missing') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `shifts` sh
		WHERE sh.`id` = NEW.`shift_id` AND sh.`officer_id` = NEW.`officer_id` AND sh.`status` = 'confirmed'
	) THEN RAISE(ABORT, 'active_shift_missing') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_decisions` d
		WHERE d.`command_id` = NEW.`id` AND d.`checkpoint` = 'activation' AND d.`decision` = 'activated'
			AND NOT EXISTS (SELECT 1 FROM `assignment_activation_blockers` b WHERE b.`decision_id` = d.`id`)
	) THEN RAISE(ABORT, 'final_activation_decision_missing') END);
END;
--> statement-breakpoint
CREATE TRIGGER `activated_shift_check_in_guard`
BEFORE UPDATE OF `status`, `check_in_at` ON `shifts`
WHEN NEW.`status` = 'on_post' AND EXISTS (
	SELECT 1 FROM `assignment_activation_snapshots` snap
	WHERE snap.`shift_id` = NEW.`id` AND snap.`final` = 1
)
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id` AND rv.`checkpoint` = 'check_in'
		JOIN `assignment_activation_decisions` d ON d.`id` = rv.`decision_id`
		WHERE snap.`shift_id` = NEW.`id` AND snap.`environment` = 'production'
			AND rv.`status` = 'passed' AND d.`decision` = 'passed' AND d.`checkpoint` = 'check_in'
			AND julianday(d.`evaluated_at`) >= julianday(CURRENT_TIMESTAMP, '-5 minutes')
	) THEN RAISE(ABORT, 'fresh_check_in_revalidation_required') END);
END;
