import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { pool } from '../db/pool.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);
reportsRouter.use(requireRole('ADMIN'));

async function countQuery(sql: string, values: unknown[] = []) {
  const result = await pool.query<{ count: string | number }>(sql, values);
  return Number(result.rows[0]?.count ?? 0);
}

reportsRouter.get('/overall', async (_req, res, next) => {
  try {
    const [totalCalls, callsToday, callsThisWeek, callsThisMonth] = await Promise.all([
      countQuery('select count(*) as count from calls'),
      countQuery("select count(*) as count from calls where created_at >= date_trunc('day', now())"),
      countQuery("select count(*) as count from calls where created_at >= date_trunc('week', now())"),
      countQuery("select count(*) as count from calls where created_at >= date_trunc('month', now())"),
    ]);

    res.json({ totalCalls, callsToday, callsThisWeek, callsThisMonth });
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/agents', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        select
          a.id as agent_id,
          u.full_name,
          u.email,
          count(c.id)::int as calls_made,
          coalesce(aqs.remaining, 0)::int as customers_remaining,
          coalesce(avg(c.duration), 0)::int as average_duration,
          case when count(c.id) = 0 then 0 else round((count(c.id) filter (where c.outcome in ('SUPPORTER', 'UNDECIDED'))::numeric / count(c.id)::numeric) * 100)::int end as success_rate
        from agents a
        join users u on u.id = a.user_id
        left join calls c on c.agent_id = a.id
        left join (
          select
            agent_id,
            COUNT(*) FILTER (WHERE assignment_status = 'COMPLETED') AS completed,
            COUNT(*) FILTER (WHERE assignment_status = 'ACTIVE') AS remaining
          from customer_assignments
          group by agent_id
        ) aqs on aqs.agent_id = a.id
        where u.role = 'AGENT'
        group by a.id, u.full_name, u.email, aqs.remaining
        order by u.full_name asc
      `,
    );

    res.json(result.rows.map((row) => ({
      agentId: row.agent_id,
      fullName: row.full_name,
      email: row.email,
      callsMade: Number(row.calls_made ?? 0),
      customersRemaining: Number(row.customers_remaining ?? 0),
      averageDuration: Number(row.average_duration ?? 0),
      successRate: Number(row.success_rate ?? 0),
    })));
  } catch (error) {
    next(error);
  }
});

reportsRouter.get('/campaigns', async (_req, res, next) => {
  try {
    const result = await pool.query(
      `
        select
          c.id,
          c.campaign_name,
          c.status,
          count(ca.id) filter (where ca.assignment_status = 'COMPLETED')::int as completed,
          count(ca.id) filter (where ca.assignment_status = 'ACTIVE')::int as pending,
          count(ca.id)::int as total_assigned
        from campaigns c
        left join customer_assignments ca on ca.campaign_id = c.id
        group by c.id, c.campaign_name, c.status
        order by c.campaign_name asc
      `,
    );

    res.json(result.rows.map((row) => {
      const completed = Number(row.completed ?? 0);
      const pending = Number(row.pending ?? 0);
      const total = Number(row.total_assigned ?? 0);
      return {
        campaignId: row.id,
        campaignName: row.campaign_name,
        status: row.status,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        completed,
        pending,
      };
    }));
  } catch (error) {
    next(error);
  }
});
