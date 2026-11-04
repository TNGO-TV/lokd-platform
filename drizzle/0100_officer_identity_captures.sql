CREATE TABLE officer_identity_captures (
 capture_reference TEXT PRIMARY KEY NOT NULL,
 applicant_id TEXT NOT NULL,
 applicant_version INTEGER NOT NULL,
 owner_user_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 consent_version TEXT NOT NULL,
 captured_at TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 UNIQUE(applicant_id, applicant_version),
 CHECK(applicant_version > 0),
 CHECK(julianday(expires_at) > julianday(captured_at))
);
--> statement-breakpoint
CREATE TRIGGER officer_identity_capture_guard BEFORE INSERT ON officer_identity_captures BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM signup_cases WHERE kind='officer' AND source_id=NEW.applicant_id AND version=NEW.applicant_version AND owner_user_id=NEW.owner_user_id AND status<>'withdrawn') THEN RAISE(ABORT,'Identity application changed') END);
 SELECT (CASE WHEN EXISTS(SELECT 1 FROM officer_identity_captures WHERE capture_reference=NEW.capture_reference OR (applicant_id=NEW.applicant_id AND applicant_version=NEW.applicant_version)) THEN RAISE(ABORT,'Identity capture is immutable') END);
END;
--> statement-breakpoint
CREATE TRIGGER officer_identity_capture_no_update BEFORE UPDATE ON officer_identity_captures BEGIN SELECT RAISE(ABORT,'Identity capture is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER officer_identity_capture_no_delete BEFORE DELETE ON officer_identity_captures BEGIN SELECT RAISE(ABORT,'Identity capture is immutable'); END;

--> statement-breakpoint
CREATE TABLE officer_identity_evidence (
 reference TEXT PRIMARY KEY NOT NULL,
 case_id TEXT NOT NULL REFERENCES production_identity_cases(id),
 object_key TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 recorded_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER officer_identity_evidence_no_update BEFORE UPDATE ON officer_identity_evidence BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER officer_identity_evidence_no_delete BEFORE DELETE ON officer_identity_evidence BEGIN SELECT RAISE(ABORT,'Identity evidence is immutable'); END;
