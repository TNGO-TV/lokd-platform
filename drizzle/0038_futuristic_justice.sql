CREATE TABLE `test_enrolment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`snapshot` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_enrolment_orders` (
	`reference` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`package_id` text NOT NULL,
	`package_version` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text NOT NULL,
	`state` text NOT NULL,
	`checkout_url` text,
	`provider_id` text,
	`revision` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `test_enrolment_case_package_idx` ON `test_enrolment_orders` (`case_id`,`owner_user_id`,`case_version`,`package_id`,`package_version`);--> statement-breakpoint
CREATE TABLE `verification_recovery_events` (
	`id` text PRIMARY KEY NOT NULL,
	`check_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `applicant_verification_checks` ADD `recovery_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `applicant_verification_checks` ADD `recovery_actor` text;--> statement-breakpoint
ALTER TABLE `paystack_test_deliveries` ADD `metadata_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE TRIGGER verification_history BEFORE UPDATE ON applicant_verification_checks BEGIN
 INSERT INTO verification_recovery_events(id,check_id,snapshot,recorded_at) VALUES(lower(hex(randomblob(16))),OLD.id,json_object('state',OLD.state,'attempts',OLD.attempts,'caseVersion',OLD.case_version,'responseHash',OLD.response_hash,'httpStatus',OLD.http_status,'retryAt',OLD.retry_at,'actor',OLD.recovery_actor,'note',OLD.recovery_note,'updatedAt',OLD.updated_at),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER verification_history_no_update BEFORE UPDATE ON verification_recovery_events BEGIN SELECT RAISE(ABORT,'Verification history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER verification_history_no_delete BEFORE DELETE ON verification_recovery_events BEGIN SELECT RAISE(ABORT,'Verification history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enrolment_history BEFORE UPDATE ON test_enrolment_orders BEGIN
 INSERT INTO test_enrolment_events(id,reference,snapshot,recorded_at) VALUES(lower(hex(randomblob(16))),OLD.reference,json_object('state',OLD.state,'revision',OLD.revision,'providerId',OLD.provider_id,'note',OLD.note,'updatedAt',OLD.updated_at),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER enrolment_binding_immutable BEFORE UPDATE ON test_enrolment_orders WHEN OLD.case_id IS NOT NEW.case_id OR OLD.owner_user_id IS NOT NEW.owner_user_id OR OLD.case_version IS NOT NEW.case_version OR OLD.package_id IS NOT NEW.package_id OR OLD.package_version IS NOT NEW.package_version OR OLD.amount_minor IS NOT NEW.amount_minor OR OLD.currency IS NOT NEW.currency OR OLD.reference IS NOT NEW.reference BEGIN SELECT RAISE(ABORT,'Enrolment binding is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enrolment_history_no_update BEFORE UPDATE ON test_enrolment_events BEGIN SELECT RAISE(ABORT,'Enrolment history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER enrolment_history_no_delete BEFORE DELETE ON test_enrolment_events BEGIN SELECT RAISE(ABORT,'Enrolment history is immutable'); END;
