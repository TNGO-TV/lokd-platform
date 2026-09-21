CREATE TABLE `signup_cases` (
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`owner_user_id` text,
	`status` text NOT NULL,
	`public_note` text NOT NULL,
	`corrections_json` text NOT NULL,
	`version` integer NOT NULL,
	`latest_event_id` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`kind`, `source_id`)
);
--> statement-breakpoint
CREATE INDEX `signup_owner_idx` ON `signup_cases` (`owner_user_id`,`kind`);--> statement-breakpoint
CREATE TABLE `signup_events` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`version` integer NOT NULL,
	`action` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`public_note` text NOT NULL,
	`details_json` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `signup_event_version_idx` ON `signup_events` (`kind`,`source_id`,`version`);
--> statement-breakpoint
CREATE TRIGGER signup_events_no_update BEFORE UPDATE ON signup_events BEGIN
  SELECT RAISE(ABORT, 'signup evidence is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER signup_events_no_delete BEFORE DELETE ON signup_events BEGIN
  SELECT RAISE(ABORT, 'signup evidence is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER signup_owner_immutable BEFORE UPDATE ON signup_cases
WHEN OLD.owner_user_id IS NOT NULL AND NEW.owner_user_id IS NOT OLD.owner_user_id BEGIN
  SELECT RAISE(ABORT, 'signup account binding cannot be reassigned');
END;
--> statement-breakpoint
CREATE TRIGGER signup_source_guard BEFORE INSERT ON signup_cases BEGIN
  SELECT RAISE(ABORT, 'signup requires a real submitted source') WHERE NOT (
    (NEW.kind='officer' AND EXISTS (SELECT 1 FROM officer_applications WHERE id=NEW.source_id AND environment='prelaunch' AND integrity_state='user_submitted'))
    OR (NEW.kind='client' AND EXISTS (SELECT 1 FROM client_enquiries WHERE id=NEW.source_id AND environment='prelaunch' AND integrity_state='user_submitted'))
  );
END;
