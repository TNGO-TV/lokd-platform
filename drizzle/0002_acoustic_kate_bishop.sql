CREATE TABLE `officer_endorsements` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`code` text NOT NULL,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`service_type` text,
	`purpose_code` text,
	`status` text DEFAULT 'training' NOT NULL,
	`assessed_at` text,
	`expires_at` text,
	`next_due_at` text,
	`assessor` text,
	`client_visible` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `officer_endorsements_officer_code_idx` ON `officer_endorsements` (`officer_id`,`code`);--> statement-breakpoint
CREATE INDEX `officer_endorsements_officer_idx` ON `officer_endorsements` (`officer_id`);--> statement-breakpoint
CREATE INDEX `officer_endorsements_purpose_idx` ON `officer_endorsements` (`purpose_code`);--> statement-breakpoint
CREATE TABLE `officer_passports` (
	`officer_id` text PRIMARY KEY NOT NULL,
	`passport_number` text NOT NULL,
	`public_token_hash` text NOT NULL,
	`status` text DEFAULT 'training' NOT NULL,
	`readiness_label` text DEFAULT 'LOKD Ready' NOT NULL,
	`issued_at` text,
	`last_reviewed_at` text,
	`next_review_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `officer_passports_number_idx` ON `officer_passports` (`passport_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `officer_passports_token_hash_idx` ON `officer_passports` (`public_token_hash`);--> statement-breakpoint
CREATE TABLE `passport_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`passport_number` text NOT NULL,
	`booking_id` text,
	`shift_id` text,
	`verification_mode` text DEFAULT 'public_qr' NOT NULL,
	`result` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `passport_scans_officer_idx` ON `passport_scans` (`officer_id`);--> statement-breakpoint
CREATE INDEX `passport_scans_shift_idx` ON `passport_scans` (`shift_id`);--> statement-breakpoint
CREATE INDEX `passport_scans_created_idx` ON `passport_scans` (`created_at`);--> statement-breakpoint
CREATE TABLE `pilot_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`reviewer_email` text,
	`route` text NOT NULL,
	`role` text NOT NULL,
	`category` text NOT NULL,
	`score` integer,
	`note` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pilot_feedback_status_idx` ON `pilot_feedback` (`status`);--> statement-breakpoint
CREATE INDEX `pilot_feedback_created_idx` ON `pilot_feedback` (`created_at`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `purpose_code` text DEFAULT 'commercial_access' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `purpose_label` text DEFAULT 'Commercial access' NOT NULL;--> statement-breakpoint
ALTER TABLE `officer_applications` ADD `purpose_interests` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `passport_verification_status` text DEFAULT 'not_checked' NOT NULL;--> statement-breakpoint
ALTER TABLE `shifts` ADD `passport_verified_at` text;--> statement-breakpoint
ALTER TABLE `shifts` ADD `passport_scan_id` text;--> statement-breakpoint
