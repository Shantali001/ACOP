BEGIN;

-- Compatibility migration for backend/src/settings/routes.ts
-- Goal:
-- 1) Ensure settings.id is an integer row with value 1 (backend hardcodes WHERE id = 1).
-- 2) Ensure settings has password_policy (jsonb) and updated_at (timestamptz).
--
-- This migration preserves any existing organization_* / theme / backup_enabled values
-- from the current blueprint-style settings table (id uuid).

-- If settings already has integer id, do nothing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'settings'
      AND column_name = 'id'
      AND data_type = 'integer'
  ) THEN
    -- Already aligned.
    RETURN;
  END IF;
END $$;

-- Create new table with integer id (1 row) and backend-required columns.
CREATE TABLE IF NOT EXISTS settings_new (
  id                 integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  organization_name  varchar(150) NOT NULL DEFAULT 'AMSAF',
  organization_logo  text,
  theme              varchar(50) NOT NULL DEFAULT 'light',
  backup_enabled     boolean NOT NULL DEFAULT false,
  password_policy    jsonb NOT NULL DEFAULT '{"minLength":8,"requireNumbers":false,"requireSymbols":false}'::jsonb,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Copy existing row (if any) from current settings table.
-- We do not assume id value; we just pick the first row.
WITH existing AS (
  SELECT
    organization_name,
    organization_logo,
    theme,
    backup_enabled
  FROM settings
  LIMIT 1
)
INSERT INTO settings_new (id, organization_name, organization_logo, theme, backup_enabled, password_policy, updated_at)
SELECT
  1,
  COALESCE(e.organization_name, 'AMSAF'),
  e.organization_logo,
  COALESCE(e.theme, 'light'),
  COALESCE(e.backup_enabled, false),
  '{"minLength":8,"requireNumbers":false,"requireSymbols":false}'::jsonb,
  now()
FROM existing e
ON CONFLICT (id) DO NOTHING;

-- If there was no existing row, insert defaults.
INSERT INTO settings_new (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Swap tables.
-- Rename current settings -> settings_old, then settings_new -> settings.
ALTER TABLE settings RENAME TO settings_old;
ALTER TABLE settings_new RENAME TO settings;

-- Recreate unique/constraints alignment for settings.id=1.
ALTER TABLE settings
  ADD CONSTRAINT settings_id_check CHECK (id = 1);

-- Drop old table.
DROP TABLE settings_old;

COMMIT;

