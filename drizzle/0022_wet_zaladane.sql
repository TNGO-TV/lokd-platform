CREATE TABLE `officer_conversion_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`officer_id` text NOT NULL,
	`booking_id` text,
	`workforce_engagement_id` text,
	`route` text NOT NULL,
	`status` text DEFAULT 'enquiry' NOT NULL,
	`active_key` text,
	`officer_grade` text NOT NULL,
	`specialist_category` text DEFAULT 'standard' NOT NULL,
	`completed_service_months` integer DEFAULT 0 NOT NULL,
	`annual_guaranteed_cash_cents` integer,
	`minimum_fee_cents` integer NOT NULL,
	`tenure_percent` integer NOT NULL,
	`percentage_fee_cents` integer,
	`calculated_fee_cents` integer NOT NULL,
	`policy_version` text NOT NULL,
	`clause_version` text NOT NULL,
	`clause_status` text DEFAULT 'pending_acknowledgement' NOT NULL,
	`client_employer_pack_status` text DEFAULT 'pending' NOT NULL,
	`lokd_payroll_closeout_status` text DEFAULT 'pending' NOT NULL,
	`psira_transfer_status` text DEFAULT 'pending' NOT NULL,
	`fee_status` text DEFAULT 'quoted' NOT NULL,
	`offer_notified_at` text,
	`offer_accepted_at` text,
	`employment_starts_at` text,
	`final_assignment_at` text,
	`protection_ends_at` text,
	`completed_at` text,
	`owner_id` text NOT NULL,
	`environment` text DEFAULT 'demo' NOT NULL,
	`integrity_state` text DEFAULT 'synthetic' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`officer_id`) REFERENCES `officers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workforce_engagement_id`) REFERENCES `workforce_engagements`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `officer_conversion_active_idx` ON `officer_conversion_cases` (`active_key`);--> statement-breakpoint
CREATE INDEX `officer_conversion_client_status_idx` ON `officer_conversion_cases` (`client_id`,`status`);--> statement-breakpoint
CREATE INDEX `officer_conversion_officer_status_idx` ON `officer_conversion_cases` (`officer_id`,`status`);--> statement-breakpoint
CREATE INDEX `officer_conversion_queue_idx` ON `officer_conversion_cases` (`environment`,`status`,`updated_at`);--> statement-breakpoint
ALTER TABLE `clients` ADD `permanent_engagement_clause_version` text DEFAULT 'ZA-PERMANENT-ENGAGEMENT-2026-01' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `permanent_engagement_clause_status` text DEFAULT 'pending_acknowledgement' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `permanent_engagement_clause_acknowledged_at` text;--> statement-breakpoint
INSERT OR IGNORE INTO `launch_controls`
  (`code`,`label`,`category`,`status`,`evidence_level`,`evidence_reference`,`detail`,`hard_gate`,`sort_order`,
   `verified_by`,`verified_at`,`expires_at`,`version`,`updated_at`)
VALUES
  ('C1_PEA_REGISTRATION','Private Employment Agency registration','officer_conversion','pending','none',NULL,
   'Required before LOKD may charge or complete an officer placement or private recruitment case.',0,95,
   NULL,NULL,NULL,1,CURRENT_TIMESTAMP);--> statement-breakpoint
UPDATE `launch_controls` SET `status` = 'reported', `evidence_level` = 'user_reported',
  `detail` = 'The owner reports the PSiRA inspection complete; issued evidence must still be attached and independently verified.',
  `updated_at` = CURRENT_TIMESTAMP, `version` = `version` + 1
WHERE `code` = 'G2_CONTROL_ROOM_INSPECTION' AND `status` <> 'passed';--> statement-breakpoint
UPDATE `launch_controls` SET `status` = 'reported', `evidence_level` = 'user_reported',
  `detail` = 'The owner reports PSiRA registration complete; current certificate and expiry evidence must still be attached and verified.',
  `updated_at` = CURRENT_TIMESTAMP, `version` = `version` + 1
WHERE `code` = 'G3_PSIRA_CERTIFICATE' AND `status` <> 'passed';--> statement-breakpoint
CREATE TRIGGER `officer_conversion_fee_insert_guard`
BEFORE INSERT ON `officer_conversion_cases`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`fee_status` NOT IN ('quoted','payable_prefund_required','paid','cancelled')
		THEN RAISE(ABORT, 'unsupported officer conversion fee state') END);
	SELECT (CASE WHEN NEW.`fee_status` = 'paid' AND NOT EXISTS (
		SELECT 1 FROM `launch_controls` gate
		WHERE gate.`code` = 'C1_PEA_REGISTRATION' AND gate.`status` = 'passed'
			AND gate.`evidence_level` IN ('system_verified','independently_verified')
			AND gate.`evidence_reference` IS NOT NULL AND gate.`verified_at` IS NOT NULL
			AND datetime(gate.`verified_at`) <= datetime('now')
			AND gate.`expires_at` IS NOT NULL AND datetime(gate.`expires_at`) >= datetime('now')
	) THEN RAISE(ABORT, 'current PEA registration evidence required before fee clearance') END);
END;--> statement-breakpoint
CREATE TRIGGER `officer_conversion_fee_update_guard`
BEFORE UPDATE OF `fee_status` ON `officer_conversion_cases`
FOR EACH ROW
BEGIN
	SELECT (CASE WHEN NEW.`fee_status` NOT IN ('quoted','payable_prefund_required','paid','cancelled')
		THEN RAISE(ABORT, 'unsupported officer conversion fee state') END);
	SELECT (CASE WHEN NEW.`fee_status` = 'paid' AND (
		NEW.`offer_accepted_at` IS NULL OR NEW.`clause_status` <> 'acknowledged' OR NOT EXISTS (
			SELECT 1 FROM `launch_controls` gate
			WHERE gate.`code` = 'C1_PEA_REGISTRATION' AND gate.`status` = 'passed'
				AND gate.`evidence_level` IN ('system_verified','independently_verified')
				AND gate.`evidence_reference` IS NOT NULL AND gate.`verified_at` IS NOT NULL
				AND datetime(gate.`verified_at`) <= datetime('now')
				AND gate.`expires_at` IS NOT NULL AND datetime(gate.`expires_at`) >= datetime('now')
		)
	) THEN RAISE(ABORT, 'accepted offer, client clause and current PEA evidence required before fee clearance') END);
END;--> statement-breakpoint
CREATE TRIGGER `officer_conversion_completion_guard`
BEFORE UPDATE OF `status` ON `officer_conversion_cases`
FOR EACH ROW WHEN NEW.`status` = 'completed'
BEGIN
	SELECT (CASE WHEN NEW.`offer_accepted_at` IS NULL
		OR NEW.`client_employer_pack_status` <> 'ready'
		OR NEW.`lokd_payroll_closeout_status` <> 'ready'
		OR NEW.`psira_transfer_status` <> 'ready'
		OR NEW.`fee_status` <> 'paid'
		OR NEW.`clause_status` <> 'acknowledged'
		THEN RAISE(ABORT, 'officer conversion handover controls are incomplete') END);
END;
