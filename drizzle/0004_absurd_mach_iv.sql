CREATE TABLE `incident_events` (
	`id` text PRIMARY KEY NOT NULL,
	`incident_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`incident_id`) REFERENCES `site_incidents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `incident_events_incident_time_idx` ON `incident_events` (`incident_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `operational_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`post_id` text,
	`shift_id` text,
	`exception_type` text NOT NULL,
	`priority` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`summary` text NOT NULL,
	`owner_id` text,
	`detected_at` text NOT NULL,
	`sla_due_at` text NOT NULL,
	`acknowledged_at` text,
	`resolved_at` text,
	`resolution_code` text,
	`resolution_note` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `site_posts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `operational_exceptions_site_time_idx` ON `operational_exceptions` (`site_id`,`detected_at`);--> statement-breakpoint
CREATE INDEX `operational_exceptions_status_idx` ON `operational_exceptions` (`status`);--> statement-breakpoint
CREATE INDEX `operational_exceptions_priority_idx` ON `operational_exceptions` (`priority`);--> statement-breakpoint
CREATE INDEX `operational_exceptions_shift_idx` ON `operational_exceptions` (`shift_id`);--> statement-breakpoint
CREATE TABLE `operational_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`booking_id` text,
	`name` text NOT NULL,
	`area` text NOT NULL,
	`address_label` text NOT NULL,
	`latitude_e6` integer NOT NULL,
	`longitude_e6` integer NOT NULL,
	`timezone` text DEFAULT 'Africa/Johannesburg' NOT NULL,
	`risk_band` text DEFAULT 'Standard' NOT NULL,
	`service_type` text DEFAULT 'Unarmed' NOT NULL,
	`geofence_radius_meters` integer DEFAULT 120 NOT NULL,
	`geofence_version` integer DEFAULT 1 NOT NULL,
	`telemetry_mode` text DEFAULT 'simulated' NOT NULL,
	`sensitivity_classification` text DEFAULT 'operational' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `operational_sites_client_idx` ON `operational_sites` (`client_id`);--> statement-breakpoint
CREATE INDEX `operational_sites_booking_idx` ON `operational_sites` (`booking_id`);--> statement-breakpoint
CREATE INDEX `operational_sites_status_idx` ON `operational_sites` (`status`);--> statement-breakpoint
CREATE TABLE `site_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`shift_id` text,
	`severity` text NOT NULL,
	`category` text NOT NULL,
	`summary` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`visibility` text DEFAULT 'operations' NOT NULL,
	`reported_by_type` text NOT NULL,
	`reported_by_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`reported_at` text NOT NULL,
	`owner_id` text,
	`sla_due_at` text,
	`acknowledged_at` text,
	`acknowledged_by` text,
	`resolved_at` text,
	`resolved_by` text,
	`resolution_note` text,
	`client_notified_at` text,
	`retention_review_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `site_incidents_site_time_idx` ON `site_incidents` (`site_id`,`reported_at`);--> statement-breakpoint
CREATE INDEX `site_incidents_status_idx` ON `site_incidents` (`status`);--> statement-breakpoint
CREATE INDEX `site_incidents_severity_idx` ON `site_incidents` (`severity`);--> statement-breakpoint
CREATE INDEX `site_incidents_shift_idx` ON `site_incidents` (`shift_id`);--> statement-breakpoint
CREATE TABLE `site_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`booking_id` text,
	`name` text NOT NULL,
	`service_type` text DEFAULT 'Unarmed' NOT NULL,
	`purpose_code` text DEFAULT 'commercial_access' NOT NULL,
	`minimum_grade` text DEFAULT 'Grade C' NOT NULL,
	`post_orders_version` text DEFAULT 'draft' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `site_posts_site_idx` ON `site_posts` (`site_id`);--> statement-breakpoint
CREATE INDEX `site_posts_booking_idx` ON `site_posts` (`booking_id`);--> statement-breakpoint
CREATE INDEX `site_posts_status_idx` ON `site_posts` (`status`);--> statement-breakpoint
CREATE TABLE `site_presence_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`shift_id` text,
	`officer_id` text,
	`signal_type` text NOT NULL,
	`latitude_e6` integer NOT NULL,
	`longitude_e6` integer NOT NULL,
	`accuracy_meters` integer,
	`source` text DEFAULT 'simulated' NOT NULL,
	`source_session_id` text,
	`sequence_number` integer,
	`idempotency_key` text,
	`policy_version` text DEFAULT 'demo-synthetic-v1' NOT NULL,
	`geofence_version` integer DEFAULT 1 NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`integrity_state` text DEFAULT 'synthetic' NOT NULL,
	`review_required` integer DEFAULT 0 NOT NULL,
	`captured_at` text NOT NULL,
	`received_at` text NOT NULL,
	`retention_review_at` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `site_presence_site_time_idx` ON `site_presence_signals` (`site_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `site_presence_shift_idx` ON `site_presence_signals` (`shift_id`);--> statement-breakpoint
CREATE INDEX `site_presence_officer_idx` ON `site_presence_signals` (`officer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `site_presence_idempotency_idx` ON `site_presence_signals` (`idempotency_key`);