import { Router } from 'express';
import type pg from 'pg';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { writeAuditLog } from '../audit/helper.js';
import { resolveCurrentAgent } from '../assignments/middleware.js';
import { pool } from '../db/pool.js';
import { modemController } from '../modems/controller.js';
import type { ModemDevice } from '../modems/types.js';
import { mapNextCustomer, mapQueueSummary } from './types.js';

export const agentRouter = Router();
type AgentModemRow = {
  id: string;
  modem_name?: string | null;
  com_port?: string | null;
  status?: 'READY' | 'BUSY' | 'OFFLINE' | null;
  signal_strength?: number | string | null;
  sim_number?: string | null;
  serial_number?: string | null;
};

function mapAgentModem(row: AgentModemRow): ModemDevice {
  return {
    id: row.id,
    name: row.modem_name ?? 'Assigned modem',
    port: row.com_port ?? null,
    status: row.status ?? 'OFFLINE',
    signalStrength: row.signal_strength === null || row.signal_strength === undefined ? null : Number(row.signal_strength),
    simNumber: row.sim_number ?? null,
    imei: row.serial_number ?? null,
    enabled: row.status !== 'OFFLINE',
  };
}

async function getAssignedModem(agentId: string, client: Pick<pg.PoolClient, 'query'> | typeof pool = pool) {
  const result = await client.query<AgentModemRow>(
    `
      select m.*
      from agents a
      join modems m on m.id = a.assigned_modem_id
      where a.id = $1
      limit 1
    `,
    [agentId],
  );

  return result.rows[0] ? mapAgentModem(result.rows[0]) : null;
}

agentRouter.use(requireAuth);
agentRouter.use(requireRole('AGENT'));
agentRouter.use(resolveCurrentAgent);

async function getQueueSummary(agentId: string, client: Pick<pg.PoolClient, 'query'> | typeof pool = pool) {
  const result = await client.query(
    `
      select
        agent_id,
        COUNT(*) AS total_assigned,
        COUNT(*) FILTER (WHERE assignment_status = 'COMPLETED') AS completed,
        COUNT(*) FILTER (WHERE assignment_status = 'ACTIVE') AS remaining
      from customer_assignments
      where agent_id = $1
      group by agent_id
      limit 1
    `,
    [agentId],
  );

  return mapQueueSummary(result.rows[0]);
}

async function getNextCustomer(agentId: string, client: Pick<pg.PoolClient, 'query'> | typeof pool = pool) {
  const result = await client.query('select * from get_next_customer($1)', [agentId]);
  return mapNextCustomer(result.rows[0]);
}

