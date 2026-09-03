BEGIN;

-- Ensure call_outcome_enum exists (fixes "operator does not exist: character varying = call_outcome_enum")
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_outcome_enum') THEN
    CREATE TYPE call_outcome_enum AS ENUM ('SUPPORTER', 'OPPOSITION', 'UNDECIDED');
  END IF;
END $$;

-- Migrate calls.outcome from text to enum if still text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'outcome' AND data_type = 'text'
  ) THEN
    ALTER TABLE calls
      ALTER COLUMN outcome TYPE call_outcome_enum
      USING CASE
        WHEN outcome = 'SUPPORTER' THEN 'SUPPORTER'::call_outcome_enum
        WHEN outcome = 'OPPOSITION' THEN 'OPPOSITION'::call_outcome_enum
        WHEN outcome = 'UNDECIDED' THEN 'UNDECIDED'::call_outcome_enum
        ELSE 'UNDECIDED'::call_outcome_enum
      END;
  END IF;
END $$;

-- Create normalized geographic reference tables
CREATE TABLE IF NOT EXISTS states (
  id   serial PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS lgas (
  id      serial PRIMARY KEY,
  name    text NOT NULL,
  state_id integer NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  UNIQUE (name, state_id)
);

CREATE TABLE IF NOT EXISTS wards (
  id    serial PRIMARY KEY,
  name  text NOT NULL,
  lga_id integer NOT NULL REFERENCES lgas(id) ON DELETE CASCADE,
  UNIQUE (name, lga_id)
);

CREATE TABLE IF NOT EXISTS polling_units (
  id         serial PRIMARY KEY,
  pu_code    text NOT NULL UNIQUE,
  pu_name    text NOT NULL,
  ward_id    integer NOT NULL REFERENCES wards(id) ON DELETE CASCADE,
  registered_voters integer NOT NULL DEFAULT 0,
  field_agent_name text,
  field_agent_phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lgas_state ON lgas(state_id);
CREATE INDEX IF NOT EXISTS idx_wards_lga ON wards(lga_id);
CREATE INDEX IF NOT EXISTS idx_polling_units_ward ON polling_units(ward_id);

-- Backfill states from existing distinct values in customers + polling_units
INSERT INTO states (name)
SELECT DISTINCT state FROM customers WHERE state IS NOT NULL AND state <> ''
UNION
SELECT DISTINCT state FROM polling_units WHERE state IS NOT NULL AND state <> ''
ON CONFLICT (name) DO NOTHING;

-- Backfill LGAs per state
INSERT INTO lgas (name, state_id)
SELECT DISTINCT c.lga, s.id
FROM customers c
JOIN states s ON s.name = c.state
WHERE c.lga IS NOT NULL AND c.lga <> ''
ON CONFLICT (name, state_id) DO NOTHING;

-- Backfill wards per LGA
INSERT INTO wards (name, lga_id)
SELECT DISTINCT c.ward, l.id
FROM customers c
JOIN lgas l ON l.name = c.lga
JOIN states s ON s.id = l.state_id AND s.name = c.state
WHERE c.ward IS NOT NULL AND c.ward <> ''
ON CONFLICT (name, lga_id) DO NOTHING;

COMMIT;
