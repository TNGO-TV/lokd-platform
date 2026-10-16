-- Apply only to a dedicated TEST_DB after its application migrations.
-- Never apply this marker to the primary production DB or SANDBOX_DB.
CREATE TABLE lokd_rehearsal_instance (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  mode TEXT NOT NULL CHECK (mode = 'isolated-rehearsal'),
  version INTEGER NOT NULL CHECK (version = 1)
);
INSERT INTO lokd_rehearsal_instance VALUES (1, 'isolated-rehearsal', 1);
