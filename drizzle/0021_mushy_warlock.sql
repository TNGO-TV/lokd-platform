CREATE TABLE `operator_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`source_event_id` text NOT NULL,
	`audience_role` text DEFAULT 'operations' NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'unread' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`source_event_id`) REFERENCES `domain_outbox_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_notifications_source_idx` ON `operator_notifications` (`source_event_id`);--> statement-breakpoint
CREATE INDEX `operator_notifications_queue_idx` ON `operator_notifications` (`environment`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `payroll_policy_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`jurisdiction` text DEFAULT 'ZA' NOT NULL,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`rules_json` text NOT NULL,
	`policy_hash` text NOT NULL,
	`source_reference` text NOT NULL,
	`active_key` text,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`created_by` text NOT NULL,
	`reviewed_by` text,
	`approved_by` text,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`activated_at` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_policy_active_idx` ON `payroll_policy_versions` (`active_key`);--> statement-breakpoint
CREATE INDEX `payroll_policy_effective_idx` ON `payroll_policy_versions` (`environment`,`jurisdiction`,`status`,`effective_from`);--> statement-breakpoint
CREATE TABLE `platform_readiness_controls` (
	`code` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`required_for_integration_ready` integer DEFAULT 1 NOT NULL,
	`evidence_reference` text,
	`detail` text DEFAULT '' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`checked_at` text NOT NULL,
	`checked_by` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `platform_readiness_status_idx` ON `platform_readiness_controls` (`environment`,`status`,`category`);--> statement-breakpoint
CREATE TABLE `scheduled_job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_key` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`processed_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`environment` text NOT NULL,
	`integrity_state` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `scheduled_job_runs_status_idx` ON `scheduled_job_runs` (`environment`,`job_key`,`status`,`started_at`);