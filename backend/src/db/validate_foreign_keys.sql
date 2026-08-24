-- Foreign key validation queries for ACOP database
-- Run these against your PostgreSQL database to detect orphan records.
-- Checks are wrapped so missing tables are skipped safely.

BEGIN;

CREATE TEMP TABLE validation_results (
  check_name text NOT NULL,
  orphan_count bigint NOT NULL
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'agents.orphan_user', COUNT(*)
    FROM agents a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE u.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_assignments' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'customer_assignments.orphan_campaign', COUNT(*)
    FROM customer_assignments ca
    LEFT JOIN campaigns c ON c.id = ca.campaign_id
    WHERE c.id IS NULL;

    INSERT INTO validation_results
    SELECT 'customer_assignments.orphan_customer', COUNT(*)
    FROM customer_assignments ca
    LEFT JOIN customers c ON c.id = ca.customer_id
    WHERE c.id IS NULL;

    INSERT INTO validation_results
    SELECT 'customer_assignments.orphan_agent', COUNT(*)
    FROM customer_assignments ca
    LEFT JOIN agents a ON a.id = ca.agent_id
    WHERE a.id IS NULL;

    INSERT INTO validation_results
    SELECT 'customer_assignments.orphan_assigned_by', COUNT(*)
    FROM customer_assignments ca
    LEFT JOIN users u ON u.id = ca.assigned_by
    WHERE ca.assigned_by IS NOT NULL AND u.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'calls.orphan_agent', COUNT(*)
    FROM calls cl
    LEFT JOIN agents a ON a.id = cl.agent_id
    WHERE cl.agent_id IS NOT NULL AND a.id IS NULL;

    INSERT INTO validation_results
    SELECT 'calls.orphan_customer', COUNT(*)
    FROM calls cl
    LEFT JOIN customers c ON c.id = cl.customer_id
    WHERE cl.customer_id IS NOT NULL AND c.id IS NULL;

    INSERT INTO validation_results
    SELECT 'calls.orphan_campaign', COUNT(*)
    FROM calls cl
    LEFT JOIN campaigns c ON c.id = cl.campaign_id
    WHERE cl.campaign_id IS NOT NULL AND c.id IS NULL;

    INSERT INTO validation_results
    SELECT 'calls.orphan_modem', COUNT(*)
    FROM calls cl
    LEFT JOIN modems m ON m.id = cl.modem_id
    WHERE cl.modem_id IS NOT NULL AND m.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_members' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'campaign_members.orphan_campaign', COUNT(*)
    FROM campaign_members cm
    LEFT JOIN campaigns c ON c.id = cm.campaign_id
    WHERE c.id IS NULL;

    INSERT INTO validation_results
    SELECT 'campaign_members.orphan_customer', COUNT(*)
    FROM campaign_members cm
    LEFT JOIN customers c ON c.id = cm.customer_id
    WHERE c.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'call_notes' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'call_notes.orphan_call', COUNT(*)
    FROM call_notes cn
    LEFT JOIN calls cl ON cl.id = cn.call_id
    WHERE cl.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'notifications.orphan_user', COUNT(*)
    FROM notifications n
    LEFT JOIN users u ON u.id = n.user_id
    WHERE u.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'audit_logs.orphan_user', COUNT(*)
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.user_id IS NOT NULL AND u.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modems' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'agents.orphan_modem', COUNT(*)
    FROM agents a
    LEFT JOIN modems m ON m.id = a.assigned_modem_id
    WHERE a.assigned_modem_id IS NOT NULL AND m.id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modems' AND table_schema = 'public')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'modems.multi_assigned', COUNT(*)
    FROM modems m
    JOIN agents a ON a.assigned_modem_id = m.id
    GROUP BY m.id
    HAVING COUNT(a.id) > 1;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_modems' AND table_schema = 'public') THEN
    INSERT INTO validation_results
    SELECT 'agent_modems.orphan_agent', COUNT(*)
    FROM agent_modems am
    LEFT JOIN agents a ON a.id = am.agent_id
    WHERE a.id IS NULL;

    INSERT INTO validation_results
    SELECT 'agent_modems.orphan_modem', COUNT(*)
    FROM agent_modems am
    LEFT JOIN modems m ON m.id = am.modem_id
    WHERE m.id IS NULL;
  END IF;
END $$;

SELECT check_name, orphan_count
FROM validation_results
ORDER BY check_name;

ROLLBACK;
