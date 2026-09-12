CREATE TABLE `production_evidence_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload_json` text NOT NULL,
	`payload_hash` text NOT NULL,
	`source_revision` integer NOT NULL,
	`prepared_by` text NOT NULL,
	`prepared_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`reason` text
);

--> statement-breakpoint
CREATE TRIGGER production_evidence_review_guard BEFORE UPDATE ON production_evidence_reviews BEGIN
 SELECT (CASE WHEN NEW.id IS NOT OLD.id OR NEW.kind IS NOT OLD.kind OR NEW.payload_json IS NOT OLD.payload_json OR NEW.payload_hash IS NOT OLD.payload_hash OR NEW.source_revision IS NOT OLD.source_revision OR NEW.prepared_by IS NOT OLD.prepared_by OR NEW.prepared_at IS NOT OLD.prepared_at OR NEW.expires_at IS NOT OLD.expires_at THEN RAISE(ABORT,'Reviewed source evidence is immutable') END);
 SELECT (CASE WHEN OLD.state!='pending' OR NEW.state NOT IN ('approved','rejected') OR NEW.decided_by IS NULL OR NEW.decided_by=OLD.prepared_by THEN RAISE(ABORT,'Independent final evidence decision required') END);
 SELECT (CASE WHEN NEW.state='approved' AND (NEW.source_revision!=(SELECT revision FROM activation_evidence_epoch WHERE singleton=1) OR NEW.expires_at<=NEW.decided_at) THEN RAISE(ABORT,'Source evidence changed before decision commit') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_evidence_review_audit AFTER UPDATE ON production_evidence_reviews BEGIN
 INSERT INTO audit_events VALUES(lower(hex(randomblob(16))),'operations',NEW.decided_by,'production_evidence_decision','evidence_review',NEW.id,NEW.state||': '||NEW.reason,NEW.decided_at);
 UPDATE activation_evidence_epoch SET revision=revision+1,updated_at=NEW.decided_at WHERE singleton=1;
END;
--> statement-breakpoint
CREATE TRIGGER production_evidence_review_no_delete BEFORE DELETE ON production_evidence_reviews BEGIN SELECT RAISE(ABORT,'Evidence review history is immutable'); END;
