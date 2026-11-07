CREATE TABLE officer_application_preferences (
 application_id TEXT PRIMARY KEY NOT NULL REFERENCES officer_applications(id) ON DELETE CASCADE,
 availability TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(availability) AND json_type(availability)='array'),
 renewal_status TEXT CHECK(renewal_status IS NULL OR renewal_status IN ('not_started','preparing_documents','submitted','refresher_requested')),
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE training_bookings (
 id TEXT PRIMARY KEY NOT NULL,
 request_key_hash TEXT NOT NULL UNIQUE,
 payload_hash TEXT NOT NULL,
 course TEXT NOT NULL CHECK(course IN ('grade-e','grade-d','grade-c','grade-b','grade-a','firearms-competency','armed-readiness','close-protection')),
 preferred_intake_month TEXT NOT NULL,
 full_name TEXT NOT NULL,
 mobile_normalized TEXT NOT NULL,
 email_normalized TEXT NOT NULL,
 id_status TEXT NOT NULL CHECK(id_status IN ('available','replacement_pending','guidance_needed')),
 psira_status TEXT NOT NULL CHECK(psira_status IN ('active','expired','in_training','not_registered')),
 status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','contacted','confirmed','cancelled')),
 privacy_notice_version TEXT NOT NULL,
 consented_at TEXT NOT NULL,
 environment TEXT NOT NULL DEFAULT 'production' CHECK(environment='production'),
 integrity_state TEXT NOT NULL DEFAULT 'user_submitted' CHECK(integrity_state='user_submitted'),
 retention_review_at TEXT NOT NULL,
 created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX training_bookings_intake_idx ON training_bookings(preferred_intake_month,created_at);
--> statement-breakpoint
CREATE INDEX training_bookings_status_idx ON training_bookings(status,created_at);
--> statement-breakpoint
CREATE TRIGGER training_booking_submission_immutable BEFORE UPDATE ON training_bookings
WHEN NEW.id IS NOT OLD.id OR NEW.request_key_hash IS NOT OLD.request_key_hash OR NEW.payload_hash IS NOT OLD.payload_hash
 OR NEW.course IS NOT OLD.course OR NEW.preferred_intake_month IS NOT OLD.preferred_intake_month
 OR NEW.full_name IS NOT OLD.full_name OR NEW.mobile_normalized IS NOT OLD.mobile_normalized OR NEW.email_normalized IS NOT OLD.email_normalized
 OR NEW.id_status IS NOT OLD.id_status OR NEW.psira_status IS NOT OLD.psira_status
 OR NEW.privacy_notice_version IS NOT OLD.privacy_notice_version OR NEW.consented_at IS NOT OLD.consented_at
 OR NEW.environment IS NOT OLD.environment OR NEW.integrity_state IS NOT OLD.integrity_state
 OR NEW.retention_review_at IS NOT OLD.retention_review_at OR NEW.created_at IS NOT OLD.created_at
BEGIN SELECT RAISE(ABORT,'training_submission_immutable'); END;
