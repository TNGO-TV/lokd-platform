-- Sandbox-only; Central allocates migration number. Initializer binds the resolved
-- policy hash/days after installing sandbox_completion_instance.
CREATE TABLE sandbox_retention_policy(singleton INTEGER PRIMARY KEY CHECK(singleton=1),policy_hash TEXT NOT NULL,retention_days INTEGER NOT NULL CHECK(retention_days BETWEEN 1 AND 90));
--> statement-breakpoint
CREATE TRIGGER sandbox_retention_policy_insert BEFORE INSERT ON sandbox_retention_policy WHEN EXISTS(SELECT 1 FROM sandbox_retention_policy) OR NOT EXISTS(SELECT 1 FROM sandbox_completion_instance WHERE singleton=1 AND mode='sandbox' AND policy_hash=NEW.policy_hash) BEGIN SELECT RAISE(ABORT,'Invalid immutable sandbox retention policy'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_retention_policy_update BEFORE UPDATE ON sandbox_retention_policy BEGIN SELECT RAISE(ABORT,'Immutable sandbox retention policy'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_retention_policy_delete BEFORE DELETE ON sandbox_retention_policy BEGIN SELECT RAISE(ABORT,'Immutable sandbox retention policy'); END;
--> statement-breakpoint
CREATE TABLE sandbox_evidence_retention(case_id TEXT PRIMARY KEY REFERENCES sandbox_identity_objects(case_id),reference TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL,payload_bytes INTEGER NOT NULL CHECK(payload_bytes>0),captured_at TEXT NOT NULL,expires_at TEXT NOT NULL,retention_days INTEGER NOT NULL,policy_hash TEXT NOT NULL,actor_id TEXT NOT NULL CHECK(length(trim(actor_id)) BETWEEN 1 AND 300),purged_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TRIGGER sandbox_evidence_retention_insert BEFORE INSERT ON sandbox_evidence_retention WHEN EXISTS(SELECT 1 FROM sandbox_evidence_retention WHERE case_id=NEW.case_id OR reference=NEW.reference) OR NOT EXISTS(
 SELECT 1 FROM sandbox_identity_objects o JOIN sandbox_identity_dispatches d ON d.case_id=o.case_id JOIN sandbox_identity_captures c ON c.id=d.capture_id JOIN sandbox_retention_policy p ON p.singleton=1 JOIN sandbox_completion_instance i ON i.singleton=1
 WHERE o.case_id=NEW.case_id AND o.reference=NEW.reference AND o.sha256=NEW.sha256 AND length(CAST(o.body AS BLOB))=NEW.payload_bytes AND o.body<>'' AND c.captured_at=NEW.captured_at AND o.expires_at=NEW.expires_at
 AND NEW.retention_days=p.retention_days AND NEW.policy_hash=p.policy_hash AND p.policy_hash=i.policy_hash AND i.mode='sandbox'
 AND julianday(o.expires_at)<=julianday('now') AND julianday(c.captured_at,'+'||p.retention_days||' days')<=julianday('now')
 AND NEW.purged_at IS strftime('%Y-%m-%dT%H:%M:%fZ',NEW.purged_at) AND abs((julianday(NEW.purged_at)-julianday('now'))*86400)<60
) BEGIN SELECT RAISE(ABORT,'Sandbox retention source or deadline is invalid'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_evidence_retention_update BEFORE UPDATE ON sandbox_evidence_retention BEGIN SELECT RAISE(ABORT,'Immutable sandbox retention audit'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_evidence_retention_delete BEFORE DELETE ON sandbox_evidence_retention BEGIN SELECT RAISE(ABORT,'Immutable sandbox retention audit'); END;
--> statement-breakpoint
DROP TRIGGER sandbox_identity_objects_update;
--> statement-breakpoint
CREATE TRIGGER sandbox_identity_objects_update BEFORE UPDATE ON sandbox_identity_objects WHEN NOT(
 OLD.body<>'' AND NEW.body='' AND NEW.case_id IS OLD.case_id AND NEW.reference IS OLD.reference AND NEW.sha256 IS OLD.sha256 AND NEW.expires_at IS OLD.expires_at AND NEW.policy_version IS OLD.policy_version
 AND EXISTS(SELECT 1 FROM sandbox_evidence_retention r WHERE r.case_id=OLD.case_id AND r.reference=OLD.reference AND r.sha256=OLD.sha256 AND r.payload_bytes=length(CAST(OLD.body AS BLOB)))
) BEGIN SELECT RAISE(ABORT,'Immutable sandbox object metadata'); END;
--> statement-breakpoint
CREATE TRIGGER sandbox_evidence_retention_clear AFTER INSERT ON sandbox_evidence_retention BEGIN UPDATE sandbox_identity_objects SET body='' WHERE case_id=NEW.case_id; END;
