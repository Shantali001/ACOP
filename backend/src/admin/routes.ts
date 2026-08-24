import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { pool } from '../db/pool.js';
import { modemController } from '../modems/controller.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRole('ADMIN'));

async function countQuery(sql: string, values: unknown[] = []) {
  const result = await pool.query<{ count: string | number }>(sql, values);
  return Number(result.rows[0]?.count ?? 0);
}

adminRouter.get('/dashboard', async (_req, res, next) => {
  try {
    const now = new Date();
    const [
      totalCustomers,
      totalAgents,
      activeAgents,
      connectedModems,
      activeCampaigns,
      callsToday,
      callsThisWeek,
      callsThisMonth,
      pendingCustomers,
      completedCustomers,
      successfulCalls,
      totalCalls,
      customerGenderBreakdown,
    ] = await Promise.all([
      countQuery('select count(*) as count from customers'),
      countQuery("select count(*) as count from users where role = 'AGENT'"),
      countQuery("select count(*) as count from users where role = 'AGENT' and status = 'ACTIVE'"),
      countQuery("select count(*) as count from modems where status in ('READY', 'BUSY')"),
      countQuery("select count(*) as count from campaigns where status = 'ACTIVE'"),
      countQuery("select count(*) as count from calls where created_at >= date_trunc('day', now())"),
      countQuery("select count(*) as count from calls where created_at >= date_trunc('week', now())"),
      countQuery("select count(*) as count from calls where created_at >= date_trunc('month', now())"),
      countQuery("select count(*) as count from customer_assignments where assignment_status = 'ACTIVE'"),
      countQuery("select count(*) as count from customer_assignments where assignment_status = 'COMPLETED'"),
      countQuery("select count(*) as count from calls where outcome in ('SUPPORTER', 'UNDECIDED')"),
      countQuery('select count(*) as count from calls'),
      pool.query<{ gender: string | null; count: string | number }>(
        'select gender, count(*) as count from customers group by gender',
      ),
    ]);

    const genderBreakdown = customerGenderBreakdown.rows.map((row) => ({
      name: row.gender ?? 'UNKNOWN',
      value: Number(row.count ?? 0),
    }));

    res.json({
      generatedAt: now.toISOString(),
      totalCustomers,
      totalAgents,
      activeAgents,
      connectedModems,
      activeCampaigns,
      callsToday,
      callsThisWeek,
      callsThisMonth,
      pendingCustomers,
      completedCustomers,
      successRate: totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0,
      customerGenderBreakdown: genderBreakdown,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/supervisor', async (_req, res, next) => {
  try {
    const activeCalls = new Map(modemController.listActiveCalls().map((call) => [call.agentId, call]));
    const result = await pool.query<{
      agent_id: string;
      full_name: string;
      email: string;
      user_status: 'ACTIVE' | 'SUSPENDED';
      assigned_modem_name: string | null;
      assigned_modem_status: string | null;
      total_assigned: string | number | null;
      completed: string | number | null;
      remaining: string | number | null;
      calls_completed_today: string | number | null;
      average_call_duration: string | number | null;
      last_activity_time: string | null;
    }>(
      `
        select
          a.id as agent_id,
          u.full_name,
          u.email,
          u.status as user_status,
          m.modem_name as assigned_modem_name,
          m.status as assigned_modem_status,
          coalesce(aqs.total_assigned, 0) as total_assigned,
          coalesce(aqs.completed, 0) as completed,
          coalesce(aqs.remaining, 0) as remaining,
          count(c.id) filter (where c.created_at >= date_trunc('day', now()))::int as calls_completed_today,
          coalesce(avg(c.duration), 0)::int as average_call_duration,
          greatest(max(c.created_at), u.last_login, u.updated_at) as last_activity_time
        from agents a
        join users u on u.id = a.user_id
        left join modems m on m.id = a.assigned_modem_id
        left join (
          select
            agent_id,
            COUNT(*) AS total_assigned,
            COUNT(*) FILTER (WHERE assignment_status = 'COMPLETED') AS completed,
            COUNT(*) FILTER (WHERE assignment_status = 'ACTIVE') AS remaining
          from customer_assignments
          group by agent_id
        ) aqs on aqs.agent_id = a.id
        left join calls c on c.agent_id = a.id
        where u.role = 'AGENT'
        group by a.id, u.full_name, u.email, u.status, m.modem_name, m.status, aqs.total_assigned, aqs.completed, aqs.remaining, u.last_login, u.updated_at
        order by u.full_name asc
      `,
    );

    res.json({
      generatedAt: new Date().toISOString(),
      agents: result.rows.map((row) => {
        const activeCall = activeCalls.get(row.agent_id);
        return {
          agentId: row.agent_id,
          fullName: row.full_name,
          email: row.email,
          onlineStatus: row.user_status,
          currentCustomer: activeCall?.customerName ?? null,
          assignedModem: row.assigned_modem_name,
          assignedModemStatus: row.assigned_modem_status,
          currentCallDuration: activeCall ? Math.floor((Date.now() - activeCall.startedAt.getTime()) / 1000) : null,
          callsCompletedToday: Number(row.calls_completed_today ?? 0),
          customersRemaining: Number(row.remaining ?? 0),
          averageCallTime: Number(row.average_call_duration ?? 0),
          lastActivityTime: activeCall?.startedAt.toISOString() ?? row.last_activity_time,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

