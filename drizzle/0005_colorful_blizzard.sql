CREATE TABLE `officer_availability_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`source` text DEFAULT 'officer_declared' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`rest_confirmed_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `officer_availability_officer_window_idx` ON `officer_availability_windows` (`officer_id`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE INDEX `officer_availability_status_window_idx` ON `officer_availability_windows` (`status`,`starts_at`,`ends_at`);--> statement-breakpoint
CREATE TABLE `relief_dispatch_events` (
	`id` text PRIMARY KEY NOT NULL,
	`relief_dispatch_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`relief_dispatch_id`) REFERENCES `relief_dispatches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `relief_dispatch_events_dispatch_time_idx` ON `relief_dispatch_events` (`relief_dispatch_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `relief_dispatches` (
	`id` text PRIMARY KEY NOT NULL,
	`roster_slot_id` text NOT NULL,
	`site_id` text NOT NULL,
	`exception_id` text,
	`replacement_officer_id` text NOT NULL,
	`active_key` text,
	`status` text DEFAULT 'case_open' NOT NULL,
	`reason_code` text NOT NULL,
	`priority` text DEFAULT 'P1' NOT NULL,
	`requested_by` text NOT NULL,
	`requested_at` text NOT NULL,
	`response_due_at` text NOT NULL,
	`target_arrival_at` text,
	`accepted_at` text,
	`arrived_at` text,
	`closed_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`roster_slot_id`) REFERENCES `roster_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exception_id`) REFERENCES `operational_exceptions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`replacement_officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `relief_dispatches_slot_time_idx` ON `relief_dispatches` (`roster_slot_id`,`requested_at`);--> statement-breakpoint
CREATE INDEX `relief_dispatches_site_status_idx` ON `relief_dispatches` (`site_id`,`status`);--> statement-breakpoint
CREATE INDEX `relief_dispatches_officer_status_idx` ON `relief_dispatches` (`replacement_officer_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `relief_dispatches_active_slot_idx` ON `relief_dispatches` (`active_key`);--> statement-breakpoint
CREATE TABLE `roster_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`roster_slot_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`shift_id` text,
	`assignment_kind` text DEFAULT 'primary' NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`active_key` text,
	`assigned_by` text NOT NULL,
	`assigned_at` text NOT NULL,
	`confirmed_at` text,
	`released_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`roster_slot_id`) REFERENCES `roster_slots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `roster_assignments_slot_time_idx` ON `roster_assignments` (`roster_slot_id`,`assigned_at`);--> statement-breakpoint
CREATE INDEX `roster_assignments_officer_status_idx` ON `roster_assignments` (`officer_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `roster_assignments_active_slot_idx` ON `roster_assignments` (`active_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `roster_assignments_shift_idx` ON `roster_assignments` (`shift_id`);--> statement-breakpoint
CREATE TABLE `roster_slots` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`post_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`service_date` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`arrival_due_at` text NOT NULL,
	`check_in_due_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`absence_reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `operational_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `site_posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `roster_slots_site_start_idx` ON `roster_slots` (`site_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `roster_slots_status_start_idx` ON `roster_slots` (`status`,`starts_at`);