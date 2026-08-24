BEGIN;

-- Keep modem status values aligned across PostgreSQL, backend, and frontend.
-- Current valid values are READY, BUSY, and OFFLINE.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modem_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'modem_status' AND e.enumlabel = 'READY'
    ) THEN
      ALTER TYPE modem_status ADD VALUE 'READY';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'modem_status' AND e.enumlabel = 'BUSY'
    ) THEN
      ALTER TYPE modem_status ADD VALUE 'BUSY';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'modem_status' AND e.enumlabel = 'OFFLINE'
    ) THEN
      ALTER TYPE modem_status ADD VALUE 'OFFLINE';
    END IF;
  END IF;
END $$;

UPDATE modems
SET status = 'READY'
WHERE status::text = 'ONLINE';

UPDATE modems
SET status = 'OFFLINE'
WHERE status::text IN ('UNKNOWN', 'DISABLED');

ALTER TABLE modems
  DROP CONSTRAINT IF EXISTS modems_status_valid;

ALTER TABLE modems
  ADD CONSTRAINT modems_status_valid
  CHECK (status::text IN ('READY', 'BUSY', 'OFFLINE'));

COMMIT;

