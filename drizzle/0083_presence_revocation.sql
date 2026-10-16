-- Revoke by revision, so an already-dispatched location cannot restore sharing.
-- Existing signals are retained but hidden until explicit fresh consent.
CREATE TABLE officer_presence_consents (
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('live','test')),
  revision INTEGER NOT NULL CHECK(revision > 0),
  session_id TEXT,
  active INTEGER NOT NULL CHECK(active IN (0,1)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,mode),
  CHECK((active=1 AND session_id IS NOT NULL) OR (active=0 AND session_id IS NULL))
);
--> statement-breakpoint
ALTER TABLE public_officer_presence ADD COLUMN consent_revision INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TRIGGER presence_requires_current_consent_insert
BEFORE INSERT ON public_officer_presence
WHEN NOT EXISTS(SELECT 1 FROM officer_presence_consents c WHERE c.user_id=NEW.user_id AND c.mode=NEW.mode AND c.active=1 AND c.revision=NEW.consent_revision)
BEGIN SELECT RAISE(ABORT,'presence_consent_revoked'); END;
--> statement-breakpoint
CREATE TRIGGER presence_requires_current_consent_update
BEFORE UPDATE ON public_officer_presence
WHEN NOT EXISTS(SELECT 1 FROM officer_presence_consents c WHERE c.user_id=NEW.user_id AND c.mode=NEW.mode AND c.active=1 AND c.revision=NEW.consent_revision)
BEGIN SELECT RAISE(ABORT,'presence_consent_revoked'); END;
