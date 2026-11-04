CREATE TABLE IF NOT EXISTS officer_enrolment_requests (
 id TEXT PRIMARY KEY,
 application_id TEXT NOT NULL,
 owner_user_id TEXT NOT NULL,
 application_version INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'requested',
 created_at TEXT NOT NULL,
 UNIQUE(application_id,owner_user_id,application_version)
);
