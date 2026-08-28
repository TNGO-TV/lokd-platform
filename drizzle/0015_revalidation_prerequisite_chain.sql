CREATE TRIGGER `production_activation_command_base_provenance_v8`
BEFORE INSERT ON `assignment_activation_commands`
WHEN NEW.`environment` = 'production'
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `roster_slots` rs
		JOIN `bookings` b ON b.`id` = rs.`booking_id`
		JOIN `clients` client ON client.`id` = b.`client_id`
		JOIN `operational_sites` site ON site.`id` = rs.`site_id`
			AND site.`client_id` = client.`id` AND site.`booking_id` = b.`id`
		JOIN `site_posts` post ON post.`id` = rs.`post_id`
			AND post.`site_id` = site.`id` AND post.`booking_id` = b.`id`
		WHERE rs.`id` = NEW.`roster_slot_id` AND rs.`version` = NEW.`expected_slot_version`
			AND rs.`environment` = 'production' AND rs.`integrity_state` = 'production_verified'
			AND b.`environment` = 'production' AND b.`integrity_state` = 'production_verified'
			AND client.`environment` = 'production' AND client.`integrity_state` = 'production_verified'
			AND site.`environment` = 'production' AND site.`integrity_state` = 'production_verified'
			AND post.`environment` = 'production' AND post.`integrity_state` = 'production_verified'
	) THEN RAISE(ABORT, 'production_activation_command_base_provenance_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_evidence_token_time_window_v8`
BEFORE INSERT ON `assignment_evidence_tokens`
WHEN NEW.`environment` = 'production'
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_commands` c
		JOIN `roster_slots` rs ON rs.`id` = c.`roster_slot_id`
		WHERE c.`id` = NEW.`command_id`
			AND c.`roster_slot_id` = NEW.`roster_slot_id`
			AND c.`officer_id` = NEW.`officer_id`
			AND julianday(NEW.`evaluated_at`) BETWEEN julianday(CURRENT_TIMESTAMP, '-5 minutes') AND julianday(CURRENT_TIMESTAMP, '+1 minute')
			AND (
				(NEW.`checkpoint` = 'activation'
					AND julianday(NEW.`evaluated_at`) < julianday(rs.`starts_at`)
					AND julianday(CURRENT_TIMESTAMP) < julianday(rs.`starts_at`))
				OR
				(NEW.`checkpoint` <> 'activation'
					AND julianday(NEW.`evaluated_at`) < julianday(rs.`ends_at`)
					AND julianday(CURRENT_TIMESTAMP) < julianday(rs.`ends_at`))
			)
			AND (NEW.`checkpoint` <> 'check_in' OR EXISTS (
				SELECT 1 FROM `assignment_activation_snapshots` snap
				JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id` AND rv.`checkpoint` = 'check_in'
				WHERE snap.`command_id` = c.`id`
					AND julianday(rv.`scheduled_at`) <= julianday(NEW.`evaluated_at`)
					AND julianday(NEW.`evaluated_at`) <= julianday(rs.`check_in_due_at`)
					AND julianday(CURRENT_TIMESTAMP) <= julianday(rs.`check_in_due_at`)
			))
	) THEN RAISE(ABORT, 'assignment_evidence_token_shift_window_closed') END;
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_evidence_token_checkpoint_chain_v8`
BEFORE INSERT ON `assignment_evidence_tokens`
WHEN NEW.`environment` = 'production' AND NEW.`checkpoint` IN ('t_minus_2','check_in')
BEGIN
	SELECT CASE WHEN NEW.`checkpoint` = 't_minus_2' AND NOT EXISTS (
		SELECT 1 FROM `assignment_activation_commands` c
		JOIN `roster_slots` rs ON rs.`id` = c.`roster_slot_id` AND rs.`version` = NEW.`expected_slot_version`
		JOIN `assignment_activation_snapshots` snap ON snap.`command_id` = c.`id`
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id` AND rv.`checkpoint` = 't_minus_24'
		WHERE c.`id` = NEW.`command_id` AND c.`state` = 'activated'
			AND c.`environment` = 'production' AND c.`roster_slot_id` = NEW.`roster_slot_id`
			AND c.`officer_id` = NEW.`officer_id`
			AND snap.`final` = 1 AND snap.`environment` = 'production'
			AND snap.`integrity_state` = 'production_verified' AND rv.`status` = 'passed'
	) THEN RAISE(ABORT, 't_minus_24_revalidation_must_pass_first') END;
	SELECT CASE WHEN NEW.`checkpoint` = 'check_in' AND (
		SELECT COUNT(*) FROM `assignment_activation_commands` c
		JOIN `roster_slots` rs ON rs.`id` = c.`roster_slot_id` AND rs.`version` = NEW.`expected_slot_version`
		JOIN `assignment_activation_snapshots` snap ON snap.`command_id` = c.`id`
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id`
		WHERE c.`id` = NEW.`command_id` AND c.`state` = 'activated'
			AND c.`environment` = 'production' AND c.`roster_slot_id` = NEW.`roster_slot_id`
			AND c.`officer_id` = NEW.`officer_id`
			AND snap.`final` = 1 AND snap.`environment` = 'production'
			AND snap.`integrity_state` = 'production_verified'
			AND rv.`checkpoint` IN ('t_minus_24','t_minus_2') AND rv.`status` = 'passed'
	) <> 2 THEN RAISE(ABORT, 'scheduled_revalidations_must_pass_before_check_in') END;
END;
--> statement-breakpoint
CREATE TRIGGER `activation_command_shift_open_v8`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated' AND NEW.`environment` = 'production'
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `roster_slots` rs WHERE rs.`id` = NEW.`roster_slot_id`
			AND julianday(CURRENT_TIMESTAMP) < julianday(rs.`starts_at`)
			AND julianday(NEW.`completed_at`) < julianday(rs.`starts_at`)
	) THEN RAISE(ABORT, 'production_activation_shift_window_closed') END;
END;
--> statement-breakpoint
CREATE TRIGGER `production_check_in_window_v8`
BEFORE UPDATE OF `status`,`check_in_at` ON `shifts`
WHEN NEW.`status` = 'on_post' AND EXISTS (
	SELECT 1 FROM `assignment_activation_snapshots` snap
	WHERE snap.`shift_id` = NEW.`id` AND snap.`environment` = 'production'
		AND snap.`integrity_state` = 'production_verified' AND snap.`final` = 1
)
BEGIN
	SELECT CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_snapshots` snap
		JOIN `assignment_activation_commands` c ON c.`id` = snap.`command_id`
		JOIN `roster_slots` rs ON rs.`id` = c.`roster_slot_id`
		JOIN `assignment_revalidations` rv ON rv.`snapshot_id` = snap.`id` AND rv.`checkpoint` = 'check_in'
		WHERE snap.`shift_id` = NEW.`id`
			AND NEW.`check_in_at` IS NOT NULL
			AND julianday(NEW.`check_in_at`) >= julianday(rv.`scheduled_at`)
			AND julianday(NEW.`check_in_at`) <= julianday(rs.`check_in_due_at`)
			AND julianday(CURRENT_TIMESTAMP) <= julianday(rs.`check_in_due_at`)
			AND julianday(NEW.`check_in_at`) < julianday(rs.`ends_at`)
			AND julianday(CURRENT_TIMESTAMP) < julianday(rs.`ends_at`)
	) THEN RAISE(ABORT, 'production_check_in_window_closed') END;
END;
