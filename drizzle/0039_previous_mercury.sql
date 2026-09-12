CREATE TABLE `test_agreement_envelopes` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`case_id` text NOT NULL,
	`owner_user_id` text NOT NULL,
	`case_version` integer NOT NULL,
	`document_version` text NOT NULL,
	`wording` text NOT NULL,
	`content_hash` text NOT NULL,
	`context_hash` text NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`issued_by` text NOT NULL,
	`issued_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`signed_by` text,
	`signer_name` text,
	`signed_at` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`note` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `test_agreement_case_version_idx` ON `test_agreement_envelopes` (`kind`,`case_id`,`case_version`,`document_version`);--> statement-breakpoint
CREATE TABLE `test_agreement_events` (
	`id` text PRIMARY KEY NOT NULL,
	`envelope_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`recorded_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER test_agreement_insert_history AFTER INSERT ON test_agreement_envelopes BEGIN
 INSERT INTO test_agreement_events VALUES(lower(hex(randomblob(16))),NEW.id,json_object('state',NEW.state,'revision',NEW.revision,'actor',NEW.issued_by,'note',NEW.note,'contentHash',NEW.content_hash,'contextHash',NEW.context_hash),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER test_agreement_update_history AFTER UPDATE ON test_agreement_envelopes BEGIN
 INSERT INTO test_agreement_events VALUES(lower(hex(randomblob(16))),NEW.id,json_object('state',NEW.state,'revision',NEW.revision,'signer',NEW.signed_by,'signerName',NEW.signer_name,'signedAt',NEW.signed_at,'reviewer',NEW.reviewed_by,'note',NEW.note,'contentHash',NEW.content_hash,'contextHash',NEW.context_hash),NEW.updated_at);
END;
--> statement-breakpoint
CREATE TRIGGER test_agreement_binding_immutable BEFORE UPDATE ON test_agreement_envelopes WHEN OLD.kind IS NOT NEW.kind OR OLD.case_id IS NOT NEW.case_id OR OLD.owner_user_id IS NOT NEW.owner_user_id OR OLD.case_version IS NOT NEW.case_version OR OLD.document_version IS NOT NEW.document_version OR OLD.wording IS NOT NEW.wording OR OLD.content_hash IS NOT NEW.content_hash OR OLD.context_hash IS NOT NEW.context_hash OR OLD.issued_by IS NOT NEW.issued_by OR OLD.issued_at IS NOT NEW.issued_at OR OLD.expires_at IS NOT NEW.expires_at BEGIN SELECT RAISE(ABORT,'Test agreement binding is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER test_agreement_no_delete BEFORE DELETE ON test_agreement_envelopes BEGIN SELECT RAISE(ABORT,'Test agreement history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER test_agreement_events_no_update BEFORE UPDATE ON test_agreement_events BEGIN SELECT RAISE(ABORT,'Test agreement history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER test_agreement_events_no_delete BEFORE DELETE ON test_agreement_events BEGIN SELECT RAISE(ABORT,'Test agreement history is immutable'); END;
