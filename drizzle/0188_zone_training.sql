CREATE TABLE zone_training_sessions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  course_id TEXT NOT NULL CHECK(course_id IN ('grade-e','grade-d','grade-c','grade-b','grade-a','firearms-competency','armed-readiness','close-protection')),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL CHECK(julianday(ends_at)>julianday(starts_at)),
  venue TEXT NOT NULL CHECK(length(venue) BETWEEN 3 AND 300),
  capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 200),
  fee_cents INTEGER CHECK(fee_cents IS NULL OR fee_cents>0),
  fee_terms TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','cancelled')),
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  last_event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(created_by,request_id),
  CHECK(status!='published' OR (fee_cents IS NOT NULL AND fee_terms IS NOT NULL AND fee_cents>0 AND length(fee_terms) BETWEEN 10 AND 2000))
);
--> statement-breakpoint
CREATE INDEX zone_training_sessions_date_idx ON zone_training_sessions(status,starts_at);

--> statement-breakpoint
CREATE TABLE zone_training_enrolments (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  course_id TEXT NOT NULL CHECK(course_id IN ('grade-e','grade-d','grade-c','grade-b','grade-a','firearms-competency','armed-readiness','close-protection')),
  session_id TEXT REFERENCES zone_training_sessions(id),
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','confirmed','completion_pending','completed','cancelled')),
  agreed_fee_cents INTEGER CHECK(agreed_fee_cents IS NULL OR agreed_fee_cents>0),
  agreed_fee_terms TEXT,
  eligibility_reference TEXT,
  confirmed_by TEXT,
  attendance TEXT NOT NULL DEFAULT 'unrecorded' CHECK(attendance IN ('unrecorded','present','absent','excused')),
  attendance_by TEXT,
  attendance_reference TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  last_event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retention_review_at TEXT NOT NULL,
  UNIQUE(owner_user_id,request_id),
  CHECK(status NOT IN ('confirmed','completion_pending','completed') OR (session_id IS NOT NULL AND agreed_fee_cents IS NOT NULL AND agreed_fee_terms IS NOT NULL AND eligibility_reference IS NOT NULL AND agreed_fee_cents>0 AND length(agreed_fee_terms)>=10 AND length(eligibility_reference)>=3 AND confirmed_by IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX zone_training_enrolments_owner_idx ON zone_training_enrolments(owner_user_id,created_at);
--> statement-breakpoint
CREATE INDEX zone_training_enrolments_session_idx ON zone_training_enrolments(session_id,status);
--> statement-breakpoint
CREATE UNIQUE INDEX zone_training_enrolments_active_idx ON zone_training_enrolments(owner_user_id,session_id) WHERE status!='cancelled' AND session_id IS NOT NULL;

--> statement-breakpoint
CREATE TRIGGER zone_training_capacity_guard BEFORE UPDATE OF status,session_id ON zone_training_enrolments
WHEN NEW.status IN ('confirmed','completion_pending','completed') AND (OLD.status NOT IN ('confirmed','completion_pending','completed') OR NEW.session_id IS NOT OLD.session_id)
BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM zone_training_sessions s WHERE s.id=NEW.session_id AND s.status='published' AND s.course_id=NEW.course_id AND s.fee_cents=NEW.agreed_fee_cents AND s.fee_terms=NEW.agreed_fee_terms AND (SELECT count(*) FROM zone_training_enrolments e WHERE e.session_id=s.id AND e.status IN ('confirmed','completion_pending','completed') AND e.id!=NEW.id)<s.capacity)
    THEN RAISE(ABORT,'zone_training_session_changed_or_full') END);
END;
--> statement-breakpoint
CREATE TRIGGER zone_training_capacity_reduction_guard BEFORE UPDATE OF capacity,status ON zone_training_sessions
WHEN (NEW.capacity<(SELECT count(*) FROM zone_training_enrolments WHERE session_id=OLD.id AND status IN ('confirmed','completion_pending','completed')))
  OR (NEW.status='cancelled' AND EXISTS(SELECT 1 FROM zone_training_enrolments WHERE session_id=OLD.id AND status IN ('confirmed','completion_pending','completed')))
BEGIN SELECT RAISE(ABORT,'zone_training_confirmed_enrolments_require_review'); END;

--> statement-breakpoint
CREATE TABLE zone_training_completion_reviews (
  id TEXT PRIMARY KEY,
  enrolment_id TEXT NOT NULL REFERENCES zone_training_enrolments(id),
  source_version INTEGER NOT NULL,
  assessment_reference TEXT NOT NULL CHECK(length(assessment_reference) BETWEEN 3 AND 1000),
  evidence_sha256 TEXT NOT NULL CHECK(length(evidence_sha256)=64 AND evidence_sha256 NOT GLOB '*[^0-9a-f]*'),
  certificate_number TEXT NOT NULL CHECK(length(certificate_number) BETWEEN 3 AND 100),
  certificate_reference TEXT NOT NULL CHECK(length(certificate_reference) BETWEEN 3 AND 1000),
  prepared_by TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','approved','rejected')),
  decided_by TEXT,
  reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  last_event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  decided_at TEXT,
  CHECK(decision='pending' OR (decided_by IS NOT NULL AND decided_by!=prepared_by AND length(reason)>=3))
);
--> statement-breakpoint
CREATE UNIQUE INDEX zone_training_pending_completion_idx ON zone_training_completion_reviews(enrolment_id) WHERE decision='pending';
--> statement-breakpoint
CREATE TABLE zone_training_certificates (
  id TEXT PRIMARY KEY,
  enrolment_id TEXT NOT NULL UNIQUE REFERENCES zone_training_enrolments(id),
  completion_review_id TEXT NOT NULL UNIQUE REFERENCES zone_training_completion_reviews(id),
  certificate_number TEXT NOT NULL UNIQUE,
  certificate_reference TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  issued_by TEXT NOT NULL
);
--> statement-breakpoint
CREATE TRIGGER zone_training_certificate_guard BEFORE INSERT ON zone_training_certificates
BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM zone_training_completion_reviews r JOIN zone_training_enrolments e ON e.id=r.enrolment_id WHERE r.id=NEW.completion_review_id AND e.id=NEW.enrolment_id AND r.decision='approved' AND r.prepared_by!=r.decided_by AND r.decided_by=NEW.issued_by AND r.certificate_number=NEW.certificate_number AND r.certificate_reference=NEW.certificate_reference AND e.status='completed' AND e.attendance='present' AND e.version=r.source_version+2)
    THEN RAISE(ABORT,'zone_training_completion_review_required') END);
END;
--> statement-breakpoint
CREATE TRIGGER zone_training_certificate_update_guard BEFORE UPDATE ON zone_training_certificates BEGIN SELECT RAISE(ABORT,'zone_training_certificate_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER zone_training_certificate_delete_guard BEFORE DELETE ON zone_training_certificates BEGIN SELECT RAISE(ABORT,'zone_training_certificate_retention_review_required'); END;

--> statement-breakpoint
CREATE TABLE zone_training_renewal_requests (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  note TEXT NOT NULL CHECK(length(note) BETWEEN 10 AND 2000),
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','under_review','closed')),
  public_note TEXT,
  reviewed_by TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  last_event_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  retention_review_at TEXT NOT NULL,
  UNIQUE(owner_user_id,request_id)
);
--> statement-breakpoint
CREATE INDEX zone_training_renewals_owner_idx ON zone_training_renewal_requests(owner_user_id,created_at);
