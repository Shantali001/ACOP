import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { pool } from '../db/pool.js';
import { createAdminNotifications } from '../notifications/helper.js';
import { modemController } from './controller.js';
import { discoverAllModemPorts, onPortCorrected } from './drivers.js';
import type { ModemDevice, ModemStatus } from './types.js';

export const modemsRouter = Router();

const modemStatuses = new Set<ModemStatus>(['READY', 'BUSY', 'OFFLINE']);

modemsRouter.use(requireAuth);
modemsRouter.use(requireRole('ADMIN'));

type ModemRow = {
  id: string;
  modem_name?: string | null;
  com_port?: string | null;
  status?: ModemStatus | null;
  signal_strength?: number | string | null;
  sim_number?: string | null;
  serial_number?: string | null;
  network?: string | null;
  assigned_agent_id?: string | null;
  assigned_agent_name?: string | null;
};

function mapModem(row: ModemRow) {
  return {
    id: row.id,
    name: row.modem_name ?? 'Modem',
    port: row.com_port ?? null,
    status: row.status ?? 'OFFLINE',
    signalStrength: row.signal_strength === null || row.signal_strength === undefined ? null : Number(row.signal_strength),
    simNumber: row.sim_number ?? null,
    imei: row.serial_number ?? null,
    enabled: row.status !== 'OFFLINE',
    assignedAgentId: row.assigned_agent_id ?? null,
    assignedAgentName: row.assigned_agent_name ?? null,
  };
}

function toDevice(row: ModemRow): ModemDevice {
  const modem = mapModem(row);
  return {
    id: modem.id,
    name: modem.name,
    port: modem.port,
    status: modem.status,
    signalStrength: modem.signalStrength,
    simNumber: modem.simNumber,
    imei: modem.imei,
    enabled: modem.enabled,
  };
}

async function getModem(id: string) {
  const result = await pool.query<ModemRow>(
    `
      select
        m.*,
        a.id as assigned_agent_id,
        u.full_name as assigned_agent_name
      from modems m
      left join agents a on a.assigned_modem_id = m.id
      left join users u on u.id = a.user_id
      where m.id = $1
      limit 1
    `,
    [id],
  );

  return result.rows[0] ?? null;
}

// Whenever the serial driver discovers that a modem's real port no longer
// matches what's stored (e.g. Windows moved it from COM17 to COM16), persist
// the fix automatically and let admins know it happened, instead of leaving
// the database pointing at a dead port until someone edits it by hand.
onPortCorrected(async ({ modemId, previousPort, newPort }) => {
  try {
    const result = await pool.query<ModemRow>(
      `update modems set com_port = $2, status = 'READY' where id = $1 returning *`,
      [modemId, newPort],
    );
    const modem = result.rows[0];
    const modemName = modem?.modem_name ?? modemId;
    await createAdminNotifications(
      `Modem port auto-corrected: ${modemName} moved from ${previousPort ?? '(unset)'} to ${newPort}.`,
    );
  } catch (error) {
    console.error('Failed to persist auto-corrected modem port:', error);
  }
});

// Re-tests every modem configured for the serial driver, letting the driver
// self-heal any that have drifted to a different COM/tty port. Safe to call
// on a timer or on demand — modems that already respond on their configured
// port are left untouched.
export async function runModemAutoHeal(): Promise<void> {
  const result = await pool.query<ModemRow>('select * from modems');

  const knownPorts = result.rows.map((row) => row.com_port).filter((port): port is string => Boolean(port));

  for (const row of result.rows) {
    const excludePorts = knownPorts.filter((port) => port !== row.com_port);
    try {
      const testResult = await modemController.test(toDevice(row), { excludePorts });
      await pool.query('update modems set status = $2 where id = $1', [row.id, testResult.status]);
    } catch (error) {
      console.error(`Modem auto-heal failed for ${row.id}:`, error);
    }
  }
}

modemsRouter.post('/auto-heal', async (_req, res, next) => {
  try {
    await runModemAutoHeal();
    const result = await pool.query<ModemRow>(
      `
        select
          m.*,
          a.id as assigned_agent_id,
          u.full_name as assigned_agent_name
        from modems m
        left join agents a on a.assigned_modem_id = m.id
        left join users u on u.id = a.user_id
        order by coalesce(m.modem_name, m.id::text) asc
      `,
    );
    res.json(result.rows.map(mapModem));
  } catch (error) {
    next(error);
  }
});

modemsRouter.get('/', async (_req, res, next) => {
  try {
    const result = await pool.query<ModemRow>(
      `
        select
          m.*,
          a.id as assigned_agent_id,
          u.full_name as assigned_agent_name
        from modems m
        left join agents a on a.assigned_modem_id = m.id
        left join users u on u.id = a.user_id
        order by coalesce(m.modem_name, m.id::text) asc
      `,
    );

    res.json(result.rows.map(mapModem));
  } catch (error) {
    next(error);
  }
});

