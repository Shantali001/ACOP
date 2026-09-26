import { Router } from 'express';
import { pool } from '../db/pool.js';

export const campaignDashboardRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

type FilterOptions = {
  prefix?: string;
  startIndex?: number;
  includeDateFilters?: boolean;
  includeGeoFilters?: boolean;
  includeAgentFilter?: boolean;
};

function buildFilterConditions(
  query: Record<string, string | undefined>,
  {
    prefix = '',
    startIndex = 1,
    includeDateFilters = true,
    includeGeoFilters = true,
    includeAgentFilter = true,
  }: FilterOptions = {},
) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = startIndex;

  if (includeDateFilters && query.dateFrom) {
    conditions.push(`${prefix}created_at >= $${paramIndex++}::date`);
    values.push(query.dateFrom);
  }
  if (includeDateFilters && query.dateTo) {
    // Add 1 day so "to" date is inclusive
    conditions.push(
      `${prefix}created_at < ($${paramIndex++}::date + interval '1 day')`,
    );
    values.push(query.dateTo);
  }

  if (includeGeoFilters && query.state) {
    conditions.push(
      `upper(trim(${prefix}state)) = upper(trim($${paramIndex++}))`,
    );
    values.push(query.state);
  }
  if (includeGeoFilters && query.lga) {
    conditions.push(
      `upper(trim(${prefix}lga)) = upper(trim($${paramIndex++}))`,
    );
    values.push(query.lga);
  }
  if (includeGeoFilters && query.ward) {
    conditions.push(
      `upper(trim(${prefix}ward)) = upper(trim($${paramIndex++}))`,
    );
    values.push(query.ward);
  }
  if (includeAgentFilter && query.agentId) {
    conditions.push(`${prefix}agent_id = $${paramIndex++}`);
    values.push(query.agentId);
  }

  return { conditions, values, nextIndex: paramIndex };
}

function whereClause(conditions: string[], prefix = 'where ') {
  return conditions.length ? `${prefix}${conditions.join(' and ')}` : '';
}

async function countQuery(sql: string, values: unknown[] = []) {
  const result = await pool.query<{ count: string | number }>(sql, values);
  return Number(result.rows[0]?.count ?? 0);
}

// ── GET /admin/campaign-dashboard ────────────────────────────────────────────

