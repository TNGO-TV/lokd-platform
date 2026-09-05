CREATE TABLE `officer_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`pathway` text NOT NULL,
	`full_name` text NOT NULL,
	`mobile_normalized` text NOT NULL,
	`email_normalized` text NOT NULL,
	`city` text NOT NULL,
	`province` text NOT NULL,
	`psira_status` text NOT NULL,
	`psira_number` text,
	`psira_grade` text,
	`service_interests` text NOT NULL,
	`training_interests` text NOT NULL,
	`over_18_confirmed` integer NOT NULL,
	`eligibility_acknowledged` integer NOT NULL,
	`privacy_notice_version` text NOT NULL,
	`privacy_acknowledged_at` text NOT NULL,
	`identity_verification_status` text DEFAULT 'not_started' NOT NULL,
	`identity_provider` text,
	`identity_provider_reference` text,
	`identity_verified_at` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`source` text DEFAULT 'homepage' NOT NULL,
	`retention_review_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `officer_applications_mobile_idx` ON `officer_applications` (`mobile_normalized`);--> statement-breakpoint
CREATE INDEX `officer_applications_status_idx` ON `officer_applications` (`status`);--> statement-breakpoint
CREATE INDEX `officer_applications_pathway_idx` ON `officer_applications` (`pathway`);--> statement-breakpoint
CREATE INDEX `officer_applications_created_idx` ON `officer_applications` (`created_at`);