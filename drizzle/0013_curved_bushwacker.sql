CREATE TABLE `officer_schedule_declarations` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`version` integer NOT NULL,
	`status` text NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`integrity_state` text DEFAULT 'synthetic' NOT NULL,
	`evidence_reference` text NOT NULL,
	`declared_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`supersedes_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `officer_schedule_declarations_version_idx` ON `officer_schedule_declarations` (`officer_id`,`version`);--> statement-breakpoint
CREATE INDEX `officer_schedule_declarations_status_idx` ON `officer_schedule_declarations` (`officer_id`,`environment`,`status`,`declared_at`);
--> statement-breakpoint
CREATE TRIGGER `officer_schedule_declaration_insert_guard_v7`
BEFORE INSERT ON `officer_schedule_declarations`
BEGIN
  SELECT CASE WHEN NOT (
    (NEW.`environment` = 'demo' AND NEW.`integrity_state` = 'synthetic')
    OR (NEW.`environment` = 'production' AND NEW.`integrity_state` = 'verified')
  ) OR NEW.`status` NOT IN ('current','revoked')
    OR typeof(NEW.`version`) <> 'integer' OR NEW.`version` < 1
    OR length(trim(NEW.`evidence_reference`)) = 0
    OR julianday(NEW.`declared_at`) IS NULL
    OR julianday(NEW.`expires_at`) IS NULL
    OR julianday(NEW.`expires_at`) <= julianday(NEW.`declared_at`)
    OR (NEW.`environment` = 'production' AND julianday(NEW.`declared_at`) > julianday(CURRENT_TIMESTAMP, '+5 minutes'))
  THEN RAISE(ABORT, 'officer_schedule_declaration_invalid') END;
  SELECT CASE WHEN
    (NEW.`version` = 1 AND NEW.`supersedes_id` IS NOT NULL)
    OR (NEW.`version` > 1 AND NOT EXISTS (
      SELECT 1 FROM `officer_schedule_declarations` prior
      WHERE prior.`id` = NEW.`supersedes_id`
        AND prior.`officer_id` = NEW.`officer_id`
        AND prior.`environment` = NEW.`environment`
        AND prior.`version` = NEW.`version` - 1
        AND NOT EXISTS (
          SELECT 1 FROM `officer_schedule_declarations` later
          WHERE later.`officer_id` = NEW.`officer_id`
            AND later.`environment` = NEW.`environment`
            AND later.`version` > prior.`version`
        )
    ))
  THEN RAISE(ABORT, 'officer_schedule_declaration_chain_invalid') END;
END;
--> statement-breakpoint
CREATE TRIGGER `officer_schedule_declarations_no_update_v7`
BEFORE UPDATE ON `officer_schedule_declarations`
BEGIN SELECT RAISE(ABORT, 'officer_schedule_declarations_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER `officer_schedule_declarations_no_delete_v7`
BEFORE DELETE ON `officer_schedule_declarations`
BEGIN SELECT RAISE(ABORT, 'officer_schedule_declarations_append_only'); END;
--> statement-breakpoint
CREATE TRIGGER `activation_epoch_scheduledeclaration_insert_v7`
AFTER INSERT ON `officer_schedule_declarations`
WHEN NEW.`environment` = 'production'
BEGIN
  UPDATE `activation_evidence_epoch`
  SET `revision` = `revision` + 1, `updated_at` = CURRENT_TIMESTAMP
  WHERE `singleton` = 1;
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'activation_evidence_epoch_missing') END;
END;