async function getTableColumns(tableName: string, client: Pick<pg.PoolClient, 'query'>) {
  const result = await client.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = $1
    `,
    [tableName],
  );

  return new Set(result.rows.map((row) => row.column_name));
}

function pushColumn(
  columns: string[],
  values: unknown[],
  placeholders: string[],
  name: string,
  value: unknown,
) {
  columns.push(name);
  values.push(value);
  placeholders.push(`$${values.length}`);
}

async function insertCall(
  client: pg.PoolClient,
  assignment: { id: string; agent_id: string; customer_id: string; campaign_id: string; phone_number?: string | null; modem_id?: string | null },
  outcome: string,
  durationSeconds: number | null,
) {
  const tableColumns = await getTableColumns('calls', client);
  const columns: string[] = [];
  const values: unknown[] = [];
  const placeholders: string[] = [];

  if (tableColumns.has('agent_id')) pushColumn(columns, values, placeholders, 'agent_id', assignment.agent_id);
  if (tableColumns.has('customer_id')) pushColumn(columns, values, placeholders, 'customer_id', assignment.customer_id);
  if (tableColumns.has('campaign_id')) pushColumn(columns, values, placeholders, 'campaign_id', assignment.campaign_id);
  if (tableColumns.has('phone_number') && assignment.phone_number) pushColumn(columns, values, placeholders, 'phone_number', assignment.phone_number);
  if (tableColumns.has('modem_id') && assignment.modem_id) pushColumn(columns, values, placeholders, 'modem_id', assignment.modem_id);
  if (tableColumns.has('outcome')) pushColumn(columns, values, placeholders, 'outcome', outcome);
  if (durationSeconds !== null && tableColumns.has('duration')) pushColumn(columns, values, placeholders, 'duration', durationSeconds);
  if (tableColumns.has('start_time')) pushColumn(columns, values, placeholders, 'start_time', new Date());
  if (tableColumns.has('end_time')) pushColumn(columns, values, placeholders, 'end_time', new Date());

  if (!columns.includes('outcome')) {
    throw new Error('calls table must include outcome.');
  }

  const result = await client.query<{ id: string }>(
    `insert into calls (${columns.join(', ')}) values (${placeholders.join(', ')}) returning id`,
    values,
  );

  return result.rows[0].id;
}

async function insertCallNote(client: pg.PoolClient, callId: string, notes: string, createdBy?: string) {
  const tableColumns = await getTableColumns('call_notes', client);
  const columns: string[] = [];
  const values: unknown[] = [];
  const placeholders: string[] = [];

  if (tableColumns.has('call_id')) pushColumn(columns, values, placeholders, 'call_id', callId);
  if (tableColumns.has('note')) pushColumn(columns, values, placeholders, 'note', notes);
  if (createdBy && tableColumns.has('created_by')) pushColumn(columns, values, placeholders, 'created_by', createdBy);

  if (!columns.includes('call_id') || !columns.some((column) => column === 'notes' || column === 'note')) {
    throw new Error('call_notes table must include call_id and note.');
  }

  await client.query(`insert into call_notes (${columns.join(', ')}) values (${placeholders.join(', ')})`, values);
}


agentRouter.get('/dashboard', async (req, res, next) => {
  try {
    const [summary, callsResult, nextCustomer] = await Promise.all([
      getQueueSummary(req.agentId!),
      pool.query<{ calls_today: string | number; average_call_duration: string | number }>(
        `
          select
            count(*) filter (where created_at >= date_trunc('day', now()))::int as calls_today,
            coalesce(avg(duration), 0)::int as average_call_duration
          from calls
          where agent_id = $1
        `,
        [req.agentId],
      ),
      getNextCustomer(req.agentId!),
    ]);

    const calls = callsResult.rows[0];
    res.json({
      assignedCustomers: summary.totalAssigned,
      remaining: summary.remaining,
      completed: summary.completed,
      callsToday: Number(calls?.calls_today ?? 0),
      averageCallDuration: Number(calls?.average_call_duration ?? 0),
      currentCampaign: nextCustomer?.campaignName ?? null,
    });
  } catch (error) {
    next(error);
  }
});
agentRouter.get('/queue-summary', async (req, res, next) => {
  try {
    res.json(await getQueueSummary(req.agentId!));
  } catch (error) {
    next(error);
  }
});

agentRouter.get('/next-customer', async (req, res, next) => {
  try {
    const [customer, summary] = await Promise.all([getNextCustomer(req.agentId!), getQueueSummary(req.agentId!)]);
    res.json({ customer, summary });
  } catch (error) {
    next(error);
  }
});

agentRouter.get('/modem', async (req, res, next) => {
  try {
    const modem = await getAssignedModem(req.agentId!);

    if (!modem) {
      res.json({ modem: null, test: null });
      return;
    }

    const test = await modemController.test(modem);

    res.json({ modem, test });
  } catch (error) {
    console.error('GET /agent/modem error:', error);
    next(error);
  }
});

agentRouter.post('/calls', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const body = req.body as Record<string, unknown>;
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId : typeof body.assignment_id === 'string' ? body.assignment_id : '';
    const outcome = typeof body.outcome === 'string' ? body.outcome.trim() : '';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const durationSeconds = Number.isFinite(Number(body.durationSeconds)) ? Math.max(Number(body.durationSeconds), 0) : null;

    const errors: string[] = [];
    if (!assignmentId) errors.push('assignmentId is required.');
    if (!outcome) errors.push('outcome is required.');

    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    await client.query('begin');

    const assignmentResult = await client.query<{
      id: string;
      agent_id: string;
      customer_id: string;
      campaign_id: string;
      assignment_status: string;
    }>(
      `
        select ca.id, ca.agent_id, ca.customer_id, ca.campaign_id, ca.assignment_status, c.phone_number, a.assigned_modem_id as modem_id
        from customer_assignments ca
        join customers c on c.id = ca.customer_id
        join agents a on a.id = ca.agent_id
        where ca.id = $1
          and ca.agent_id = $2
        for update of ca
      `,
      [assignmentId, req.agentId],
    );
    const assignment = assignmentResult.rows[0];

    if (!assignment) {
      await client.query('rollback');
      res.status(404).json({ message: 'Assignment not found.' });
      return;
    }

    if (assignment.assignment_status !== 'ACTIVE') {
      await client.query('rollback');
      res.status(409).json({ message: 'Assignment is not pending.' });
      return;
    }

    const callId = await insertCall(client, assignment, outcome, durationSeconds);
    if (notes) {
      await insertCallNote(client, callId, notes, req.user!.id);
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: 'call.completed',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: {
        callId,
        outcome,
        notes: notes || null,
        durationSeconds,
        campaignId: assignment.campaign_id,
        customerId: assignment.customer_id,
      },
    });

    if (notes) {
      await writeAuditLog({
        userId: req.user!.id,
        action: 'call.notes_saved',
        entityType: 'call',
        entityId: callId,
        metadata: { notes },
      });
    }

    await client.query("update customer_assignments set assignment_status = 'COMPLETED' where id = $1", [assignment.id]);

    const [nextCustomer, summary] = await Promise.all([getNextCustomer(req.agentId!, client), getQueueSummary(req.agentId!, client)]);

    await client.query('commit');

    res.status(201).json({ callId, customer: nextCustomer, summary });
  } catch (error) {
    await client.query('rollback');
    next(error);
  } finally {
    client.release();
  }
});
agentRouter.post('/calls/dial', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId : typeof body.assignment_id === 'string' ? body.assignment_id : '';

    if (!assignmentId) {
      res.status(400).json({ message: 'assignmentId is required.' });
      return;
    }

    const assignmentResult = await pool.query<{ id: string; phone_number: string; customer_name: string }>(
      `
        select ca.id, c.phone_number, c.full_name as customer_name
        from customer_assignments ca
        join customers c on c.id = ca.customer_id
        where ca.id = $1
          and ca.agent_id = $2
          and ca.assignment_status = 'ACTIVE'
        limit 1
      `,
      [assignmentId, req.agentId],
    );
    const assignment = assignmentResult.rows[0];

    if (!assignment) {
      res.status(404).json({ message: 'Pending assignment not found.' });
      return;
    }

    const modem = await getAssignedModem(req.agentId!);
    if (!modem) {
      res.status(409).json({ message: 'No modem is assigned to this agent.' });
      return;
    }

    const activeCall = await modemController.dial(req.agentId!, modem, assignment.phone_number, { assignmentId: assignment.id, customerName: assignment.customer_name });
    await writeAuditLog({
      userId: req.user!.id,
      action: 'call.started',
      entityType: 'assignment',
      entityId: assignment.id,
      metadata: {
        phoneNumber: assignment.phone_number,
        customerName: assignment.customer_name,
        modemId: modem.id,
      },
    });

    res.json({ dialing: true, phoneNumber: assignment.phone_number, modemId: modem.id, activeCall });
  } catch (error) {
    console.error('POST /agent/calls/dial error:', error);
    next(error);
  }
});

agentRouter.post('/election-calls/dial', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId : '';

    if (!assignmentId) {
      res.status(400).json({ message: 'assignmentId is required.' });
      return;
    }

    const assignmentResult = await pool.query<{ polling_unit_id: string; field_agent_phone: string | null }>(
      `
        SELECT ema.polling_unit_id, pu.field_agent_phone
        FROM election_monitoring_assignments ema
        JOIN polling_units pu ON pu.id = ema.polling_unit_id
        WHERE ema.id = $1 AND ema.agent_id = $2 AND ema.status = 'active'
        LIMIT 1
      `,
      [assignmentId, req.agentId],
    );
    const assignment = assignmentResult.rows[0];

    if (!assignment || !assignment.field_agent_phone) {
      res.status(404).json({ message: 'Assignment or field agent phone not found.' });
      return;
    }

    const modem = await getAssignedModem(req.agentId!);
    if (!modem) {
      res.status(409).json({ message: 'No modem is assigned to this agent.' });
      return;
    }

    await modemController.dial(req.agentId!, modem, assignment.field_agent_phone, { assignmentId });
    await writeAuditLog({
      userId: req.user!.id,
      action: 'election.call.started',
      entityType: 'election_assignment',
      entityId: assignmentId,
      metadata: {
        phoneNumber: assignment.field_agent_phone,
        modemId: modem.id,
      },
    });

    res.json({ dialing: true, phoneNumber: assignment.field_agent_phone, modemId: modem.id });
  } catch (error) {
    console.error('POST /agent/election-calls/dial error:', error);
    next(error);
  }
});

agentRouter.post('/calls/hangup', async (req, res, next) => {
  try {
    const modem = await getAssignedModem(req.agentId!);
    if (!modem) {
      res.status(409).json({ message: 'No modem is assigned to this agent.' });
      return;
    }

    const activeCall = await modemController.hangup(req.agentId!, modem);
    if (activeCall) {
      await writeAuditLog({
        userId: req.user!.id,
        action: 'call.ended',
        entityType: 'agent',
        entityId: req.agentId!,
        metadata: {
          modemId: modem.id,
          phoneNumber: activeCall.phoneNumber,
          startedAt: activeCall.startedAt,
          assignmentId: activeCall.assignmentId ?? null,
          customerName: activeCall.customerName ?? null,
        },
      });
    }

    res.json({ hungUp: true, modemId: modem.id, activeCall });
  } catch (error) {
    console.error('POST /agent/calls/hangup error:', error);
    next(error);
  }
});




