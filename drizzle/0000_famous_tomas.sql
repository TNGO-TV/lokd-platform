CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`site_name` text NOT NULL,
	`site_area` text NOT NULL,
	`post_name` text NOT NULL,
	`service_type` text NOT NULL,
	`minimum_grade` text NOT NULL,
	`contract_months` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`shift_start` text NOT NULL,
	`shift_end` text NOT NULL,
	`client_price_cents` integer NOT NULL,
	`officer_rate_cents` integer NOT NULL,
	`funding_status` text DEFAULT 'unfunded' NOT NULL,
	`release_cadence` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `bookings_client_idx` ON `bookings` (`client_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`organisation_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`approval_status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `compliance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`record_type` text NOT NULL,
	`status` text NOT NULL,
	`verified_at` text,
	`expires_at` text,
	`next_due_at` text,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `compliance_officer_idx` ON `compliance_records` (`officer_id`);--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`shift_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`state` text NOT NULL,
	`release_cadence` text NOT NULL,
	`eligible_release_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ledger_officer_idx` ON `ledger_entries` (`officer_id`);--> statement-breakpoint
CREATE INDEX `ledger_state_idx` ON `ledger_entries` (`state`);--> statement-breakpoint
CREATE TABLE `offers` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`expires_at` text NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `offers_officer_idx` ON `offers` (`officer_id`);--> statement-breakpoint
CREATE INDEX `offers_booking_idx` ON `offers` (`booking_id`);--> statement-breakpoint
CREATE TABLE `officer_services` (
	`officer_id` text NOT NULL,
	`service_type` text NOT NULL,
	`qualified` integer DEFAULT 0 NOT NULL,
	`opted_in` integer DEFAULT 0 NOT NULL,
	`qualification_expiry` text,
	PRIMARY KEY(`officer_id`, `service_type`),
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `officers` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`mobile` text NOT NULL,
	`email` text NOT NULL,
	`city` text NOT NULL,
	`psira_number` text NOT NULL,
	`psira_grade` text NOT NULL,
	`psira_expiry` text NOT NULL,
	`approval_status` text DEFAULT 'pending' NOT NULL,
	`banking_status` text DEFAULT 'unverified' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payout_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`requested_at` text NOT NULL,
	`expected_settlement_date` text NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payout_officer_idx` ON `payout_requests` (`officer_id`);--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`scheduled_date` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`check_in_at` text,
	`check_out_at` text,
	`client_signoff_status` text DEFAULT 'not_due' NOT NULL,
	`signed_off_at` text,
	`earnings_cents` integer NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shifts_officer_idx` ON `shifts` (`officer_id`);--> statement-breakpoint
CREATE INDEX `shifts_booking_idx` ON `shifts` (`booking_id`);