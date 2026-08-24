import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { createTemporaryPassword } from '../auth/passwords.js';
import { pool } from '../db/pool.js';
import type { AgentRow } from './types.js';
import { validateAgentInput } from './validation.js';

export const agentsRouter = Router();

agentsRouter.use(requireAuth);
agentsRouter.use(requireRole('ADMIN'));

function mapAgent(row: AgentRow) {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    totalCalls: Number(row.total_calls ?? 0),
    completedCustomers: Number(row.completed_customers ?? 0),
  };
}

agentsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query<AgentRow>(
      `
        select
          a.id,
          a.user_id,
          u.full_name,
          u.email,
          u.status,
          u.created_at,
          count(ca.id)::int as total_calls,
          count(ca.id) filter (where ca.assignment_status = 'COMPLETED')::int as completed_customers
        from agents a
        join users u on u.id = a.user_id
        left join customer_assignments ca on ca.agent_id = a.id
        where u.role = 'AGENT'
        group by a.id, a.user_id, u.full_name, u.email, u.status, u.created_at
        order by u.created_at desc
      `,
    );

    res.json(result.rows.map(mapAgent));
  } catch (error) {
    next(error);
  }
});

agentsRouter.post('/', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { agent, errors } = validateAgentInput(req.body as Record<string, unknown>);

    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const temporaryPassword = createTemporaryPassword();

    await client.query('begin');

    const userResult = await client.query<{ id: string; full_name: string; email: string; status: 'ACTIVE' | 'SUSPENDED'; created_at: string }>(
      `
        insert into users (full_name, email, password_hash, role, status, created_at, updated_at)
        values ($1, $2, crypt($3, gen_salt('bf')), 'AGENT', 'ACTIVE', now(), now())
        returning id, full_name, email, status, created_at
      `,
      [agent.fullName, agent.email, temporaryPassword],
    );

    const user = userResult.rows[0];
    const agentResult = await client.query<{ id: string }>(
      'insert into agents (user_id) values ($1) returning id',
      [user.id],
    );

    await client.query('commit');

    res.status(201).json({
      agent: {
        id: agentResult.rows[0].id,
        userId: user.id,
        fullName: user.full_name,
        email: user.email,
        status: user.status,
        createdAt: user.created_at,
        totalCalls: 0,
        completedCustomers: 0,
      },
      temporaryPassword,
    });
  } catch (error) {
    await client.query('rollback');
    next(error);
  } finally {
    client.release();
  }
});

agentsRouter.put('/:id', async (req, res, next) => {
  try {
    const { agent, errors } = validateAgentInput(req.body as Record<string, unknown>);

    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const result = await pool.query<AgentRow>(
      `
        update users u
        set full_name = $2,
            email = $3,
            updated_at = now()
        from agents a
        where a.id = $1
          and a.user_id = u.id
          and u.role = 'AGENT'
        returning a.id, a.user_id, u.full_name, u.email, u.status, u.created_at,
          0::int as total_calls,
          0::int as completed_customers
      `,
      [req.params.id, agent.fullName, agent.email],
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Agent not found.' });
      return;
    }

    res.json(mapAgent(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

async function updateAgentStatus(agentId: string, status: 'ACTIVE' | 'SUSPENDED') {
  const result = await pool.query<AgentRow>(
    `
      update users u
      set status = $2,
          updated_at = now()
      from agents a
      where a.id = $1
        and a.user_id = u.id
        and u.role = 'AGENT'
      returning a.id, a.user_id, u.full_name, u.email, u.status, u.created_at,
        0::int as total_calls,
        0::int as completed_customers
    `,
    [agentId, status],
  );

  return result.rows[0] ? mapAgent(result.rows[0]) : null;
}

agentsRouter.post('/:id/activate', async (req, res, next) => {
  try {
    const agent = await updateAgentStatus(req.params.id, 'ACTIVE');

    if (!agent) {
      res.status(404).json({ message: 'Agent not found.' });
      return;
    }

    res.json(agent);
  } catch (error) {
    next(error);
  }
});

agentsRouter.post('/:id/suspend', async (req, res, next) => {
  try {
    const agent = await updateAgentStatus(req.params.id, 'SUSPENDED');

    if (!agent) {
      res.status(404).json({ message: 'Agent not found.' });
      return;
    }

    res.json(agent);
  } catch (error) {
    next(error);
  }
});

agentsRouter.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();

  try {
    await client.query('begin');

    const agentResult = await client.query<{ user_id: string }>(
      'delete from agents where id = $1 returning user_id',
      [req.params.id],
    );
    const agent = agentResult.rows[0];

    if (!agent) {
      await client.query('rollback');
      res.status(404).json({ message: 'Agent not found.' });
      return;
    }

    await client.query("delete from users where id = $1 and role = 'AGENT'", [agent.user_id]);
    await client.query('commit');

    res.status(204).send();
  } catch (error) {
    await client.query('rollback');
    next(error);
  } finally {
    client.release();
  }
});