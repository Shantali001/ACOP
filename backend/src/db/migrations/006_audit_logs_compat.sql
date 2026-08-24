BEGIN;

-- Compatibility migration for backend/src/audit/
-- Goal:
-- Ensure audit_logs has the columns/shape expected by backend queries:
--  - created_at (timestamptz)
--  - metadata (jsonb)
--  - details (jsonb) (optional but backend checks)
--  - entity_type (varchar)
--  - entity_id (text-compatible; uuid is fine)
--
-- Your current DB (from screenshots) has:
--  id uuid, user_id uuid, action varchar, entity varchar,
--  entity_id uuid, timestamp timestamptz, ip_address varchar.

-- Add backend-expected columns if missing.
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS details jsonb;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS entity_type varchar(100);

-- Keep existing entity_id type (uuid) as backend code also uses entity_id::text.
-- No change required.

-- Backfill created_at from existing timestamp column.
UPDATE audit_logs
SET created_at = COALESCE(created_at, timestamp, now())
WHERE created_at IS NULL;

-- Ensure non-null for created_at.
ALTER TABLE audit_logs
  ALTER COLUMN created_at SET NOT NULL;

-- Default jsonb columns.
UPDATE audit_logs
SET metadata = COALESCE(metadata, '{}'::jsonb),
    details  = COALESCE(details,  '{}'::jsonb);

-- Set defaults (harmless if existing data exists).
ALTER TABLE audit_logs
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE audit_logs
  ALTER COLUMN details SET DEFAULT '{}'::jsonb;

-- Keep timestamp column for existing data/backward compatibility.
-- Optional: create indexes used by backend.
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created_at
  ON audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type
  ON audit_logs(entity_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);

COMMIT;

