CREATE TABLE `activation_evidence_epoch` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignment_evidence_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`command_id` text NOT NULL,
	`checkpoint` text NOT NULL,
	`source_revision` integer NOT NULL,
	`evaluation_hash` text NOT NULL,
	`evaluated_at` text NOT NULL,
	`roster_slot_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`expected_slot_version` integer NOT NULL,
	`environment` text NOT NULL,
	`funding_evidence` text NOT NULL,
	`site_evidence` text NOT NULL,
	`launch_evidence` text NOT NULL,
	`officer_evidence` text NOT NULL,
	`employer_evidence` text NOT NULL,
	`schedule_evidence` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`command_id`) REFERENCES `assignment_activation_commands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`roster_slot_id`) REFERENCES `roster_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_evidence_tokens_command_checkpoint_idx` ON `assignment_evidence_tokens` (`command_id`,`checkpoint`);--> statement-breakpoint
CREATE INDEX `assignment_evidence_tokens_source_revision_idx` ON `assignment_evidence_tokens` (`source_revision`,`created_at`);

INSERT INTO `activation_evidence_epoch` (`singleton`, `revision`, `updated_at`)
VALUES (1, 1, CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE TRIGGER `activation_evidence_epoch_singleton_insert_v6`
BEFORE INSERT ON `activation_evidence_epoch`
WHEN NEW.`singleton` <> 1
  OR EXISTS (SELECT 1 FROM `activation_evidence_epoch` WHERE `singleton` = 1)
BEGIN
  SELECT RAISE(ABORT, 'activation_evidence_epoch_singleton');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_evidence_epoch_no_delete_v6`
BEFORE DELETE ON `activation_evidence_epoch`
BEGIN
  SELECT RAISE(ABORT, 'activation_evidence_epoch_required');
END;
--> statement-breakpoint
CREATE TRIGGER `activation_evidence_epoch_monotonic_v6`
BEFORE UPDATE ON `activation_evidence_epoch`
WHEN NEW.`singleton` <> 1
  OR NEW.`revision` <> OLD.`revision` + 1
BEGIN
  SELECT RAISE(ABORT, 'activation_evidence_epoch_invalid_update');
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_evidence_token_insert_guard_v6`
BEFORE INSERT ON `assignment_evidence_tokens`
BEGIN
  SELECT CASE WHEN NEW.`environment` <> 'production'
    OR NEW.`checkpoint` NOT IN ('activation','t_minus_24','t_minus_2','check_in')
    OR typeof(NEW.`source_revision`) <> 'integer' OR NEW.`source_revision` < 1
    OR length(NEW.`evaluation_hash`) <> 64
    OR NEW.`evaluation_hash` GLOB '*[^0-9a-f]*'
    OR julianday(NEW.`evaluated_at`) IS NULL
    OR NEW.`created_at` <> NEW.`evaluated_at`
    OR json_valid(NEW.`funding_evidence`) <> 1 OR json_type(NEW.`funding_evidence`) <> 'object'
    OR json_valid(NEW.`site_evidence`) <> 1 OR json_type(NEW.`site_evidence`) <> 'object'
    OR json_valid(NEW.`launch_evidence`) <> 1 OR json_type(NEW.`launch_evidence`) <> 'array'
    OR json_valid(NEW.`officer_evidence`) <> 1 OR json_type(NEW.`officer_evidence`) <> 'object'
    OR json_valid(NEW.`employer_evidence`) <> 1 OR json_type(NEW.`employer_evidence`) <> 'object'
    OR json_valid(NEW.`schedule_evidence`) <> 1 OR json_type(NEW.`schedule_evidence`) <> 'object'
  THEN RAISE(ABORT, 'assignment_evidence_token_shape_invalid') END;
  SELECT CASE WHEN NEW.`source_revision` <> (
    SELECT `revision` FROM `activation_evidence_epoch` WHERE `singleton` = 1
  ) THEN RAISE(ABORT, 'assignment_evidence_token_stale') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `assignment_activation_commands` c
    WHERE c.`id` = NEW.`command_id`
      AND c.`environment` = 'production'
      AND c.`roster_slot_id` = NEW.`roster_slot_id`
      AND c.`officer_id` = NEW.`officer_id`
      AND (
        (NEW.`checkpoint` = 'activation'
          AND c.`state` = 'ready'
          AND c.`expected_slot_version` = NEW.`expected_slot_version`)
        OR
        (NEW.`checkpoint` <> 'activation' AND c.`state` = 'activated'
          AND EXISTS (
            SELECT 1 FROM `assignment_activation_snapshots` snap
            JOIN `roster_assignments` ra ON ra.`id` = snap.`roster_assignment_id`
            JOIN `shifts` sh ON sh.`id` = snap.`shift_id`
            JOIN `roster_slots` rs ON rs.`id` = c.`roster_slot_id`
            WHERE snap.`command_id` = c.`id`
              AND snap.`final` = 1 AND snap.`environment` = 'production'
              AND snap.`integrity_state` = 'production_verified'
              AND ra.`id` = c.`roster_assignment_id`
              AND ra.`officer_id` = NEW.`officer_id`
              AND ra.`status` = 'confirmed' AND ra.`active_key` = c.`roster_slot_id`
              AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
              AND sh.`id` = c.`shift_id` AND sh.`status` = 'confirmed'
              AND sh.`check_in_at` IS NULL AND sh.`check_out_at` IS NULL
              AND sh.`environment` = 'production' AND sh.`integrity_state` = 'production_verified'
              AND rs.`version` = NEW.`expected_slot_version`
          ))
      )
  ) THEN RAISE(ABORT, 'assignment_evidence_token_command_binding_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_evidence_tokens_no_update_v6`
BEFORE UPDATE ON `assignment_evidence_tokens`
BEGIN SELECT RAISE(ABORT, 'assignment_evidence_tokens_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER `assignment_evidence_tokens_no_delete_v6`
BEFORE DELETE ON `assignment_evidence_tokens`
BEGIN SELECT RAISE(ABORT, 'assignment_evidence_tokens_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER `activation_snapshot_token_binding_v6`
BEFORE INSERT ON `assignment_activation_snapshots`
WHEN NEW.`environment` = 'production'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `assignment_evidence_tokens` token
    WHERE token.`command_id` = NEW.`command_id`
      AND token.`checkpoint` = 'activation'
      AND token.`roster_slot_id` = (SELECT c.`roster_slot_id` FROM `assignment_activation_commands` c WHERE c.`id` = NEW.`command_id`)
      AND token.`officer_id` = NEW.`officer_id`
      AND token.`funding_evidence` = NEW.`funding_evidence`
      AND token.`site_evidence` = NEW.`site_evidence`
      AND token.`launch_evidence` = NEW.`launch_evidence`
      AND token.`officer_evidence` = NEW.`officer_evidence`
      AND token.`employer_evidence` = NEW.`employer_evidence`
      AND token.`schedule_evidence` = NEW.`schedule_evidence`
      AND token.`created_at` = NEW.`created_at`
  ) THEN RAISE(ABORT, 'activation_snapshot_evidence_token_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_decision_token_binding_v6`
BEFORE INSERT ON `assignment_activation_decisions`
WHEN NEW.`environment` = 'production'
  AND NEW.`decision` IN ('activated','passed','failed')
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `assignment_evidence_tokens` token
    WHERE token.`command_id` = NEW.`command_id`
      AND token.`checkpoint` = NEW.`checkpoint`
      AND token.`evaluation_hash` = NEW.`evaluation_hash`
      AND token.`evaluated_at` = NEW.`evaluated_at`
  ) THEN RAISE(ABORT, 'activation_decision_evidence_token_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_final_token_seal_v6`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `assignment_evidence_tokens` token
    WHERE token.`command_id` = NEW.`id`
      AND token.`checkpoint` = 'activation'
      AND token.`roster_slot_id` = NEW.`roster_slot_id`
      AND token.`officer_id` = NEW.`officer_id`
      AND token.`expected_slot_version` = NEW.`expected_slot_version`
  ) THEN RAISE(ABORT, 'activation_final_evidence_token_missing') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM `assignment_workforce_snapshots` aws
    WHERE aws.`roster_assignment_id` = NEW.`roster_assignment_id`
      AND aws.`officer_id` = NEW.`officer_id`
      AND aws.`environment` = 'production'
      AND aws.`decision` = 'production_verified'
  ) THEN RAISE(ABORT, 'activation_workforce_snapshot_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_workforce_snapshot_source_guard_v6`
BEFORE INSERT ON `assignment_workforce_snapshots`
WHEN NEW.`environment` = 'production'
BEGIN
  SELECT CASE WHEN NEW.`decision` <> 'production_verified'
    OR NEW.`blockers` <> '[]'
    OR NOT EXISTS (
      SELECT 1 FROM `roster_assignments` ra
      JOIN `assignment_activation_commands` c ON c.`roster_assignment_id` = ra.`id`
        AND c.`state` = 'reserved' AND c.`environment` = 'production'
      JOIN `assignment_evidence_tokens` token ON token.`command_id` = c.`id`
        AND token.`checkpoint` = 'activation' AND token.`officer_id` = NEW.`officer_id`
        AND token.`created_at` = NEW.`captured_at`
      JOIN `workforce_engagements` we ON we.`id` = NEW.`workforce_engagement_id`
        AND we.`officer_id` = NEW.`officer_id` AND we.`environment` = 'production'
        AND we.`status` = 'active' AND we.`active_key` = we.`officer_id`
      JOIN `workforce_employers` emp ON emp.`id` = NEW.`employer_id`
        AND emp.`id` = we.`employer_id` AND emp.`legal_name` = NEW.`employer_legal_name`
        AND emp.`environment` = 'production'
      JOIN `workforce_terms_acceptances` wta ON wta.`active_key` = we.`id`
        AND wta.`terms_version` = NEW.`terms_version`
        AND wta.`environment` = 'production' AND wta.`integrity_state` = 'verified'
      WHERE ra.`id` = NEW.`roster_assignment_id`
        AND ra.`officer_id` = NEW.`officer_id`
        AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
        AND ra.`status` = 'reserved' AND ra.`active_key` IS NULL
        AND we.`model` = NEW.`workforce_model`
    )
  THEN RAISE(ABORT, 'assignment_workforce_snapshot_source_invalid') END;
END;
--> statement-breakpoint

CREATE TRIGGER `activation_epoch_launchcontrols_insert_v6`
AFTER INSERT ON `launch_controls`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_launchcontrols_update_v6`
AFTER UPDATE ON `launch_controls`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_launchcontrols_delete_v6`
AFTER DELETE ON `launch_controls`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officers_insert_v6`
AFTER INSERT ON `officers`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officers_update_v6`
AFTER UPDATE ON `officers`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officers_delete_v6`
AFTER DELETE ON `officers`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerservices_insert_v6`
AFTER INSERT ON `officer_services`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerservices_update_v6`
AFTER UPDATE ON `officer_services`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerservices_delete_v6`
AFTER DELETE ON `officer_services`
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_clients_insert_v6`
AFTER INSERT ON `clients`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_clients_update_v6`
AFTER UPDATE ON `clients`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_clients_delete_v6`
AFTER DELETE ON `clients`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_bookings_insert_v6`
AFTER INSERT ON `bookings`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_bookings_update_v6`
AFTER UPDATE ON `bookings`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_bookings_delete_v6`
AFTER DELETE ON `bookings`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_operationalsites_insert_v6`
AFTER INSERT ON `operational_sites`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_operationalsites_update_v6`
AFTER UPDATE ON `operational_sites`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_operationalsites_delete_v6`
AFTER DELETE ON `operational_sites`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_siteposts_insert_v6`
AFTER INSERT ON `site_posts`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_siteposts_update_v6`
AFTER UPDATE ON `site_posts`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_siteposts_delete_v6`
AFTER DELETE ON `site_posts`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_rosterslots_insert_v6`
AFTER INSERT ON `roster_slots`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_rosterslots_update_v6`
AFTER UPDATE ON `roster_slots`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_rosterslots_delete_v6`
AFTER DELETE ON `roster_slots`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_bookingfundingreconciliations_insert_v6`
AFTER INSERT ON `booking_funding_reconciliations`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_bookingfundingreconciliations_update_v6`
AFTER UPDATE ON `booking_funding_reconciliations`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_bookingfundingreconciliations_delete_v6`
AFTER DELETE ON `booking_funding_reconciliations`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_siteriskassessments_insert_v6`
AFTER INSERT ON `site_risk_assessments`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_siteriskassessments_update_v6`
AFTER UPDATE ON `site_risk_assessments`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_siteriskassessments_delete_v6`
AFTER DELETE ON `site_risk_assessments`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_postorderapprovals_insert_v6`
AFTER INSERT ON `post_order_approvals`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_postorderapprovals_update_v6`
AFTER UPDATE ON `post_order_approvals`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_postorderapprovals_delete_v6`
AFTER DELETE ON `post_order_approvals`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officersiteinductions_insert_v6`
AFTER INSERT ON `officer_site_inductions`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officersiteinductions_update_v6`
AFTER UPDATE ON `officer_site_inductions`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officersiteinductions_delete_v6`
AFTER DELETE ON `officer_site_inductions`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_compliancerecords_insert_v6`
AFTER INSERT ON `compliance_records`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_compliancerecords_update_v6`
AFTER UPDATE ON `compliance_records`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_compliancerecords_delete_v6`
AFTER DELETE ON `compliance_records`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerpassports_insert_v6`
AFTER INSERT ON `officer_passports`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerpassports_update_v6`
AFTER UPDATE ON `officer_passports`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerpassports_delete_v6`
AFTER DELETE ON `officer_passports`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerendorsements_insert_v6`
AFTER INSERT ON `officer_endorsements`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerendorsements_update_v6`
AFTER UPDATE ON `officer_endorsements`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerendorsements_delete_v6`
AFTER DELETE ON `officer_endorsements`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforceengagements_insert_v6`
AFTER INSERT ON `workforce_engagements`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforceengagements_update_v6`
AFTER UPDATE ON `workforce_engagements`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforceengagements_delete_v6`
AFTER DELETE ON `workforce_engagements`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforceemployers_insert_v6`
AFTER INSERT ON `workforce_employers`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforceemployers_update_v6`
AFTER UPDATE ON `workforce_employers`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforceemployers_delete_v6`
AFTER DELETE ON `workforce_employers`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforcetermsacceptances_insert_v6`
AFTER INSERT ON `workforce_terms_acceptances`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforcetermsacceptances_update_v6`
AFTER UPDATE ON `workforce_terms_acceptances`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforcetermsacceptances_delete_v6`
AFTER DELETE ON `workforce_terms_acceptances`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_employercomplianceevidence_insert_v6`
AFTER INSERT ON `employer_compliance_evidence`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_employercomplianceevidence_update_v6`
AFTER UPDATE ON `employer_compliance_evidence`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_employercomplianceevidence_delete_v6`
AFTER DELETE ON `employer_compliance_evidence`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officeravailabilitywindows_insert_v6`
AFTER INSERT ON `officer_availability_windows`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officeravailabilitywindows_update_v6`
AFTER UPDATE ON `officer_availability_windows`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officeravailabilitywindows_delete_v6`
AFTER DELETE ON `officer_availability_windows`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officertravelassessments_insert_v6`
AFTER INSERT ON `officer_travel_assessments`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officertravelassessments_update_v6`
AFTER UPDATE ON `officer_travel_assessments`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officertravelassessments_delete_v6`
AFTER DELETE ON `officer_travel_assessments`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerworkcommitments_insert_v6`
AFTER INSERT ON `officer_work_commitments`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerworkcommitments_update_v6`
AFTER UPDATE ON `officer_work_commitments`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_officerworkcommitments_delete_v6`
AFTER DELETE ON `officer_work_commitments`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_rosterassignments_insert_v6`
AFTER INSERT ON `roster_assignments`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_rosterassignments_update_v6`
AFTER UPDATE ON `roster_assignments`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_rosterassignments_delete_v6`
AFTER DELETE ON `roster_assignments`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_reliefdispatches_insert_v6`
AFTER INSERT ON `relief_dispatches`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_reliefdispatches_update_v6`
AFTER UPDATE ON `relief_dispatches`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_reliefdispatches_delete_v6`
AFTER DELETE ON `relief_dispatches`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_shifts_insert_v6`
AFTER INSERT ON `shifts`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_shifts_update_v6`
AFTER UPDATE ON `shifts`
WHEN OLD.`environment` = 'production' OR NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_shifts_delete_v6`
AFTER DELETE ON `shifts`
WHEN OLD.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforcehourreservations_insert_v6`
AFTER INSERT ON `workforce_hour_reservations`
WHEN EXISTS (SELECT 1 FROM `workforce_engagements` we WHERE we.`id` = NEW.`workforce_engagement_id` AND we.`environment` = 'production')
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforcehourreservations_update_v6`
AFTER UPDATE ON `workforce_hour_reservations`
WHEN EXISTS (SELECT 1 FROM `workforce_engagements` we WHERE we.`id` = NEW.`workforce_engagement_id` AND we.`environment` = 'production') OR EXISTS (SELECT 1 FROM `workforce_engagements` we WHERE we.`id` = OLD.`workforce_engagement_id` AND we.`environment` = 'production')
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_workforcehourreservations_delete_v6`
AFTER DELETE ON `workforce_hour_reservations`
WHEN EXISTS (SELECT 1 FROM `workforce_engagements` we WHERE we.`id` = OLD.`workforce_engagement_id` AND we.`environment` = 'production')
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
--> statement-breakpoint


CREATE INDEX IF NOT EXISTS `officer_commitments_environment_window_idx`
ON `officer_work_commitments` (`officer_id`,`environment`,`status`,`starts_at`,`ends_at`);
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_provenance_insert_v6`
BEFORE INSERT ON `officer_work_commitments`
WHEN NOT (
  (NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
  OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'verified')
)
BEGIN SELECT RAISE(ABORT,'officer_work_commitment_provenance_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_provenance_immutable_v6`
BEFORE UPDATE OF `environment`,`integrity_state` ON `officer_work_commitments`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN SELECT RAISE(ABORT,'officer_work_commitment_provenance_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_production_lifecycle_v6`
BEFORE UPDATE ON `officer_work_commitments`
WHEN OLD.`environment` = 'production'
  AND NOT (
    OLD.`status` = 'declared' AND NEW.`status` = 'cancelled'
    AND NEW.`id` IS OLD.`id` AND NEW.`officer_id` IS OLD.`officer_id`
    AND NEW.`source_type` IS OLD.`source_type` AND NEW.`source_reference` IS OLD.`source_reference`
    AND NEW.`starts_at` IS OLD.`starts_at` AND NEW.`ends_at` IS OLD.`ends_at`
    AND NEW.`environment` IS OLD.`environment` AND NEW.`integrity_state` IS OLD.`integrity_state`
    AND NEW.`evidence_reference` IS OLD.`evidence_reference`
    AND NEW.`verified_at` IS OLD.`verified_at` AND NEW.`expires_at` IS OLD.`expires_at`
    AND NEW.`created_at` IS OLD.`created_at`
  )
BEGIN SELECT RAISE(ABORT,'production_work_commitment_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_production_no_delete_v6`
BEFORE DELETE ON `officer_work_commitments`
WHEN OLD.`environment` = 'production'
BEGIN SELECT RAISE(ABORT,'production_work_commitment_delete_forbidden'); END;
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_insert_guard_v6`
BEFORE INSERT ON `officer_work_commitments`
WHEN NEW.`environment` = 'production' AND NEW.`status` <> 'cancelled'
BEGIN

  SELECT CASE WHEN
    NEW.`integrity_state` <> 'verified'
    OR NEW.`status` <> 'declared'
    OR julianday(NEW.`starts_at`) IS NULL
    OR julianday(NEW.`ends_at`) IS NULL
    OR julianday(NEW.`ends_at`) <= julianday(NEW.`starts_at`)
    OR strftime('%f',NEW.`starts_at`) <> '00.000'
    OR strftime('%f',NEW.`ends_at`) <> '00.000'
    OR length(trim(NEW.`source_type`)) = 0
    OR length(trim(NEW.`source_reference`)) = 0
    OR NEW.`evidence_reference` IS NULL OR length(trim(NEW.`evidence_reference`)) = 0
    OR julianday(NEW.`verified_at`) IS NULL
    OR julianday(NEW.`verified_at`) > julianday(CURRENT_TIMESTAMP, '+5 minutes')
    OR julianday(NEW.`expires_at`) IS NULL
    OR julianday(NEW.`expires_at`) < julianday(NEW.`ends_at`)
  THEN RAISE(ABORT,'production_work_commitment_evidence_invalid') END;

  SELECT CASE WHEN
    EXISTS (
      SELECT 1 FROM `roster_assignments` ra
      JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
      WHERE ra.`officer_id` = NEW.`officer_id`
        AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
        AND ra.`status` NOT IN ('cancelled','replaced','released')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `relief_dispatches` rd
      JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
      WHERE rd.`replacement_officer_id` = NEW.`officer_id`
        AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
        AND rd.`status` NOT IN ('cancelled','replaced')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `officer_work_commitments` other
      WHERE other.`id` <> NEW.`id`
        AND other.`officer_id` = NEW.`officer_id`
        AND other.`environment` = 'production'
        AND other.`integrity_state` = 'verified'
        AND other.`status` = 'declared'
        AND julianday(other.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(other.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
  THEN RAISE(ABORT,'production_work_commitment_rest_conflict') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM `workforce_engagements` we
    WHERE we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND (we.`weekly_hour_cap` IS NULL OR we.`weekly_hour_cap` <= 0)
  ) THEN RAISE(ABORT,'direct_flex_weekly_cap_missing') END;

  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE commitment_weeks(`iso_week_start`) AS (
      SELECT date(NEW.`starts_at`,'+2 hours',
        printf('-%d days',(CAST(strftime('%w',NEW.`starts_at`,'+2 hours') AS INTEGER)+6)%7))
      UNION ALL
      SELECT date(`iso_week_start`,'+7 days') FROM commitment_weeks
      WHERE julianday(date(`iso_week_start`,'+7 days')||'T00:00:00+02:00') < julianday(NEW.`ends_at`)
    )
    SELECT 1 FROM commitment_weeks week
    JOIN `workforce_engagements` we
      ON we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND we.`weekly_hour_cap` > 0
    WHERE
      CAST(ROUND((
        MIN(julianday(NEW.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
        - MAX(julianday(NEW.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
      )*1440) AS INTEGER)
      + COALESCE((
        SELECT SUM(r.`reserved_minutes`)
        FROM `workforce_hour_reservations` r
        WHERE r.`officer_id` = NEW.`officer_id`
          AND r.`status` = 'active'
          AND r.`iso_week_start` = week.`iso_week_start`
          AND (
            (r.`source_type` = 'assignment' AND EXISTS (
              SELECT 1 FROM `roster_assignments` ra
              WHERE ra.`id` = r.`source_id` AND ra.`id` = r.`roster_assignment_id`
                AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
            ))
            OR
            (r.`source_type` = 'relief' AND EXISTS (
              SELECT 1 FROM `relief_dispatches` rd
              WHERE rd.`id` = r.`source_id` AND rd.`id` = r.`relief_dispatch_id`
                AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
            ))
          )
      ),0)
      + COALESCE((
        SELECT SUM(CAST(ROUND((
          MIN(julianday(other.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
          - MAX(julianday(other.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
        )*1440) AS INTEGER))
        FROM `officer_work_commitments` other
        WHERE other.`id` <> NEW.`id`
          AND other.`officer_id` = NEW.`officer_id`
          AND other.`environment` = 'production'
          AND other.`integrity_state` = 'verified'
          AND other.`status` = 'declared'
          AND julianday(other.`starts_at`) < julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
          AND julianday(other.`ends_at`) > julianday(week.`iso_week_start`||'T00:00:00+02:00')
      ),0)
      > we.`weekly_hour_cap` * 60
  ) THEN RAISE(ABORT,'production_work_commitment_weekly_cap_exceeded') END;

END;
--> statement-breakpoint
CREATE TRIGGER `officer_work_commitment_update_guard_v6`
BEFORE UPDATE ON `officer_work_commitments`
WHEN NEW.`environment` = 'production' AND NEW.`status` <> 'cancelled'
BEGIN

  SELECT CASE WHEN
    NEW.`integrity_state` <> 'verified'
    OR NEW.`status` <> 'declared'
    OR julianday(NEW.`starts_at`) IS NULL
    OR julianday(NEW.`ends_at`) IS NULL
    OR julianday(NEW.`ends_at`) <= julianday(NEW.`starts_at`)
    OR strftime('%f',NEW.`starts_at`) <> '00.000'
    OR strftime('%f',NEW.`ends_at`) <> '00.000'
    OR length(trim(NEW.`source_type`)) = 0
    OR length(trim(NEW.`source_reference`)) = 0
    OR NEW.`evidence_reference` IS NULL OR length(trim(NEW.`evidence_reference`)) = 0
    OR julianday(NEW.`verified_at`) IS NULL
    OR julianday(NEW.`verified_at`) > julianday(CURRENT_TIMESTAMP, '+5 minutes')
    OR julianday(NEW.`expires_at`) IS NULL
    OR julianday(NEW.`expires_at`) < julianday(NEW.`ends_at`)
  THEN RAISE(ABORT,'production_work_commitment_evidence_invalid') END;

  SELECT CASE WHEN
    EXISTS (
      SELECT 1 FROM `roster_assignments` ra
      JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
      WHERE ra.`officer_id` = NEW.`officer_id`
        AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
        AND ra.`status` NOT IN ('cancelled','replaced','released')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `relief_dispatches` rd
      JOIN `roster_slots` rs ON rs.`id` = rd.`roster_slot_id`
      WHERE rd.`replacement_officer_id` = NEW.`officer_id`
        AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
        AND rd.`status` NOT IN ('cancelled','replaced')
        AND julianday(rs.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(rs.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
    OR EXISTS (
      SELECT 1 FROM `officer_work_commitments` other
      WHERE other.`id` <> NEW.`id`
        AND other.`officer_id` = NEW.`officer_id`
        AND other.`environment` = 'production'
        AND other.`integrity_state` = 'verified'
        AND other.`status` = 'declared'
        AND julianday(other.`starts_at`) < julianday(NEW.`ends_at`,'+8 hours')
        AND julianday(other.`ends_at`) > julianday(NEW.`starts_at`,'-8 hours')
    )
  THEN RAISE(ABORT,'production_work_commitment_rest_conflict') END;

  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM `workforce_engagements` we
    WHERE we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND (we.`weekly_hour_cap` IS NULL OR we.`weekly_hour_cap` <= 0)
  ) THEN RAISE(ABORT,'direct_flex_weekly_cap_missing') END;

  SELECT CASE WHEN EXISTS (
    WITH RECURSIVE commitment_weeks(`iso_week_start`) AS (
      SELECT date(NEW.`starts_at`,'+2 hours',
        printf('-%d days',(CAST(strftime('%w',NEW.`starts_at`,'+2 hours') AS INTEGER)+6)%7))
      UNION ALL
      SELECT date(`iso_week_start`,'+7 days') FROM commitment_weeks
      WHERE julianday(date(`iso_week_start`,'+7 days')||'T00:00:00+02:00') < julianday(NEW.`ends_at`)
    )
    SELECT 1 FROM commitment_weeks week
    JOIN `workforce_engagements` we
      ON we.`officer_id` = NEW.`officer_id`
      AND we.`environment` = 'production'
      AND we.`model` = 'direct_flex'
      AND we.`status` = 'active'
      AND we.`active_key` = we.`officer_id`
      AND we.`weekly_hour_cap` > 0
    WHERE
      CAST(ROUND((
        MIN(julianday(NEW.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
        - MAX(julianday(NEW.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
      )*1440) AS INTEGER)
      + COALESCE((
        SELECT SUM(r.`reserved_minutes`)
        FROM `workforce_hour_reservations` r
        WHERE r.`officer_id` = NEW.`officer_id`
          AND r.`status` = 'active'
          AND r.`iso_week_start` = week.`iso_week_start`
          AND (
            (r.`source_type` = 'assignment' AND EXISTS (
              SELECT 1 FROM `roster_assignments` ra
              WHERE ra.`id` = r.`source_id` AND ra.`id` = r.`roster_assignment_id`
                AND ra.`environment` = 'production' AND ra.`integrity_state` = 'production_verified'
            ))
            OR
            (r.`source_type` = 'relief' AND EXISTS (
              SELECT 1 FROM `relief_dispatches` rd
              WHERE rd.`id` = r.`source_id` AND rd.`id` = r.`relief_dispatch_id`
                AND rd.`environment` = 'production' AND rd.`integrity_state` = 'production_verified'
            ))
          )
      ),0)
      + COALESCE((
        SELECT SUM(CAST(ROUND((
          MIN(julianday(other.`ends_at`),julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00'))
          - MAX(julianday(other.`starts_at`),julianday(week.`iso_week_start`||'T00:00:00+02:00'))
        )*1440) AS INTEGER))
        FROM `officer_work_commitments` other
        WHERE other.`id` <> NEW.`id`
          AND other.`officer_id` = NEW.`officer_id`
          AND other.`environment` = 'production'
          AND other.`integrity_state` = 'verified'
          AND other.`status` = 'declared'
          AND julianday(other.`starts_at`) < julianday(date(week.`iso_week_start`,'+7 days')||'T00:00:00+02:00')
          AND julianday(other.`ends_at`) > julianday(week.`iso_week_start`||'T00:00:00+02:00')
      ),0)
      > we.`weekly_hour_cap` * 60
  ) THEN RAISE(ABORT,'production_work_commitment_weekly_cap_exceeded') END;

END;
--> statement-breakpoint
CREATE TRIGGER `workforce_engagement_binding_immutable_v6`
BEFORE UPDATE OF `officer_id`,`employer_id`,`model`,`environment` ON `workforce_engagements`
WHEN (NEW.`officer_id` IS NOT OLD.`officer_id` OR NEW.`employer_id` IS NOT OLD.`employer_id`
  OR NEW.`model` IS NOT OLD.`model` OR NEW.`environment` IS NOT OLD.`environment`)
  AND (
    EXISTS (SELECT 1 FROM `workforce_hour_reservations` r WHERE r.`workforce_engagement_id` = OLD.`id`)
    OR EXISTS (SELECT 1 FROM `assignment_activation_snapshots` s WHERE s.`workforce_engagement_id` = OLD.`id`)
  )
BEGIN SELECT RAISE(ABORT,'workforce_engagement_binding_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `relief_dispatch_provenance_immutable_v6`
BEFORE UPDATE OF `environment`,`integrity_state` ON `relief_dispatches`
WHEN (NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`)
  AND EXISTS (SELECT 1 FROM `workforce_hour_reservations` r WHERE r.`relief_dispatch_id` = OLD.`id`)
BEGIN SELECT RAISE(ABORT,'relief_dispatch_provenance_immutable'); END;
--> statement-breakpoint
