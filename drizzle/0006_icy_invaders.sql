CREATE TABLE `assignment_workforce_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`roster_assignment_id` text NOT NULL,
	`workforce_engagement_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`workforce_model` text NOT NULL,
	`employer_legal_name` text NOT NULL,
	`terms_version` text NOT NULL,
	`decision` text NOT NULL,
	`blockers` text DEFAULT '[]' NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`captured_at` text NOT NULL,
	FOREIGN KEY (`roster_assignment_id`) REFERENCES `roster_assignments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignment_workforce_roster_assignment_idx` ON `assignment_workforce_snapshots` (`roster_assignment_id`);--> statement-breakpoint
CREATE INDEX `assignment_workforce_officer_idx` ON `assignment_workforce_snapshots` (`officer_id`);--> statement-breakpoint
CREATE INDEX `assignment_workforce_employer_idx` ON `assignment_workforce_snapshots` (`employer_id`);--> statement-breakpoint
CREATE TABLE `launch_controls` (
	`code` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`evidence_level` text DEFAULT 'none' NOT NULL,
	`evidence_reference` text,
	`detail` text DEFAULT '' NOT NULL,
	`hard_gate` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`verified_by` text,
	`verified_at` text,
	`expires_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `launch_controls_category_idx` ON `launch_controls` (`category`,`sort_order`);--> statement-breakpoint
CREATE INDEX `launch_controls_status_idx` ON `launch_controls` (`status`);--> statement-breakpoint
CREATE TABLE `workforce_employers` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`employer_type` text NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`psira_status` text DEFAULT 'pending' NOT NULL,
	`nbcpss_status` text DEFAULT 'pending' NOT NULL,
	`psspf_status` text DEFAULT 'pending' NOT NULL,
	`uif_status` text DEFAULT 'pending' NOT NULL,
	`coida_status` text DEFAULT 'pending' NOT NULL,
	`insurance_status` text DEFAULT 'pending' NOT NULL,
	`service_agreement_status` text DEFAULT 'pending' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_reviewed_at` text,
	`review_due_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workforce_employers_type_status_idx` ON `workforce_employers` (`employer_type`,`status`);--> statement-breakpoint
CREATE INDEX `workforce_employers_review_idx` ON `workforce_employers` (`review_due_at`);--> statement-breakpoint
CREATE TABLE `workforce_engagements` (
	`id` text PRIMARY KEY NOT NULL,
	`officer_id` text NOT NULL,
	`employer_id` text NOT NULL,
	`model` text NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`status` text DEFAULT 'pending_activation' NOT NULL,
	`active_key` text,
	`engagement_reference` text NOT NULL,
	`terms_version` text,
	`payroll_status` text DEFAULT 'not_ready' NOT NULL,
	`benefits_status` text DEFAULT 'not_ready' NOT NULL,
	`weekly_hour_cap` integer,
	`activated_at` text,
	`ended_at` text,
	`review_due_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employer_id`) REFERENCES `workforce_employers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `workforce_engagements_officer_status_idx` ON `workforce_engagements` (`officer_id`,`status`);--> statement-breakpoint
CREATE INDEX `workforce_engagements_employer_status_idx` ON `workforce_engagements` (`employer_id`,`status`);--> statement-breakpoint
CREATE INDEX `workforce_engagements_model_status_idx` ON `workforce_engagements` (`model`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `workforce_engagements_active_officer_idx` ON `workforce_engagements` (`active_key`);