CREATE TABLE `operational_delivery_jobs` (
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
	CONSTRAINT "operational_delivery_kind" CHECK(kind IN ('enquiry_crm','enquiry_email','booking_email','contract_email')),
	CONSTRAINT "operational_delivery_state" CHECK(state IN ('queued','blocked','dispatching','retry_wait','sent','delivered','failed','uncertain','cancelled')),
	CONSTRAINT "operational_delivery_environment" CHECK(environment IN ('prelaunch','production')),
	CONSTRAINT "operational_delivery_attempts" CHECK(attempts>=0 AND attempts<=5),
	CONSTRAINT "operational_delivery_request" CHECK(request_json IS NULL OR json_valid(request_json))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operational_delivery_source_idx` ON `operational_delivery_jobs` (`kind`,`source_id`);--> statement-breakpoint
CREATE INDEX `operational_delivery_due_idx` ON `operational_delivery_jobs` (`state`,`next_attempt_at`);
--> statement-breakpoint
CREATE TRIGGER operational_enquiry_delivery AFTER INSERT ON client_enquiries
WHEN NEW.environment='prelaunch' AND NEW.integrity_state='user_submitted'
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('crm:'||NEW.id,'enquiry_crm',NEW.id,'prelaunch',NEW.created_at,NEW.created_at,NEW.created_at);
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('team:'||NEW.id,'enquiry_email',NEW.id,'prelaunch',NEW.created_at,NEW.created_at,NEW.created_at);
END;
--> statement-breakpoint
CREATE TRIGGER operational_booking_delivery AFTER INSERT ON production_order_setups
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('booking:'||NEW.id,'booking_email',NEW.id,'production',NEW.prepared_at,NEW.prepared_at,NEW.prepared_at);
END;
--> statement-breakpoint
CREATE TRIGGER operational_contract_delivery AFTER INSERT ON production_signing_envelopes
BEGIN
 INSERT INTO operational_delivery_jobs(id,kind,source_id,environment,next_attempt_at,created_at,updated_at)
 VALUES('contract:'||NEW.id,'contract_email',NEW.id,'production',NEW.issued_at,NEW.issued_at,NEW.issued_at);
END;
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
CREATE TRIGGER operational_contract_cancel AFTER INSERT ON production_envelope_cancellations
BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='agreement_cancelled',updated_at=NEW.cancelled_at
 WHERE kind='contract_email' AND source_id=NEW.envelope_id AND state IN ('queued','blocked','retry_wait');
END;
--> statement-breakpoint
CREATE TRIGGER operational_document_withdraw AFTER INSERT ON signing_document_withdrawals
BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='document_withdrawn',updated_at=NEW.withdrawn_at
 WHERE kind='contract_email' AND state IN ('queued','blocked','retry_wait')
 AND source_id IN (SELECT id FROM production_signing_envelopes WHERE document_id=NEW.document_id);
END;
--> statement-breakpoint
CREATE TRIGGER operational_signup_withdraw AFTER UPDATE ON signup_cases WHEN NEW.status='withdrawn'
BEGIN
 UPDATE operational_delivery_jobs SET state='cancelled',last_error='intake_withdrawn',updated_at=NEW.updated_at
 WHERE state IN ('queued','blocked','retry_wait') AND
 ((NEW.kind='client' AND kind IN ('enquiry_crm','enquiry_email') AND source_id=NEW.source_id)
 OR (kind='contract_email' AND source_id IN (SELECT id FROM production_signing_envelopes WHERE case_id=NEW.source_id AND case_kind=NEW.kind)));
END;
--> statement-breakpoint
CREATE TRIGGER operational_delivery_original_claim BEFORE INSERT ON operational_delivery_jobs
WHEN EXISTS(SELECT 1 FROM operational_delivery_jobs WHERE id=NEW.id OR (kind=NEW.kind AND source_id=NEW.source_id))
 OR NEW.state!='queued' OR NEW.attempts!=0 OR NEW.provider_id IS NOT NULL OR NEW.request_json IS NOT NULL
 OR NEW.recipient IS NOT NULL OR NEW.first_attempt_at IS NOT NULL
 OR NOT (
  (NEW.kind IN ('enquiry_crm','enquiry_email') AND NEW.environment='prelaunch' AND EXISTS(SELECT 1 FROM client_enquiries WHERE id=NEW.source_id AND environment='prelaunch' AND integrity_state='user_submitted'))
  OR (NEW.kind='booking_email' AND NEW.environment='production' AND EXISTS(SELECT 1 FROM production_order_setups WHERE id=NEW.source_id))
  OR (NEW.kind='contract_email' AND NEW.environment='production' AND EXISTS(SELECT 1 FROM production_signing_envelopes WHERE id=NEW.source_id))
 )
BEGIN SELECT RAISE(ABORT,'delivery_original_claim_required'); END;
