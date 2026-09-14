CREATE TABLE `production_identity_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`applicant_id` text NOT NULL,
	`applicant_version` integer NOT NULL,
	`owner_user_id` text NOT NULL,
	`provider` text NOT NULL,
	`binding_hash` text NOT NULL,
	`capture_reference` text NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_identity_cases_provider_capture_reference_unique` ON `production_identity_cases` (`provider`,`capture_reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `production_identity_cases_applicant_id_applicant_version_unique` ON `production_identity_cases` (`applicant_id`,`applicant_version`);--> statement-breakpoint
CREATE TABLE `production_identity_decisions` (
	`outcome_id` text PRIMARY KEY NOT NULL,
	`decision` text NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`outcome_id`) REFERENCES `production_identity_outcomes`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "production_identity_decisions_check_1" CHECK("production_identity_decisions"."decision" IN ('approve','reject'))
);
--> statement-breakpoint
CREATE TABLE `production_identity_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`outcome` text NOT NULL,
	`provider_reference` text,
	`evidence_reference` text,
	`evidence_hash` text,
	`checked_at` text,
	`expires_at` text,
	`recorded_at` text NOT NULL,
	`recorded_by` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `production_identity_cases`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "production_identity_outcomes_check_1" CHECK("production_identity_outcomes"."outcome" IN ('pending','delivery_unknown','no_record','declined','manual_review','unavailable','verified'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `production_identity_outcomes_case_id_sequence_unique` ON `production_identity_outcomes` (`case_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `production_identity_suspensions` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`recorded_at` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `production_identity_cases`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
CREATE TRIGGER production_identity_case_guard BEFORE INSERT ON production_identity_cases BEGIN
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM production_identity_cases c JOIN production_identity_outcomes o ON o.case_id=c.id AND o.sequence=(SELECT MAX(sequence) FROM production_identity_outcomes WHERE case_id=c.id) WHERE c.applicant_id=NEW.applicant_id AND o.outcome IN ('pending','delivery_unknown','unavailable','manual_review')) THEN RAISE(ABORT,'Previous identity delivery unresolved') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM signup_cases c JOIN officer_applications a ON a.id=c.source_id WHERE c.kind='officer' AND c.source_id=NEW.applicant_id AND c.version=NEW.applicant_version AND c.owner_user_id=NEW.owner_user_id AND c.status<>'withdrawn' AND a.environment='prelaunch' AND a.integrity_state='user_submitted') THEN RAISE(ABORT,'Identity applicant changed') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_identity_outcome_guard BEFORE INSERT ON production_identity_outcomes BEGIN
 SELECT (CASE WHEN NEW.provider_reference IS NOT NULL AND EXISTS(SELECT 1 FROM production_identity_outcomes o JOIN production_identity_cases old ON old.id=o.case_id JOIN production_identity_cases current ON current.id=NEW.case_id WHERE o.provider_reference=NEW.provider_reference AND old.provider=current.provider AND old.id<>current.id) THEN RAISE(ABORT,'Provider result belongs to another identity case') END);
 SELECT (CASE WHEN NEW.sequence<>COALESCE((SELECT MAX(sequence)+1 FROM production_identity_outcomes WHERE case_id=NEW.case_id),1) THEN RAISE(ABORT,'Identity outcome changed') END);
 SELECT (CASE WHEN NEW.sequence=1 AND NEW.outcome<>'pending' THEN RAISE(ABORT,'Identity dispatch claim required') END);
 SELECT (CASE WHEN NEW.outcome='verified' AND (NEW.provider_reference IS NULL OR NEW.evidence_reference IS NULL OR NEW.evidence_hash IS NULL OR length(NEW.evidence_hash)<>64 OR NEW.checked_at IS NULL OR NEW.expires_at IS NULL OR (julianday(NEW.checked_at) IS NULL OR julianday(NEW.expires_at) IS NULL OR NOT(julianday(NEW.checked_at)<=julianday('now') AND julianday(NEW.expires_at)>julianday('now') AND julianday(NEW.checked_at)>=julianday((SELECT created_at FROM production_identity_cases WHERE id=NEW.case_id))))) THEN RAISE(ABORT,'Current identity evidence required') END);
END;
--> statement-breakpoint
CREATE VIEW current_production_identity_evidence AS
 SELECT c.*,o.id AS outcome_id,o.sequence,o.provider_reference,o.evidence_reference,o.evidence_hash,o.checked_at,o.expires_at,d.actor_id AS reviewed_by,d.recorded_at AS reviewed_at
 FROM production_identity_cases c JOIN signup_cases s ON s.kind='officer' AND s.source_id=c.applicant_id AND s.version=c.applicant_version AND s.owner_user_id=c.owner_user_id AND s.status<>'withdrawn'
 JOIN officer_applications a ON a.id=s.source_id AND a.environment='prelaunch' AND a.integrity_state='user_submitted'
 JOIN production_identity_outcomes o ON o.case_id=c.id AND o.sequence=(SELECT MAX(sequence) FROM production_identity_outcomes WHERE case_id=c.id)
 JOIN production_identity_decisions d ON d.outcome_id=o.id AND d.decision='approve'
 WHERE o.outcome='verified' AND julianday(o.expires_at)>julianday('now') AND NOT EXISTS(SELECT 1 FROM production_identity_suspensions x WHERE x.case_id=c.id);
--> statement-breakpoint
CREATE TRIGGER production_identity_decision_guard BEFORE INSERT ON production_identity_decisions BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM production_identity_outcomes o JOIN production_identity_cases c ON c.id=o.case_id JOIN signup_cases s ON s.kind='officer' AND s.source_id=c.applicant_id AND s.version=c.applicant_version AND s.owner_user_id=c.owner_user_id AND s.status<>'withdrawn' WHERE o.id=NEW.outcome_id AND NEW.actor_id<>c.owner_user_id AND NEW.actor_id<>o.recorded_by AND o.sequence=(SELECT MAX(sequence) FROM production_identity_outcomes WHERE case_id=c.id) AND NOT EXISTS(SELECT 1 FROM production_identity_suspensions x WHERE x.case_id=c.id) AND (NEW.decision='reject' OR (o.outcome='verified' AND julianday(o.expires_at)>julianday('now')))) THEN RAISE(ABORT,'Independent current identity review required') END);
END;
--> statement-breakpoint
CREATE TRIGGER production_identity_cases_no_update BEFORE UPDATE ON production_identity_cases BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_identity_cases_no_delete BEFORE DELETE ON production_identity_cases BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_identity_outcomes_no_update BEFORE UPDATE ON production_identity_outcomes BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_identity_outcomes_no_delete BEFORE DELETE ON production_identity_outcomes BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_identity_decisions_no_update BEFORE UPDATE ON production_identity_decisions BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_identity_decisions_no_delete BEFORE DELETE ON production_identity_decisions BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_identity_suspensions_no_update BEFORE UPDATE ON production_identity_suspensions BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER production_identity_suspensions_no_delete BEFORE DELETE ON production_identity_suspensions BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
