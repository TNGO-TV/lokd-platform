CREATE TABLE `test_operating_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`client_case_id` text NOT NULL,
	`officer_case_id` text NOT NULL,
	`client_user_id` text NOT NULL,
	`officer_user_id` text NOT NULL,
	`client_version` integer NOT NULL,
	`officer_version` integer NOT NULL,
	`client_envelope_id` text NOT NULL,
	`officer_envelope_id` text NOT NULL,
	`site_brief` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`officer_amount_minor` integer NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`last_actor` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_operating_events` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER test_cycle_insert_history AFTER INSERT ON test_operating_cycles BEGIN
 INSERT INTO test_operating_events VALUES(lower(hex(randomblob(16))),NEW.id,json_object('state',NEW.state,'revision',NEW.revision,'actor',NEW.last_actor,'note',NEW.note),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER test_cycle_update_history AFTER UPDATE ON test_operating_cycles BEGIN
 INSERT INTO test_operating_events VALUES(lower(hex(randomblob(16))),NEW.id,json_object('state',NEW.state,'revision',NEW.revision,'actor',NEW.last_actor,'note',NEW.note),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER test_cycle_binding_immutable BEFORE UPDATE ON test_operating_cycles WHEN OLD.client_user_id IS NOT NEW.client_user_id OR OLD.officer_user_id IS NOT NEW.officer_user_id OR OLD.client_case_id IS NOT NEW.client_case_id OR OLD.officer_case_id IS NOT NEW.officer_case_id OR OLD.client_version IS NOT NEW.client_version OR OLD.officer_version IS NOT NEW.officer_version OR OLD.client_envelope_id IS NOT NEW.client_envelope_id OR OLD.officer_envelope_id IS NOT NEW.officer_envelope_id OR OLD.site_brief IS NOT NEW.site_brief OR OLD.amount_minor IS NOT NEW.amount_minor OR OLD.officer_amount_minor IS NOT NEW.officer_amount_minor BEGIN SELECT RAISE(ABORT,'Test cycle scope is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER test_cycle_events_no_update BEFORE UPDATE ON test_operating_events BEGIN SELECT RAISE(ABORT,'Test cycle evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER test_cycle_events_no_delete BEFORE DELETE ON test_operating_events BEGIN SELECT RAISE(ABORT,'Test cycle evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER test_cycle_current_insert BEFORE INSERT ON test_operating_cycles WHEN NOT EXISTS (
 SELECT 1 FROM signup_cases c JOIN signup_cases o ON o.kind='officer' AND o.source_id=NEW.officer_case_id
 JOIN test_agreement_envelopes ca ON ca.id=NEW.client_envelope_id JOIN test_agreement_envelopes oa ON oa.id=NEW.officer_envelope_id
 WHERE c.kind='client' AND c.source_id=NEW.client_case_id AND c.owner_user_id=NEW.client_user_id AND o.owner_user_id=NEW.officer_user_id
 AND c.version=NEW.client_version AND o.version=NEW.officer_version AND c.status='reviewed' AND o.status='reviewed'
 AND ca.state='reviewed_test' AND oa.state='reviewed_test' AND ca.case_id=c.source_id AND oa.case_id=o.source_id
 AND ca.case_version=c.version AND oa.case_version=o.version AND ca.expires_at>NEW.updated_at AND oa.expires_at>NEW.updated_at
) BEGIN SELECT RAISE(ABORT,'Test cycle evidence changed'); END;
--> statement-breakpoint
CREATE TRIGGER test_cycle_current_update BEFORE UPDATE ON test_operating_cycles WHEN NEW.state NOT IN ('cancelled','refund_pending') AND NOT EXISTS (
 SELECT 1 FROM signup_cases c JOIN signup_cases o ON o.kind='officer' AND o.source_id=NEW.officer_case_id
 JOIN test_agreement_envelopes ca ON ca.id=NEW.client_envelope_id JOIN test_agreement_envelopes oa ON oa.id=NEW.officer_envelope_id
 WHERE c.kind='client' AND c.source_id=NEW.client_case_id AND c.version=NEW.client_version AND o.version=NEW.officer_version
 AND c.status!='withdrawn' AND o.status!='withdrawn' AND ca.state='reviewed_test' AND oa.state='reviewed_test'
 AND ca.expires_at>NEW.updated_at AND oa.expires_at>NEW.updated_at
) BEGIN SELECT RAISE(ABORT,'Test cycle evidence changed'); END;
--> statement-breakpoint
CREATE TRIGGER test_cycle_no_delete BEFORE DELETE ON test_operating_cycles BEGIN SELECT RAISE(ABORT,'Test cycle history is immutable'); END;
