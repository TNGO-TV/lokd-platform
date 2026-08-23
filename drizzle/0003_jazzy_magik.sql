ALTER TABLE `bookings` ADD `engagement_model` text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `notice_window` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `roster_pattern` text DEFAULT 'monday_saturday' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `calendar_category` text DEFAULT 'ordinary' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `calendar_label` text DEFAULT 'Ordinary Monday–Saturday' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `risk_band` text DEFAULT 'Standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `risk_score` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `risk_reasons` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `required_endorsements` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `manual_review` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `shift_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `officer_total_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `gross_platform_contribution_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `pricing_version` text DEFAULT 'LOKD-PREMIUM-2026.09' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `pricing_breakdown` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `officers` ADD `flex_available` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `officers` ADD `external_work_acknowledged` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `officers` ADD `rest_window_confirmed` integer DEFAULT 0 NOT NULL;