campaignDashboardRouter.get('/', async (req, res, next) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const now = new Date();

    // The outcome occupies $1, so all request filters begin at $2. Geographic
    // filters apply to customers, while date and agent filters apply to calls.
    const callFilters = buildFilterConditions(query, {
      startIndex: 2,
      includeGeoFilters: false,
    });
    const customerFilters = buildFilterConditions(query, {
      prefix: 'c.',
      startIndex: 2 + callFilters.values.length,
      includeDateFilters: false,
      includeAgentFilter: false,
    });
    const hasCustomerFilter = customerFilters.conditions.length > 0;

    function buildCountQuery(outcome: string) {
      const conditions = [
        `outcome = $1::call_outcome_enum`,
        ...callFilters.conditions,
        ...customerFilters.conditions,
      ];
      const values = [outcome, ...callFilters.values, ...customerFilters.values];
      const fromClause = hasCustomerFilter
        ? 'from calls join customers c on c.id = calls.customer_id'
        : 'from calls';
      return countQuery(
        `select count(*) as count ${fromClause} where ${conditions.join(' and ')}`,
        values,
      );
    }

    // ── Summary Cards ─────────────────────────────────────────────────────────

    const totalSupporters = await buildCountQuery('SUPPORTER');
    const totalOpposition = await buildCountQuery('OPPOSITION');
    const totalUndecided = await buildCountQuery('UNDECIDED');

    const newSupportersToday = await countQuery(
      `select count(*) as count from calls
       where outcome = 'SUPPORTER'
         and created_at >= date_trunc('day', now())`,
    );

    const newSupportersThisWeek = await countQuery(
      `select count(*) as count from calls
       where outcome = 'SUPPORTER'
         and created_at >= date_trunc('week', now())`,
    );

    const callsMadeToday = await countQuery(
      `select count(*) as count from calls
       where created_at >= date_trunc('day', now())`,
    );

    const activeAgents = await countQuery(
      `select count(*) as count from users
       where role = 'AGENT' and status = 'ACTIVE'`,
    );

    const totalRegisteredSupporters = await countQuery(
      `select count(distinct customer_id) as count from calls
       where outcome = 'SUPPORTER'`,
    );

    // ── Previous Period Comparisons ───────────────────────────────────────────

    async function getPreviousCount(sinceDays: number, outcomeFilter?: string) {
      const conditions = [
        `created_at >= now() - interval '${sinceDays * 2} days'`,
        `created_at < now() - interval '${sinceDays} days'`,
      ];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (outcomeFilter) {
        conditions.push(`outcome = $${paramIndex++}::call_outcome_enum`);
        values.push(outcomeFilter);
      }

      return countQuery(
        `select count(*) as count from calls where ${conditions.join(' and ')}`,
        values,
      );
    }

    const prevSupporters = await getPreviousCount(1, 'SUPPORTER');
    const prevOpposition = await getPreviousCount(1, 'OPPOSITION');
    const prevUndecided = await getPreviousCount(1, 'UNDECIDED');
    const prevCallsToday = await getPreviousCount(1);
    const prevNewSupporters = await getPreviousCount(1, 'SUPPORTER');

    function calcChange(current: number, previous: number) {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    }

    // ── Campaign Support Distribution ─────────────────────────────────────────

    const supportDistribution = [
      { name: 'Supporters', value: totalSupporters, color: '#16A34A' },
      { name: 'Opposition', value: totalOpposition, color: '#DC2626' },
      { name: 'Undecided', value: totalUndecided, color: '#D97706' },
    ];

    // ── New Supporters Trend ──────────────────────────────────────────────────

    const trendPeriod = query.trendPeriod || '7d';
    let trendInterval: string;
    let trendFormat: string;
    let trendRange: string;

    switch (trendPeriod) {
      case '24h':
        trendInterval = 'hour';
        trendFormat = 'YYYY-MM-DD HH24:00';
        trendRange = '24 hours';
        break;
      case '30d':
        trendInterval = 'day';
        trendFormat = 'YYYY-MM-DD';
        trendRange = '30 days';
        break;
      case '12m':
        trendInterval = 'month';
        trendFormat = 'YYYY-MM';
        trendRange = '12 months';
        break;
      default:
        trendInterval = 'day';
        trendFormat = 'YYYY-MM-DD';
        trendRange = '7 days';
    }

    const newSupportersTrend = await pool.query<{
      period: string;
      count: string | number;
    }>(
      `select
         to_char(date_trunc($1, created_at), $2) as period,
         count(*)::int as count
       from calls
       where outcome = 'SUPPORTER'
         and created_at >= now() - $3::interval
       group by period
       order by period asc`,
      [trendInterval, trendFormat, trendRange],
    );

    // ── Calls Per Agent ───────────────────────────────────────────────────────

    const callsPerAgent = await pool.query<{
      agent_name: string;
      agent_id: string;
      calls: string | number;
    }>(
      `select
         u.full_name as agent_name,
         a.id as agent_id,
         count(c.id)::int as calls
       from agents a
       join users u on u.id = a.user_id
       left join calls c on c.agent_id = a.id
       where u.role = 'AGENT'
       group by u.full_name, a.id
       order by count(c.id) desc`,
    );

    // ── Supporters by Ward ────────────────────────────────────────────────────

    const wardFilter = buildFilterConditions(query, {
      prefix: 'c.',
      includeDateFilters: false,
      includeAgentFilter: false,
    });
    const supportersByWard = await pool.query<{
      ward: string;
      count: string | number;
    }>(
      `select
         initcap(trim(c.ward)) as ward,
         count(distinct c.id)::int as count
       from customers c
       join calls ca on ca.customer_id = c.id and ca.outcome = 'SUPPORTER'
       ${whereClause(wardFilter.conditions)}
       group by initcap(trim(c.ward))
       order by count(distinct c.id) desc
       limit 20`,
      wardFilter.values,
    );

    // ── Supporters vs Opposition by LGA ───────────────────────────────────────

    const supportersVsOppositionLGA = await pool.query<{
      lga: string;
      supporters: string | number;
      opposition: string | number;
      undecided: string | number;
    }>(
      `select
         initcap(trim(c.lga)) as lga,
         count(*) filter (where ca.outcome = 'SUPPORTER')::int as supporters,
         count(*) filter (where ca.outcome = 'OPPOSITION')::int as opposition,
         count(*) filter (where ca.outcome = 'UNDECIDED')::int as undecided
       from customers c
       join calls ca on ca.customer_id = c.id
       group by initcap(trim(c.lga))
       order by count(*) filter (where ca.outcome = 'SUPPORTER') desc`,
    );

    // ── Agent Performance Leaderboard ─────────────────────────────────────────

    const agentLeaderboard = await pool.query<{
      agent_id: string;
      agent_name: string;
      email: string;
      calls_completed: string | number;
      supporters_registered: string | number;
      success_rate: string | number;
    }>(
      `select
         a.id as agent_id,
         u.full_name as agent_name,
         u.email,
         count(c.id)::int as calls_completed,
         count(c.id) filter (where c.outcome = 'SUPPORTER')::int as supporters_registered,
         case
           when count(c.id) = 0 then 0
           else round(
             (count(c.id) filter (where c.outcome = 'SUPPORTER')::numeric
               / count(c.id)::numeric) * 100
           )
         end::int as success_rate
       from agents a
       join users u on u.id = a.user_id
       left join calls c on c.agent_id = a.id
       where u.role = 'AGENT'
       group by a.id, u.full_name, u.email
       order by count(c.id) filter (where c.outcome = 'SUPPORTER') desc`,
    );

    // ── Daily Call Activity ───────────────────────────────────────────────────

    const callActivityPeriod = query.callActivity || 'weekly';
    let activityInterval: string;
    let activityFormat: string;
    let activityRange: string;

    switch (callActivityPeriod) {
      case 'daily':
        activityInterval = 'hour';
        activityFormat = 'YYYY-MM-DD HH24:00';
        activityRange = '1 day';
        break;
      case 'monthly':
        activityInterval = 'day';
        activityFormat = 'YYYY-MM-DD';
        activityRange = '1 month';
        break;
      default:
        activityInterval = 'day';
        activityFormat = 'YYYY-MM-DD';
        activityRange = '7 days';
    }

    const dailyCallActivity = await pool.query<{
      period: string;
      calls: string | number;
    }>(
      `select
         to_char(date_trunc($1, created_at), $2) as period,
         count(*)::int as calls
       from calls
       where created_at >= now() - $3::interval
       group by period
       order by period asc`,
      [activityInterval, activityFormat, activityRange],
    );

    // ── Support Conversion Rate ───────────────────────────────────────────────

    const conversionData = await pool.query<{
      calls_made: string | number;
      answered_calls: string | number;
      supporters_gained: string | number;
    }>(
      `select
         count(*)::int as calls_made,
         count(*) filter (
           where outcome in ('SUPPORTER', 'OPPOSITION', 'UNDECIDED')
         )::int as answered_calls,
         count(*) filter (where outcome = 'SUPPORTER')::int as supporters_gained
       from calls`,
    );

    const conversion = conversionData.rows[0];
    const callsMade = Number(conversion?.calls_made ?? 0);
    const answeredCalls = Number(conversion?.answered_calls ?? 0);
    const supportersGained = Number(conversion?.supporters_gained ?? 0);
    const conversionRate =
      callsMade > 0
        ? Math.round((supportersGained / callsMade) * 100 * 10) / 10
        : 0;

    // ── Recent Campaign Activity ──────────────────────────────────────────────

    const recentActivity = await pool.query<{
      id: string;
      user_name: string;
      action: string;
      entity_type: string;
      created_at: string;
    }>(
      `select
         al.id,
         coalesce(u.full_name, 'System') as user_name,
         al.action,
         al.entity_type,
         al.created_at
       from audit_logs al
       left join users u on u.id = al.user_id
       order by al.created_at desc
       limit 20`,
    );

    // ── Filter Options (deduplicated + normalized) ────────────────────────────

    const [states, agents] = await Promise.all([
      // FIX 3: Normalize state names with initcap + distinct to remove duplicates
      pool.query<{ state: string }>(
        `select distinct initcap(trim(state)) as state
         from customers
         where state is not null and trim(state) <> ''
         order by state`,
      ),
      pool.query<{ id: string; full_name: string }>(
        `select a.id, u.full_name
         from agents a
         join users u on u.id = a.user_id
         where u.role = 'AGENT'
         order by u.full_name`,
      ),
    ]);

    // ── Response ──────────────────────────────────────────────────────────────

    res.json({
      generatedAt: now.toISOString(),

      summaryCards: {
        totalSupporters: {
          value: totalSupporters,
          change: calcChange(totalSupporters, prevSupporters),
        },
        totalOpposition: {
          value: totalOpposition,
          change: calcChange(totalOpposition, prevOpposition),
        },
        totalUndecided: {
          value: totalUndecided,
          change: calcChange(totalUndecided, prevUndecided),
        },
        newSupportersToday: {
          value: newSupportersToday,
          change: calcChange(newSupportersToday, prevNewSupporters),
        },
        newSupportersThisWeek: { value: newSupportersThisWeek, change: 0 },
        callsMadeToday: {
          value: callsMadeToday,
          change: calcChange(callsMadeToday, prevCallsToday),
        },
        activeAgents: { value: activeAgents, change: 0 },
        totalRegisteredSupporters: {
          value: totalRegisteredSupporters,
          change: 0,
        },
      },

      supportDistribution,
      newSupportersTrend: newSupportersTrend.rows.map((row) => ({
        period: row.period,
        count: Number(row.count ?? 0),
      })),
      callsPerAgent: callsPerAgent.rows.map((row) => ({
        agentName: row.agent_name,
        agentId: row.agent_id,
        calls: Number(row.calls ?? 0),
      })),
      supportersByWard: supportersByWard.rows.map((row) => ({
        ward: row.ward,
        count: Number(row.count ?? 0),
      })),
      supportersVsOppositionLGA: supportersVsOppositionLGA.rows.map((row) => ({
        lga: row.lga,
        supporters: Number(row.supporters ?? 0),
        opposition: Number(row.opposition ?? 0),
        undecided: Number(row.undecided ?? 0),
      })),
      agentLeaderboard: agentLeaderboard.rows.map((row) => ({
        agentId: row.agent_id,
        agentName: row.agent_name,
        email: row.email,
        callsCompleted: Number(row.calls_completed ?? 0),
        supportersRegistered: Number(row.supporters_registered ?? 0),
        successRate: Number(row.success_rate ?? 0),
      })),
      dailyCallActivity: dailyCallActivity.rows.map((row) => ({
        period: row.period,
        calls: Number(row.calls ?? 0),
      })),

      conversion: {
        callsMade,
        answeredCalls,
        supportersGained,
        conversionRate,
      },

      recentActivity: recentActivity.rows.slice(0, 20).map((row) => ({
        id: row.id,
        userName: row.user_name,
        action: row.action,
        entityType: row.entity_type,
        createdAt: row.created_at,
      })),

      // FIX 4: Only return states here — LGAs and wards come from cascade endpoints
      filterOptions: {
        states: states.rows.map((r) => r.state),
        lgas: [],
        wards: [],
        agents: agents.rows.map((r) => ({ id: r.id, name: r.full_name })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /admin/campaign-dashboard/lgas ───────────────────────────────────────
// FIX 5: Cascade — returns only LGAs belonging to the selected state

campaignDashboardRouter.get('/lgas', async (req, res, next) => {
  try {
    const state = (req.query.state as string | undefined)?.trim();
    if (!state) return res.json([]);

    const result = await pool.query<{ lga: string }>(
      `select distinct initcap(trim(c.lga)) as lga
       from customers c
       where upper(trim(c.state)) = upper(trim($1))
         and c.lga is not null
         and trim(c.lga) <> ''
       order by lga`,
      [state],
    );
    res.json(result.rows.map((r) => r.lga));
  } catch (error) {
    next(error);
  }
});

// ── GET /admin/campaign-dashboard/wards ──────────────────────────────────────
// FIX 6: Cascade — returns only wards belonging to the selected LGA

campaignDashboardRouter.get('/wards', async (req, res, next) => {
  try {
    const state = (req.query.state as string | undefined)?.trim();
    const lga = (req.query.lga as string | undefined)?.trim();
    if (!state || !lga) return res.json([]);

    const result = await pool.query<{ ward: string }>(
      `select min(ward_name) as ward
       from (
         select trim(ward) as ward_name
         from polling_units
         where upper(trim(state)) = upper(trim($1))
           and upper(trim(lga)) = upper(trim($2))
           and ward is not null
           and trim(ward) <> ''
         union all
         select trim(ward) as ward_name
         from customers
         where upper(trim(state)) = upper(trim($1))
           and upper(trim(lga)) = upper(trim($2))
           and ward is not null
           and trim(ward) <> ''
       ) ward_sources
       group by lower(ward_name)
       order by lower(min(ward_name))`,
      [state, lga],
    );
    res.json(result.rows.map((r) => r.ward));
  } catch (error) {
    next(error);
  }
});
