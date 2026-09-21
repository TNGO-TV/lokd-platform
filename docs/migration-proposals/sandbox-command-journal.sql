-- Sandbox database only. Central assigns its migration path.
CREATE TABLE sandbox_command_claims(id TEXT PRIMARY KEY,owner_user_id TEXT NOT NULL,scope TEXT NOT NULL CHECK(scope IN('capture','officer_application','client_enquiry','import_finance')),request_key TEXT NOT NULL,digest TEXT NOT NULL,policy_hash TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(owner_user_id,scope,request_key));
--> statement-breakpoint
CREATE TABLE sandbox_command_receipts(command_id TEXT PRIMARY KEY REFERENCES sandbox_command_claims(id),result_json TEXT NOT NULL CHECK(json_valid(result_json)),recorded_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER sandbox_command_claims_no_replace BEFORE INSERT ON sandbox_command_claims WHEN EXISTS(SELECT 1 FROM sandbox_command_claims WHERE id=NEW.id OR (owner_user_id=NEW.owner_user_id AND scope=NEW.scope AND request_key=NEW.request_key)) BEGIN SELECT RAISE(ABORT,'Immutable sandbox command'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_command_receipts_no_replace BEFORE INSERT ON sandbox_command_receipts WHEN EXISTS(SELECT 1 FROM sandbox_command_receipts WHERE command_id=NEW.command_id) BEGIN SELECT RAISE(ABORT,'Immutable sandbox receipt'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_command_claims_no_update BEFORE UPDATE ON sandbox_command_claims BEGIN SELECT RAISE(ABORT,'Immutable sandbox command'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_command_claims_no_delete BEFORE DELETE ON sandbox_command_claims BEGIN SELECT RAISE(ABORT,'Immutable sandbox command'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_command_receipts_no_update BEFORE UPDATE ON sandbox_command_receipts BEGIN SELECT RAISE(ABORT,'Immutable sandbox receipt'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_command_receipts_no_delete BEFORE DELETE ON sandbox_command_receipts BEGIN SELECT RAISE(ABORT,'Immutable sandbox receipt'); END;
