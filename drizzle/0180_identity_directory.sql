-- Verified account emails recorded at the sign-in boundary, used to address
-- notifications without calling an external identity service.
CREATE TABLE IF NOT EXISTS identity_directory (
  user_id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS identity_directory_email ON identity_directory(email);