modemsRouter.post('/', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown> | undefined;
    const modemName = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : null;
    const comPort = typeof body?.port === 'string' && body.port.trim() ? body.port.trim() : null;
    const simNumber = typeof body?.simNumber === 'string' && body.simNumber.trim() ? body.simNumber.trim() : null;
    const imei = typeof body?.imei === 'string' && body.imei.trim() ? body.imei.trim() : null;
    const status = typeof body?.status === 'string' && body.status.trim() ? body.status.trim().toUpperCase() : 'READY';

    if (!modemName && !comPort) {
      res.status(400).json({ message: 'Modem name or COM port is required.' });
      return;
    }

    const result = await pool.query<ModemRow>(
      `
        insert into modems (modem_name, com_port, status, signal_strength, sim_number, serial_number, network)
        values ($1, $2, $3, null, $4, $5, null)
        returning *
      `,
      [modemName, comPort, status, simNumber, imei],
    );

    res.status(201).json(mapModem(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

modemsRouter.post('/discover', async (_req, res, next) => {
  try {
    const ports = await discoverAllModemPorts();
    const discovered: ModemRow[] = [];

    for (const port of ports) {
      const existing = await pool.query<ModemRow>('select * from modems where com_port = $1 limit 1', [port]);

      if (existing.rows[0]) {
        discovered.push(existing.rows[0]);
        continue;
      }

      const result = await pool.query<ModemRow>(
        `
          insert into modems (modem_name, com_port, status, signal_strength, sim_number, serial_number, network)
          values ($1, $2, 'READY', null, null, null, null)
          returning *
        `,
        [`Modem ${port}`, port],
      );

      discovered.push(result.rows[0]);
    }

    res.json(discovered.map(mapModem));
  } catch (error) {
    next(error);
  }
});

modemsRouter.post('/assign', async (req, res, next) => {
  const client = await pool.connect();

  try {
    const { agentId, modemId } = req.body as { agentId?: string; modemId?: string };
    if (!agentId || !modemId) {
      res.status(400).json({ message: 'agentId and modemId are required.' });
      return;
    }

    await client.query('begin');

    const agentResult = await client.query('select id from agents where id = $1 limit 1', [agentId]);
    const modemResult = await client.query('select id from modems where id = $1 limit 1', [modemId]);

    if (!agentResult.rows[0] || !modemResult.rows[0]) {
      await client.query('rollback');
      res.status(404).json({ message: 'Agent or modem not found.' });
      return;
    }

    await client.query(
      `
        insert into agent_modems (agent_id, modem_id)
        values ($1, $2)
        on conflict do nothing
      `,
      [agentId, modemId],
    );
    await client.query('update agents set assigned_modem_id = $2 where id = $1', [agentId, modemId]);

    await client.query('commit');

    res.json({ agentId, modemId });
  } catch (error) {
    await client.query('rollback');
    next(error);
  } finally {
    client.release();
  }
});

modemsRouter.post('/:id/test', async (req, res, next) => {
  try {
    const row = await getModem(req.params.id);
    if (!row) {
      res.status(404).json({ message: 'Modem not found.' });
      return;
    }

    const result = await modemController.test(toDevice(row));
    const updateResult = await pool.query<ModemRow>('update modems set status = $2 where id = $1 returning *', [req.params.id, result.status]);
    const updatedModem = updateResult.rows[0];

    if (updatedModem?.status === 'OFFLINE') {
      const modemName = updatedModem.modem_name ?? updatedModem.id;
      await createAdminNotifications(`Modem disconnected: ${modemName}`);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

modemsRouter.put('/:id', async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [req.params.id];

    if (typeof body.name === 'string') {
      values.push(body.name.trim());
      updates.push(`modem_name = $${values.length}`);
    }

    if (typeof body.port === 'string') {
      values.push(body.port.trim() || null);
      updates.push(`com_port = $${values.length}`);
    }

    if (typeof body.simNumber === 'string') {
      values.push(body.simNumber.trim() || null);
      updates.push(`sim_number = $${values.length}`);
    }

    if (typeof body.status === 'string') {
      const status = body.status.trim().toUpperCase() as ModemStatus;
      if (!modemStatuses.has(status)) {
        res.status(400).json({ message: 'Invalid modem status. Use READY, BUSY, or OFFLINE.' });
        return;
      }
      values.push(status);
      updates.push(`status = $${values.length}`);
    }

    if (typeof body.signalStrength === 'number' && Number.isFinite(body.signalStrength)) {
      values.push(Math.max(0, Math.min(100, body.signalStrength)));
      updates.push(`signal_strength = $${values.length}`);
    }

    if (typeof body.imei === 'string') {
      values.push(body.imei.trim() || null);
      updates.push(`serial_number = $${values.length}`);
    }

    if (typeof body.enabled === 'boolean') {
      values.push(body.enabled ? 'READY' : 'OFFLINE');
      updates.push(`status = $${values.length}`);
    }

    if (!updates.length) {
      res.status(400).json({ message: 'No modem fields provided.' });
      return;
    }

    const result = await pool.query<ModemRow>(
      `update modems set ${updates.join(', ')} where id = $1 returning *`,
      values,
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Modem not found.' });
      return;
    }

    const updatedModem = result.rows[0];
    const modemName = updatedModem.modem_name ?? updatedModem.id;

    if (updatedModem.status === 'OFFLINE') {
      await createAdminNotifications(`Modem disconnected: ${modemName}`);
    }

    if (!updatedModem.sim_number) {
      await createAdminNotifications(`Modem missing SIM: ${modemName}`);
    }

    if (updatedModem.signal_strength !== null && updatedModem.signal_strength !== undefined && Number(updatedModem.signal_strength) < 20) {
      await createAdminNotifications(`Modem low signal (${updatedModem.signal_strength}%): ${modemName}`);
    }

    res.json(mapModem(updatedModem));
  } catch (error) {
    next(error);
  }
});


