CREATE TABLE `production_activation_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`request_json` text NOT NULL,
	`request_hash` text NOT NULL,
	`maker_id` text NOT NULL,
	`state` text NOT NULL,
	`approver_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER production_activation_request_immutable BEFORE UPDATE ON production_activation_approvals WHEN OLD.id IS NOT NEW.id OR OLD.request_json IS NOT NEW.request_json OR OLD.request_hash IS NOT NEW.request_hash OR OLD.maker_id IS NOT NEW.maker_id OR OLD.created_at IS NOT NEW.created_at BEGIN SELECT RAISE(ABORT,'Activation approval request is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_activation_audit_insert AFTER INSERT ON production_activation_approvals BEGIN INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.maker_id,'production_activation_prepared','activation_approval',NEW.id,NEW.request_hash,NEW.created_at); END;
--> statement-breakpoint
CREATE TRIGGER production_activation_audit_update AFTER UPDATE ON production_activation_approvals BEGIN INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',coalesce(NEW.approver_id,NEW.maker_id),'production_activation_approval_changed','activation_approval',NEW.id,NEW.state,NEW.updated_at); END;
--> statement-breakpoint
CREATE TRIGGER production_activation_no_delete BEFORE DELETE ON production_activation_approvals BEGIN SELECT RAISE(ABORT,'Activation approval history is immutable'); END;
