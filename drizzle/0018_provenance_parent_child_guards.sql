-- Keep the operational graph in one provenance domain. Foreign keys establish
-- identity only; these guards additionally require every parent/child edge to
-- carry the same environment and integrity state.

CREATE TRIGGER `booking_parent_provenance_insert_v9`
BEFORE INSERT ON `bookings`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `clients` c
		WHERE c.`id` = NEW.`client_id`
			AND c.`environment` = NEW.`environment`
			AND c.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'booking_client_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `booking_parent_provenance_update_v9`
BEFORE UPDATE OF `client_id`,`environment`,`integrity_state` ON `bookings`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `clients` c
		WHERE c.`id` = NEW.`client_id`
			AND c.`environment` = NEW.`environment`
			AND c.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'booking_client_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `site_parent_provenance_insert_v9`
BEFORE INSERT ON `operational_sites`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `clients` c
		WHERE c.`id` = NEW.`client_id`
			AND c.`environment` = NEW.`environment`
			AND c.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`booking_id` IS NULL OR EXISTS (
				SELECT 1 FROM `bookings` b
				WHERE b.`id` = NEW.`booking_id`
					AND b.`client_id` = c.`id`
					AND b.`environment` = NEW.`environment`
					AND b.`integrity_state` = NEW.`integrity_state`
			))
	) THEN RAISE(ABORT, 'site_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `site_parent_provenance_update_v9`
BEFORE UPDATE OF `client_id`,`booking_id`,`environment`,`integrity_state` ON `operational_sites`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `clients` c
		WHERE c.`id` = NEW.`client_id`
			AND c.`environment` = NEW.`environment`
			AND c.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`booking_id` IS NULL OR EXISTS (
				SELECT 1 FROM `bookings` b
				WHERE b.`id` = NEW.`booking_id`
					AND b.`client_id` = c.`id`
					AND b.`environment` = NEW.`environment`
					AND b.`integrity_state` = NEW.`integrity_state`
			))
	) THEN RAISE(ABORT, 'site_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `post_parent_provenance_insert_v9`
BEFORE INSERT ON `site_posts`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operational_sites` s
		WHERE s.`id` = NEW.`site_id`
			AND s.`environment` = NEW.`environment`
			AND s.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`booking_id` IS NULL OR EXISTS (
				SELECT 1 FROM `bookings` b
				WHERE b.`id` = NEW.`booking_id`
					AND s.`booking_id` = b.`id`
					AND b.`client_id` = s.`client_id`
					AND b.`environment` = NEW.`environment`
					AND b.`integrity_state` = NEW.`integrity_state`
			))
	) THEN RAISE(ABORT, 'post_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `post_parent_provenance_update_v9`
BEFORE UPDATE OF `site_id`,`booking_id`,`environment`,`integrity_state` ON `site_posts`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operational_sites` s
		WHERE s.`id` = NEW.`site_id`
			AND s.`environment` = NEW.`environment`
			AND s.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`booking_id` IS NULL OR EXISTS (
				SELECT 1 FROM `bookings` b
				WHERE b.`id` = NEW.`booking_id`
					AND s.`booking_id` = b.`id`
					AND b.`client_id` = s.`client_id`
					AND b.`environment` = NEW.`environment`
					AND b.`integrity_state` = NEW.`integrity_state`
			))
	) THEN RAISE(ABORT, 'post_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `slot_parent_provenance_insert_v9`
BEFORE INSERT ON `roster_slots`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operational_sites` s
		JOIN `site_posts` p ON p.`id` = NEW.`post_id`
			AND p.`site_id` = s.`id` AND p.`booking_id` = NEW.`booking_id`
		JOIN `bookings` b ON b.`id` = NEW.`booking_id`
			AND b.`client_id` = s.`client_id`
		WHERE s.`id` = NEW.`site_id`
			AND s.`booking_id` = b.`id`
			AND s.`environment` = NEW.`environment`
			AND s.`integrity_state` = NEW.`integrity_state`
			AND p.`environment` = NEW.`environment`
			AND p.`integrity_state` = NEW.`integrity_state`
			AND b.`environment` = NEW.`environment`
			AND b.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'slot_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `slot_parent_provenance_update_v9`
BEFORE UPDATE OF `site_id`,`post_id`,`booking_id`,`environment`,`integrity_state` ON `roster_slots`
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `operational_sites` s
		JOIN `site_posts` p ON p.`id` = NEW.`post_id`
			AND p.`site_id` = s.`id` AND p.`booking_id` = NEW.`booking_id`
		JOIN `bookings` b ON b.`id` = NEW.`booking_id`
			AND b.`client_id` = s.`client_id`
		WHERE s.`id` = NEW.`site_id`
			AND s.`booking_id` = b.`id`
			AND s.`environment` = NEW.`environment`
			AND s.`integrity_state` = NEW.`integrity_state`
			AND p.`environment` = NEW.`environment`
			AND p.`integrity_state` = NEW.`integrity_state`
			AND b.`environment` = NEW.`environment`
			AND b.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'slot_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `shift_parent_provenance_insert_v9`
BEFORE INSERT ON `shifts`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified')
	) OR NOT EXISTS (
		SELECT 1 FROM `bookings` b
		WHERE b.`id` = NEW.`booking_id`
			AND b.`environment` = NEW.`environment`
			AND b.`integrity_state` = NEW.`integrity_state`
	) THEN RAISE(ABORT, 'shift_booking_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `shift_parent_provenance_update_v9`
BEFORE UPDATE OF `booking_id`,`officer_id`,`environment`,`integrity_state` ON `shifts`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified')
	) OR NOT EXISTS (
		SELECT 1 FROM `bookings` b
		WHERE b.`id` = NEW.`booking_id`
			AND b.`environment` = NEW.`environment`
			AND b.`integrity_state` = NEW.`integrity_state`
	) OR EXISTS (
		SELECT 1 FROM `roster_assignments` ra
		JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
		WHERE ra.`shift_id` = OLD.`id`
			AND (ra.`officer_id` <> NEW.`officer_id`
				OR ra.`environment` <> NEW.`environment`
				OR ra.`integrity_state` <> NEW.`integrity_state`
				OR rs.`booking_id` <> NEW.`booking_id`)
	) THEN RAISE(ABORT, 'shift_booking_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_parent_provenance_insert_v9`
BEFORE INSERT ON `roster_assignments`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified')
	) OR NOT EXISTS (
		SELECT 1 FROM `roster_slots` rs
		WHERE rs.`id` = NEW.`roster_slot_id`
			AND rs.`environment` = NEW.`environment`
			AND rs.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`shift_id` IS NULL OR EXISTS (
				SELECT 1 FROM `shifts` sh
				WHERE sh.`id` = NEW.`shift_id`
					AND sh.`booking_id` = rs.`booking_id`
					AND sh.`officer_id` = NEW.`officer_id`
					AND sh.`environment` = NEW.`environment`
					AND sh.`integrity_state` = NEW.`integrity_state`
			))
	) THEN RAISE(ABORT, 'assignment_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_parent_provenance_update_v9`
BEFORE UPDATE OF `roster_slot_id`,`officer_id`,`shift_id`,`environment`,`integrity_state` ON `roster_assignments`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified')
	) OR NOT EXISTS (
		SELECT 1 FROM `roster_slots` rs
		WHERE rs.`id` = NEW.`roster_slot_id`
			AND rs.`environment` = NEW.`environment`
			AND rs.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`shift_id` IS NULL OR EXISTS (
				SELECT 1 FROM `shifts` sh
				WHERE sh.`id` = NEW.`shift_id`
					AND sh.`booking_id` = rs.`booking_id`
					AND sh.`officer_id` = NEW.`officer_id`
					AND sh.`environment` = NEW.`environment`
					AND sh.`integrity_state` = NEW.`integrity_state`
			))
	) THEN RAISE(ABORT, 'assignment_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `relief_parent_provenance_insert_v9`
BEFORE INSERT ON `relief_dispatches`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified')
	) OR NOT EXISTS (
		SELECT 1 FROM `roster_slots` rs
		JOIN `operational_sites` s ON s.`id` = rs.`site_id`
		JOIN `site_posts` p ON p.`id` = rs.`post_id`
			AND p.`site_id` = s.`id` AND p.`booking_id` = rs.`booking_id`
		JOIN `bookings` b ON b.`id` = rs.`booking_id`
			AND b.`client_id` = s.`client_id`
		WHERE rs.`id` = NEW.`roster_slot_id`
			AND s.`id` = NEW.`site_id`
			AND rs.`environment` = NEW.`environment`
			AND rs.`integrity_state` = NEW.`integrity_state`
			AND s.`environment` = NEW.`environment`
			AND s.`integrity_state` = NEW.`integrity_state`
			AND p.`environment` = NEW.`environment`
			AND p.`integrity_state` = NEW.`integrity_state`
			AND b.`environment` = NEW.`environment`
			AND b.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`exception_id` IS NULL OR EXISTS (
				SELECT 1 FROM `operational_exceptions` oe
				WHERE oe.`id` = NEW.`exception_id` AND oe.`site_id` = s.`id`
			))
	) THEN RAISE(ABORT, 'relief_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `relief_parent_provenance_update_v9`
BEFORE UPDATE OF `roster_slot_id`,`site_id`,`exception_id`,`environment`,`integrity_state` ON `relief_dispatches`
BEGIN
	SELECT (CASE WHEN NOT (
		(NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
		OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified')
	) OR NOT EXISTS (
		SELECT 1 FROM `roster_slots` rs
		JOIN `operational_sites` s ON s.`id` = rs.`site_id`
		JOIN `site_posts` p ON p.`id` = rs.`post_id`
			AND p.`site_id` = s.`id` AND p.`booking_id` = rs.`booking_id`
		JOIN `bookings` b ON b.`id` = rs.`booking_id`
			AND b.`client_id` = s.`client_id`
		WHERE rs.`id` = NEW.`roster_slot_id`
			AND s.`id` = NEW.`site_id`
			AND rs.`environment` = NEW.`environment`
			AND rs.`integrity_state` = NEW.`integrity_state`
			AND s.`environment` = NEW.`environment`
			AND s.`integrity_state` = NEW.`integrity_state`
			AND p.`environment` = NEW.`environment`
			AND p.`integrity_state` = NEW.`integrity_state`
			AND b.`environment` = NEW.`environment`
			AND b.`integrity_state` = NEW.`integrity_state`
			AND (NEW.`exception_id` IS NULL OR EXISTS (
				SELECT 1 FROM `operational_exceptions` oe
				WHERE oe.`id` = NEW.`exception_id` AND oe.`site_id` = s.`id`
			))
	) THEN RAISE(ABORT, 'relief_parent_provenance_mismatch') END);
END;
--> statement-breakpoint
CREATE TRIGGER `assignment_provenance_immutable_v9`
BEFORE UPDATE OF `environment`,`integrity_state` ON `roster_assignments`
WHEN NEW.`environment` IS NOT OLD.`environment`
	OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN
	SELECT RAISE(ABORT, 'assignment_provenance_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `shift_provenance_immutable_v9`
BEFORE UPDATE OF `environment`,`integrity_state` ON `shifts`
WHEN NEW.`environment` IS NOT OLD.`environment`
	OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN
	SELECT RAISE(ABORT, 'shift_provenance_immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `relief_provenance_immutable_v9`
BEFORE UPDATE OF `environment`,`integrity_state` ON `relief_dispatches`
WHEN NEW.`environment` IS NOT OLD.`environment`
	OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN
	SELECT RAISE(ABORT, 'relief_provenance_immutable');
END;
