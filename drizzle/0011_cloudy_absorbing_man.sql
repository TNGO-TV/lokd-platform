ALTER TABLE `bookings` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_sites` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `operational_sites` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `roster_slots` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `roster_slots` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_posts` ADD `environment` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `site_posts` ADD `integrity_state` text DEFAULT 'synthetic' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `client_provenance_insert_v5`
BEFORE INSERT ON `clients`
WHEN NOT ((NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'))
BEGIN SELECT RAISE(ABORT, 'client_provenance_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER `booking_provenance_insert_v5`
BEFORE INSERT ON `bookings`
WHEN NOT ((NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'))
BEGIN SELECT RAISE(ABORT, 'booking_provenance_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER `site_provenance_insert_v5`
BEFORE INSERT ON `operational_sites`
WHEN NOT ((NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'))
BEGIN SELECT RAISE(ABORT, 'site_provenance_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER `post_provenance_insert_v5`
BEFORE INSERT ON `site_posts`
WHEN NOT ((NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'))
BEGIN SELECT RAISE(ABORT, 'post_provenance_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER `slot_provenance_insert_v5`
BEFORE INSERT ON `roster_slots`
WHEN NOT ((NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
	OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'production_verified'))
BEGIN SELECT RAISE(ABORT, 'slot_provenance_invalid'); END;
--> statement-breakpoint
CREATE TRIGGER `client_provenance_immutable_v5`
BEFORE UPDATE OF `environment`,`integrity_state` ON `clients`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN SELECT RAISE(ABORT, 'client_provenance_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `booking_provenance_immutable_v5`
BEFORE UPDATE OF `environment`,`integrity_state` ON `bookings`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN SELECT RAISE(ABORT, 'booking_provenance_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `site_provenance_immutable_v5`
BEFORE UPDATE OF `environment`,`integrity_state` ON `operational_sites`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN SELECT RAISE(ABORT, 'site_provenance_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `post_provenance_immutable_v5`
BEFORE UPDATE OF `environment`,`integrity_state` ON `site_posts`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN SELECT RAISE(ABORT, 'post_provenance_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `slot_provenance_immutable_v5`
BEFORE UPDATE OF `environment`,`integrity_state` ON `roster_slots`
WHEN NEW.`environment` IS NOT OLD.`environment` OR NEW.`integrity_state` IS NOT OLD.`integrity_state`
BEGIN SELECT RAISE(ABORT, 'slot_provenance_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER `activation_base_provenance_v5`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `roster_slots` rs
		JOIN `bookings` b ON b.`id` = rs.`booking_id`
		JOIN `clients` c ON c.`id` = b.`client_id`
		JOIN `operational_sites` os ON os.`id` = rs.`site_id` AND os.`client_id` = c.`id`
		JOIN `site_posts` sp ON sp.`id` = rs.`post_id` AND sp.`site_id` = os.`id` AND sp.`booking_id` = b.`id`
		WHERE rs.`id` = NEW.`roster_slot_id`
			AND rs.`environment` = 'production' AND rs.`integrity_state` = 'production_verified'
			AND b.`environment` = 'production' AND b.`integrity_state` = 'production_verified'
			AND c.`environment` = 'production' AND c.`integrity_state` = 'production_verified'
			AND os.`environment` = 'production' AND os.`integrity_state` = 'production_verified'
			AND sp.`environment` = 'production' AND sp.`integrity_state` = 'production_verified'
	) THEN RAISE(ABORT, 'activation_base_provenance_invalid') END);
END;
--> statement-breakpoint
CREATE TRIGGER `activation_final_lifecycle_v5`
BEFORE UPDATE OF `state` ON `assignment_activation_commands`
WHEN NEW.`state` = 'activated'
BEGIN
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `roster_assignments` ra
		JOIN `roster_slots` rs ON rs.`id` = ra.`roster_slot_id`
		JOIN `shifts` sh ON sh.`id` = ra.`shift_id`
		WHERE ra.`id` = NEW.`roster_assignment_id` AND ra.`roster_slot_id` = NEW.`roster_slot_id`
			AND ra.`officer_id` = NEW.`officer_id` AND ra.`active_key` = NEW.`roster_slot_id`
			AND ra.`status` = 'confirmed' AND ra.`environment` = 'production'
			AND ra.`integrity_state` = 'production_verified'
			AND rs.`version` = NEW.`expected_slot_version` + 1 AND rs.`status` = 'scheduled'
			AND sh.`id` = NEW.`shift_id` AND sh.`officer_id` = NEW.`officer_id`
			AND sh.`status` = 'confirmed' AND sh.`environment` = 'production'
			AND sh.`integrity_state` = 'production_verified'
	) THEN RAISE(ABORT, 'activation_final_lifecycle_invalid') END);
	SELECT (CASE WHEN NOT EXISTS (
		SELECT 1 FROM `assignment_activation_decisions` d
		WHERE d.`command_id` = NEW.`id` AND d.`checkpoint` = 'activation'
			AND d.`decision` = 'activated'
			AND NOT EXISTS (SELECT 1 FROM `assignment_activation_blockers` b WHERE b.`decision_id` = d.`id`)
	) THEN RAISE(ABORT, 'final_activation_decision_missing') END);
END;
