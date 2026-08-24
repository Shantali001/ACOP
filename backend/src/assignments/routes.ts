import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { writeAuditLog } from '../audit/helper.js';
import { createNotification } from '../notifications/helper.js';
import { pool } from '../db/pool.js';
import type { AssignmentRow } from './types.js';

export const assignmentsRouter = Router();

assignmentsRouter.use(requireAuth);
assignmentsRouter.use(requireRole('ADMIN'));

function parseCustomerIds(body: Record<string, unknown>) {
  const rawCustomerIds = Array.isArray(body.customerIds)
    ? body.customerIds
    : Array.isArray(body.customer_ids)
      ? body.customer_ids
      : typeof body.customerId === 'string'
        ? [body.customerId]
        : typeof body.customer_id === 'string'
          ? [body.customer_id]
          : [];

  return [...new Set(rawCustomerIds.filter((customerId): customerId is string => typeof customerId === 'string' && Boolean(customerId.trim())))];
}

function mapAssignment(row: AssignmentRow) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    customerId: row.customer_id,
    agentId: row.agent_id,
    assignmentStatus: row.assignment_status,
    createdAt: row.created_at,
  };
}

assignmentsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : typeof body.campaign_id === 'string' ? body.campaign_id : '';
    const agentId = typeof body.agentId === 'string' ? body.agentId : typeof body.agent_id === 'string' ? body.agent_id : '';
    const customerIds = parseCustomerIds(body);

    const errors: string[] = [];
    if (!campaignId) errors.push('campaignId is required.');
    if (!agentId) errors.push('agentId is required.');
    if (!customerIds.length) errors.push('customerIds array is required.');

    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const campaignExists = await pool.query('select 1 from campaigns where id = $1 limit 1', [campaignId]);
    if (!campaignExists.rows[0]) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    const agentExists = await pool.query(
      `select 1 from agents a join users u on u.id = a.user_id where a.id = $1 and u.role = 'AGENT' and u.status = 'ACTIVE' limit 1`,
      [agentId],
    );
    if (!agentExists.rows[0]) {
      res.status(404).json({ message: 'Active agent not found.' });
      return;
    }

    const result = await pool.query<AssignmentRow>(
      `
        insert into customer_assignments (campaign_id, customer_id, agent_id, assigned_by, assignment_status)
        select $1, customer_id, $2, $4, 'ACTIVE'
        from unnest($3::uuid[]) as customer_id
        returning id, campaign_id, customer_id, agent_id, assignment_status
      `,
      [campaignId, agentId, customerIds, req.user!.id],
    );

    const agentUserResult = await pool.query<{ user_id: string }>('select user_id from agents where id = $1', [agentId]);
    await createNotification(agentUserResult.rows[0]?.user_id, `${result.rowCount ?? 0} new customer(s) assigned to you.`);
    await writeAuditLog({
      userId: req.user!.id,
      action: 'customer.assigned',
      entityType: 'assignment',
      entityId: result.rows[0]?.id,
      metadata: { campaignId, agentId, customerIds },
    });

    res.status(201).json({ data: result.rows.map(mapAssignment), assigned: result.rowCount });
  } catch (error) {
    next(error);
  }
});

assignmentsRouter.put('/:id/reassign', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const body = req.body as Record<string, unknown>;
    const agentId = typeof body.agentId === 'string' ? body.agentId : typeof body.agent_id === 'string' ? body.agent_id : '';

    if (!agentId) {
      res.status(400).json({ message: 'agentId is required.' });
      return;
    }

    await client.query('begin');

    const currentResult = await client.query<AssignmentRow>(
      'select id, campaign_id, customer_id, agent_id, assignment_status from customer_assignments where id = $1 for update',
      [req.params.id],
    );
    const current = currentResult.rows[0];

    if (!current) {
      await client.query('rollback');
      res.status(404).json({ message: 'Assignment not found.' });
      return;
    }

    const agentExists = await client.query(
      `select 1 from agents a join users u on u.id = a.user_id where a.id = $1 and u.role = 'AGENT' and u.status = 'ACTIVE' limit 1`,
      [agentId],
    );
    if (!agentExists.rows[0]) {
      await client.query('rollback');
      res.status(404).json({ message: 'Active agent not found.' });
      return;
    }

    await client.query("update customer_assignments set assignment_status = 'REASSIGNED' where id = $1", [req.params.id]);

    const newResult = await client.query<AssignmentRow>(
      `
        insert into customer_assignments (campaign_id, customer_id, agent_id, assigned_by, assignment_status)
        values ($1, $2, $3, $4, 'ACTIVE')
        returning id, campaign_id, customer_id, agent_id, assignment_status, created_at
      `,
      [current.campaign_id, current.customer_id, agentId, req.user!.id],
    );

    await client.query('commit');

    res.json({ oldAssignmentId: req.params.id, assignment: mapAssignment(newResult.rows[0]) });
  } catch (error) {
    await client.query('rollback');
    next(error);
  } finally {
    client.release();
  }
});

assignmentsRouter.delete('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('delete from customer_assignments where id = $1 returning id', [req.params.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Assignment not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});


