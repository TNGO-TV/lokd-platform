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
INSERT OR IGNORE INTO `officers`
  (`id`,`full_name`,`mobile`,`email`,`city`,`psira_number`,`psira_grade`,`psira_expiry`,`approval_status`,`banking_status`,`created_at`)
  VALUES ('OFF-001','Lerato Khumalo','+27 82 555 0184','lerato@example.co.za','Johannesburg North','PSIRA-1842','Grade B','2027-05-31','approved','verified','2026-08-01T08:00:00.000Z');--> statement-breakpoint
INSERT OR IGNORE INTO `officer_passports`
  (`officer_id`,`passport_number`,`public_token_hash`,`status`,`readiness_label`,`issued_at`,`last_reviewed_at`,`next_review_at`,`updated_at`)
  VALUES ('OFF-001','LKD-P-1842','dee950263ae8937eccc6c9d791e294830f049670f8b9c293ca8695b00fb651f5','active','LOKD Ready','2026-08-05T09:00:00.000Z','2026-08-15T09:00:00.000Z','2026-09-15','2026-08-15T09:00:00.000Z');--> statement-breakpoint
INSERT OR IGNORE INTO `officer_endorsements`
  (`id`,`officer_id`,`code`,`label`,`category`,`service_type`,`purpose_code`,`status`,`assessed_at`,`expires_at`,`next_due_at`,`assessor`,`client_visible`)
  VALUES
  ('END-CORE-001','OFF-001','core_ready','Core LOKD Ready','core',NULL,NULL,'current','2026-08-15T09:00:00.000Z','2026-09-15','2026-09-15','LOKD Academy',1),
  ('END-UNA-001','OFF-001','service_unarmed','Unarmed Security Professional','service','Unarmed',NULL,'current','2026-08-12T09:00:00.000Z','2026-11-30','2026-09-12','LOKD Academy',1),
  ('END-ARM-001','OFF-001','service_armed','Armed monthly readiness','service','Armed',NULL,'current','2026-08-05T09:00:00.000Z','2026-09-05','2026-09-05','LOKD Academy',1),
  ('END-COM-001','OFF-001','purpose_commercial_access','Commercial access','purpose',NULL,'commercial_access','current','2026-08-10T09:00:00.000Z','2026-12-31','2026-12-01','LOKD Academy',1),
  ('END-CON-001','OFF-001','purpose_construction','Construction sites','purpose',NULL,'construction','current','2026-08-10T10:00:00.000Z','2026-12-31','2026-12-01','LOKD Academy',1);
