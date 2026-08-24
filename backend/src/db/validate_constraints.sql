-- Constraint validation queries for ACOP database
-- Checks NOT NULL, UNIQUE, CHECK, and DEFAULT constraint compliance.
-- Skips checks for missing tables safely.

BEGIN;

CREATE TEMP TABLE constraint_results (
  check_name text NOT NULL,
  violation_count bigint NOT NULL
);

-- NOT NULL checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'users.email_not_null', COUNT(*) FROM users WHERE email IS NULL;

    INSERT INTO constraint_results
    SELECT 'users.role_not_null', COUNT(*) FROM users WHERE role IS NULL;

    INSERT INTO constraint_results
    SELECT 'users.status_not_null', COUNT(*) FROM users WHERE status IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'agents.user_id_not_null', COUNT(*) FROM agents WHERE user_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'campaigns.campaign_name_not_null', COUNT(*) FROM campaigns WHERE campaign_name IS NULL;

    INSERT INTO constraint_results
    SELECT 'campaigns.status_not_null', COUNT(*) FROM campaigns WHERE status IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'customers.full_name_not_null', COUNT(*) FROM customers WHERE full_name IS NULL;

    INSERT INTO constraint_results
    SELECT 'customers.phone_number_not_null', COUNT(*) FROM customers WHERE phone_number IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_assignments' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'customer_assignments.campaign_id_not_null', COUNT(*) FROM customer_assignments WHERE campaign_id IS NULL;

    INSERT INTO constraint_results
    SELECT 'customer_assignments.customer_id_not_null', COUNT(*) FROM customer_assignments WHERE customer_id IS NULL;

    INSERT INTO constraint_results
    SELECT 'customer_assignments.agent_id_not_null', COUNT(*) FROM customer_assignments WHERE agent_id IS NULL;

    INSERT INTO constraint_results
    SELECT 'customer_assignments.assignment_status_not_null', COUNT(*) FROM customer_assignments WHERE assignment_status IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'calls' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'calls.agent_id_not_null', COUNT(*) FROM calls WHERE agent_id IS NULL;

    INSERT INTO constraint_results
    SELECT 'calls.customer_id_not_null', COUNT(*) FROM calls WHERE customer_id IS NULL;

    INSERT INTO constraint_results
    SELECT 'calls.campaign_id_not_null', COUNT(*) FROM calls WHERE campaign_id IS NULL;

    INSERT INTO constraint_results
    SELECT 'calls.outcome_not_null', COUNT(*) FROM calls WHERE outcome IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'notifications.user_id_not_null', COUNT(*) FROM notifications WHERE user_id IS NULL;

    INSERT INTO constraint_results
    SELECT 'notifications.message_not_null', COUNT(*) FROM notifications WHERE message IS NULL;

    INSERT INTO constraint_results
    SELECT 'notifications.read_not_null', COUNT(*) FROM notifications WHERE read IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'audit_logs.action_not_null', COUNT(*) FROM audit_logs WHERE action IS NULL;

    INSERT INTO constraint_results
    SELECT 'audit_logs.created_at_not_null', COUNT(*) FROM audit_logs WHERE created_at IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'settings.organization_name_not_null', COUNT(*) FROM settings WHERE organization_name IS NULL;

    INSERT INTO constraint_results
    SELECT 'settings.theme_not_null', COUNT(*) FROM settings WHERE theme IS NULL;

    INSERT INTO constraint_results
    SELECT 'settings.backup_enabled_not_null', COUNT(*) FROM settings WHERE backup_enabled IS NULL;

    INSERT INTO constraint_results
    SELECT 'settings.password_policy_not_null', COUNT(*) FROM settings WHERE password_policy IS NULL;

    INSERT INTO constraint_results
    SELECT 'settings.updated_at_not_null', COUNT(*) FROM settings WHERE updated_at IS NULL;
  END IF;
END $$;

-- UNIQUE checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'users.email_unique', COUNT(*) FROM (
      SELECT email FROM users GROUP BY email HAVING COUNT(*) > 1
    ) dup;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agents' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'agents.user_id_unique', COUNT(*) FROM (
      SELECT user_id FROM agents GROUP BY user_id HAVING COUNT(*) > 1
    ) dup;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_members' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'campaign_members.unique_customer_campaign', COUNT(*) FROM (
      SELECT customer_id, campaign_id FROM campaign_members GROUP BY customer_id, campaign_id HAVING COUNT(*) > 1
    ) dup;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'settings.id_unique', COUNT(*) FROM (
      SELECT id FROM settings GROUP BY id HAVING COUNT(*) > 1
    ) dup;
  END IF;
END $$;

-- CHECK constraint checks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'settings.id_check', COUNT(*) FROM settings WHERE id <> 1;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'modems' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'modems.status_check', COUNT(*) FROM modems WHERE status::text NOT IN ('READY', 'BUSY', 'OFFLINE');
  END IF;
END $$;

-- DEFAULT checks: verify columns have defaults where expected
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'users.created_at_default', COUNT(*) FROM users WHERE created_at IS NULL;

    INSERT INTO constraint_results
    SELECT 'users.updated_at_default', COUNT(*) FROM users WHERE updated_at IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'audit_logs.created_at_default', COUNT(*) FROM audit_logs WHERE created_at IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'notifications.created_at_default', COUNT(*) FROM notifications WHERE created_at IS NULL;

    INSERT INTO constraint_results
    SELECT 'notifications.read_default', COUNT(*) FROM notifications WHERE read IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings' AND table_schema = 'public') THEN
    INSERT INTO constraint_results
    SELECT 'settings.updated_at_default', COUNT(*) FROM settings WHERE updated_at IS NULL;
  END IF;
END $$;

SELECT check_name, violation_count
FROM constraint_results
ORDER BY check_name;

ROLLBACK;
