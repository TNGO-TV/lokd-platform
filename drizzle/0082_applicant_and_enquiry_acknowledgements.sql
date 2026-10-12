-- Acknowledgement emails to the people who submit to LOKD: an officer who applies at /join and a
-- client who enquires at /contact. Until now only the team was notified; the applicant heard nothing.
--
-- SQLite cannot alter a CHECK constraint, so operational_delivery_jobs is rebuilt with two new kinds
-- ('applicant_email', 'enquiry_ack_email'). Data, indexes and triggers are carried over unchanged
-- apart from the extended kind list and the two new original-claim branches.

CREATE TABLE `operational_delivery_jobs_v2` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`source_id` text NOT NULL,
	`environment` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` text NOT NULL,
	`lease_token` text,
	`lease_expires_at` text,
	`request_json` text,
	`recipient` text,
	`provider_id` text,
	`first_attempt_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "operational_delivery_kind" CHECK(kind IN ('enquiry_crm','enquiry_email','booking_email','contract_email','applicant_email','enquiry_ack_email')),
	CONSTRAINT "operational_delivery_state" CHECK(state IN ('queued','blocked','dispatching','retry_wait','sent','delivered','failed','uncertain','cancelled')),
	CONSTRAINT "operational_delivery_environment" CHECK(environment IN ('prelaunch','production')),
	CONSTRAINT "operational_delivery_attempts" CHECK(attempts>=0 AND attempts<=5),
	CONSTRAINT "operational_delivery_request" CHECK(request_json IS NULL OR json_valid(request_json))
);
--> statement-breakpoint
INSERT INTO `operational_delivery_jobs_v2` SELECT * FROM `operational_delivery_jobs`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_delivery_history`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_delivery_binding`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `operational_delivery_original_claim`;
--> statement-breakpoint
DROP TABLE `operational_delivery_jobs`;
--> statement-breakpoint
ALTER TABLE `operational_delivery_jobs_v2` RENAME TO `operational_delivery_jobs`;
--> statement-breakpoint
CREATE UNIQUE INDEX `operational_delivery_source_idx` ON `operational_delivery_jobs` (`kind`,`source_id`);
--> statement-breakpoint
CREATE INDEX `operational_delivery_due_idx` ON `operational_delivery_jobs` (`state`,`next_attempt_at`);
--> statement-breakpoint
CREATE TRIGGER operational_delivery_history BEFORE DELETE ON operational_delivery_jobs
BEGIN SELECT RAISE(ABORT,'delivery_history_required'); END;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_binding BEFORE UPDATE ON operational_delivery_jobs
WHEN NEW.id!=OLD.id OR NEW.kind!=OLD.kind OR NEW.source_id!=OLD.source_id OR NEW.environment!=OLD.environment
 OR NEW.created_at!=OLD.created_at OR NEW.attempts<OLD.attempts
 OR (OLD.request_json IS NOT NULL AND NEW.request_json IS NOT OLD.request_json)
 OR (OLD.recipient IS NOT NULL AND NEW.recipient IS NOT OLD.recipient)
 OR (OLD.provider_id IS NOT NULL AND NEW.provider_id IS NOT OLD.provider_id)
 OR (OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS NOT OLD.first_attempt_at)
BEGIN SELECT RAISE(ABORT,'delivery_binding_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_original_claim BEFORE INSERT ON operational_delivery_jobs
WHEN EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE id=NEW.id OR (kind=NEW.kind AND source_id=NEW.source_id))
 OR NEW.state!='queued' OR NEW.attempts!=0 OR NEW.provider_id IS NOT NULL OR NEW.request_json IS NOT NULL
 OR NEW.recipient IS NOT NULL OR NEW.first_attempt_at IS NOT NULL
 OR NOT (
  (NEW.kind IN ('enquiry_crm','enquiry_email','enquiry_ack_email') AND NEW.environment='prelaunch' AND EXISTS(SELECT 1 FROM client_enquiries WHERE id=NEW.source_id AND environment='prelaunch' AND integrity_state='user_submitted'))
  OR (NEW.kind='applicant_email' AND NEW.environment='prelaunch' AND EXISTS(SELECT 1 FROM officer_applications WHERE id=NEW.source_id AND environment='prelaunch' AND integrity_state='user_submitted'))
  OR (NEW.kind='booking_email' AND NEW.environment='production' AND EXISTS(SELECT 1 FROM production_order_setups WHERE id=NEW.source_id))
  OR (NEW.kind='contract_email' AND NEW.environment='production' AND (EXISTS(SELECT 1 FROM production_signing_envelopes WHERE id=NEW.source_id) OR EXISTS(SELECT 1 FROM client_quote_offers WHERE id=NEW.source_id)))
 )
BEGIN SELECT RAISE(ABORT,'delivery_original_claim_required'); END;
--> statement-breakpoint
-- Queue the acknowledgement to the person who submitted, alongside the existing team notices.
CREATE TRIGGER operational_applicant_delivery AFTER INSERT ON officer_applications
WHEN NEW.environment='prelaunch' AND NEW.integrity_state='user_submitted'
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('applicant:'||NEW.id,'applicant_email',NEW.id,'prelaunch',NEW.created_at,NEW.created_at,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER operational_enquiry_ack_delivery AFTER INSERT ON client_enquiries
WHEN NEW.environment='prelaunch' AND NEW.integrity_state='user_submitted'
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('ack:'||NEW.id,'enquiry_ack_email',NEW.id,'prelaunch',NEW.created_at,NEW.created_at,NEW.created_at);
END;
