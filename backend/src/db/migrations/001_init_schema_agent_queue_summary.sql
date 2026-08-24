-- Create agent_queue_summary view
-- This view aggregates assignment counts per agent for supervisor/agent dashboards.
CREATE OR REPLACE VIEW agent_queue_summary AS
SELECT
  agent_id,
  COUNT(*) AS total_assigned,
  COUNT(*) FILTER (WHERE assignment_status = 'COMPLETED') AS completed,
  COUNT(*) FILTER (WHERE assignment_status = 'ACTIVE') AS remaining
FROM customer_assignments
GROUP BY agent_id;
