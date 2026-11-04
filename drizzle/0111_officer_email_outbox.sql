CREATE TABLE IF NOT EXISTS officer_email_outbox (
 id TEXT PRIMARY KEY,
 application_id TEXT,
 recipient TEXT NOT NULL,
 subject TEXT NOT NULL,
 message TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','sending','sent','failed','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0,
 provider_id TEXT,
 from_address TEXT,
 last_error TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS officer_email_outbox_state ON officer_email_outbox(state,created_at);
