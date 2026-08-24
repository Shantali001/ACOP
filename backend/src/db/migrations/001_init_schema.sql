CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'AGENT');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
    CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
    CREATE TYPE campaign_status AS ENUM ('ACTIVE', 'CLOSED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status') THEN
    CREATE TYPE assignment_status AS ENUM ('ACTIVE', 'COMPLETED', 'REASSIGNED');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'modem_status') THEN
    CREATE TYPE modem_status AS ENUM ('READY', 'BUSY', 'OFFLINE');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  status user_status NOT NULL DEFAULT 'ACTIVE',
  last_login timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modem_name text,
  com_port text,
  status modem_status NOT NULL DEFAULT 'OFFLINE',
  signal_strength integer,
  sim_number text,
  serial_number text,
  network text
);

CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  assigned_modem_id uuid REFERENCES modems(id)
);

CREATE TABLE IF NOT EXISTS agent_modems (
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  modem_id uuid NOT NULL REFERENCES modems(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, modem_id)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone_number text NOT NULL,
  ward text NOT NULL,
  polling_unit text,
  lga text NOT NULL,
  state text NOT NULL,
  gender text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name text NOT NULL,
  description text,
  status campaign_status NOT NULL DEFAULT 'ACTIVE',
  start_date date,
  end_date date
);

CREATE TABLE IF NOT EXISTS campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  UNIQUE (customer_id, campaign_id)
);

CREATE TABLE IF NOT EXISTS customer_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assignment_status assignment_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid,
  customer_id uuid,
  campaign_id uuid,
  phone_number text,
  modem_id uuid,
  outcome text NOT NULL,
  duration integer,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  note text,
  created_by uuid
);

CREATE OR REPLACE FUNCTION get_next_customer(agent_id uuid)
RETURNS TABLE (
  assignment_id uuid,
  campaign_id uuid,
  campaign_name text,
  customer_id uuid,
  customer_name text,
  phone_number text,
  ward text,
  lga text,
  assignment_status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.campaign_id,
    cmp.campaign_name,
    ca.customer_id,
    c.full_name,
    c.phone_number,
    c.ward,
    c.lga,
    ca.assignment_status
  FROM customer_assignments ca
  JOIN customers c ON c.id = ca.customer_id
  JOIN campaigns cmp ON cmp.id = ca.campaign_id
  WHERE ca.agent_id = $1
    AND ca.assignment_status = 'ACTIVE'
  ORDER BY ca.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW agent_queue_summary AS
SELECT
  agent_id,
  COUNT(*) AS total_assigned,
  COUNT(*) FILTER (WHERE assignment_status = 'COMPLETED') AS completed,
  COUNT(*) FILTER (WHERE assignment_status = 'ACTIVE') AS remaining
FROM customer_assignments
GROUP BY agent_id;
