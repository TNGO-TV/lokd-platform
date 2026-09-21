CREATE TABLE `psira_verification_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`psira_number` text NOT NULL,
	`version` integer NOT NULL,
	`latest_event_id` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `psira_case_owner_idx` ON `psira_verification_cases` (`owner_user_id`);--> statement-breakpoint
CREATE TABLE `psira_verification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`version` integer NOT NULL,
	`psira_number` text NOT NULL,
	`kind` text NOT NULL,
	`registration_status` text NOT NULL,
	`identity_match` text NOT NULL,
	`evidence_json` text NOT NULL,
	`evidence_hash` text NOT NULL,
	`recorded_by` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recheck_at` text,
	FOREIGN KEY (`case_id`) REFERENCES `psira_verification_cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `psira_event_case_version_idx` ON `psira_verification_events` (`case_id`,`version`);--> statement-breakpoint
CREATE TRIGGER psira_evidence_no_update BEFORE UPDATE ON psira_verification_events BEGIN SELECT RAISE(ABORT, 'PSiRA evidence is append-only'); END;
--> statement-breakpoint
CREATE TRIGGER psira_evidence_no_delete BEFORE DELETE ON psira_verification_events BEGIN SELECT RAISE(ABORT, 'PSiRA evidence is append-only'); END;
