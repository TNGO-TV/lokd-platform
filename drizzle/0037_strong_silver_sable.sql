CREATE TABLE `applicant_verification_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`scenario` text NOT NULL,
	`signal` text NOT NULL,
	`mode` text DEFAULT 'sandbox' NOT NULL,
	`state` text NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`response_hash` text,
	`http_status` integer,
	`retry_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applicant_verification_request_idx` ON `applicant_verification_checks` (`case_id`,`owner_user_id`,`case_version`,`scenario`);