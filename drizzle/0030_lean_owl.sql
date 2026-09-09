ALTER TABLE `psira_verification_cases` ADD `declaration` text DEFAULT 'registered' NOT NULL;--> statement-breakpoint
ALTER TABLE `psira_verification_events` ADD `declaration` text DEFAULT 'registered' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER `psira_verification_cases_insert_activation_epoch` AFTER INSERT ON `psira_verification_cases`
BEGIN
  UPDATE activation_evidence_epoch SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE singleton = 1;
END;

--> statement-breakpoint
CREATE TRIGGER `psira_verification_cases_update_activation_epoch` AFTER UPDATE ON `psira_verification_cases`
BEGIN
  UPDATE activation_evidence_epoch SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE singleton = 1;
END;

--> statement-breakpoint
CREATE TRIGGER `psira_verification_events_insert_activation_epoch` AFTER INSERT ON `psira_verification_events`
BEGIN
  UPDATE activation_evidence_epoch SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE singleton = 1;
END;
