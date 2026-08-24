import express from 'express';
import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { writeAuditLog } from '../audit/helper.js';
import { pool } from '../db/pool.js';

export const electionRouter = Router();

function parsePagination(query: Record<string, unknown>) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize ?? 20), 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function situationRoomAccess(req: { user?: { role: string } }, res: { status: (code: number) => { json: (body: unknown) => void } }, next: () => void) {
  if (!req.user) {
    res.status(401).json({ message: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERVISOR') {
    res.status(403).json({ message: 'Forbidden.' });
    return;
  }
  next();
}

function mapPollingUnit(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    puCode: row.pu_code as string,
    puName: row.pu_name as string,
    ward: row.ward as string,
    lga: row.lga as string,
    state: row.state as string,
    registeredVoters: Number(row.registered_voters ?? 0),
    fieldAgentName: row.field_agent_name as string | null,
    fieldAgentPhone: row.field_agent_phone as string | null,
    createdAt: row.created_at as string,
  };
}

function mapPartyCandidate(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    partyCode: row.party_code as string | null,
    isOurParty: row.is_our_party as boolean,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapElectionAssignment(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    pollingUnitId: row.polling_unit_id as string,
    agentId: row.agent_id as string,
    status: row.status as string,
    checkInIntervalMinutes: Number(row.check_in_interval_minutes ?? 45),
    lastCalledAt: row.last_called_at as string | null,
    createdAt: row.created_at as string,
  };
}

function mapIncident(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    pollingUnitId: row.polling_unit_id as string,
    reportId: row.report_id as string | null,
    category: row.category as string,
    severity: row.severity as string,
    description: row.description as string | null,
    agentId: row.agent_id as string,
    createdAt: row.created_at as string,
  };
}

function mapElectionTarget(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    scopeLevel: row.scope_level as string,
    scopeValue: row.scope_value as string | null,
    votesNeededToWin: Number(row.votes_needed_to_win ?? 0),
    expectedTurnoutPercent: Number(row.expected_turnout_percent ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

electionRouter.use(requireAuth);

electionRouter.get('/polling-units', situationRoomAccess, async (req, res, next) => {
  try {
    const { page, pageSize, offset } = parsePagination(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
    const lga = typeof req.query.lga === 'string' ? req.query.lga.trim() : '';
    const ward = typeof req.query.ward === 'string' ? req.query.ward.trim() : '';

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(pu_code ILIKE $${values.length} OR pu_name ILIKE $${values.length} OR field_agent_name ILIKE $${values.length})`);
    }
    if (state) {
      values.push(state);
      conditions.push(`state = $${values.length}`);
    }
    if (lga) {
      values.push(lga);
      conditions.push(`lga = $${values.length}`);
    }
    if (ward) {
      values.push(ward);
      conditions.push(`ward = $${values.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query<{ count: string | number }>(`SELECT COUNT(*)::text AS count FROM polling_units ${whereClause}`, values);
    const result = await pool.query(
      `SELECT * FROM polling_units ${whereClause} ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, pageSize, offset],
    );

    res.json({
      data: result.rows.map(mapPollingUnit),
      page,
      pageSize,
      total: Number(countResult.rows[0]?.count ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

electionRouter.post('/polling-units/import', requireRole('ADMIN'), express.raw({ type: () => true, limit: '10mb' }), async (req, res, next) => {
  try {
    const contentType = req.header('content-type') ?? '';
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    let rows: string[][] = [];

    if (contentType.includes('multipart/form-data')) {
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      if (!boundaryMatch) {
        res.status(400).json({ message: 'Missing multipart boundary.' });
        return;
      }
      const boundary = `--${boundaryMatch[1] ?? boundaryMatch[2]}`;
      const raw = body.toString('binary');
      const parts = raw.split(boundary);
      for (const part of parts) {
        if (!part.includes('Content-Disposition') || !part.includes('filename=')) continue;
        const filenameMatch = part.match(/filename="([^"]+)"/i);
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        let content = part.slice(headerEnd + 4);
        content = content.replace(/\r\n--$/, '').replace(/\r\n$/, '');
        const lowerName = (filenameMatch?.[1] ?? '').toLowerCase();
        if (lowerName.endsWith('.xlsx')) {
          const XLSX = await import('xlsx');
          const workbook = XLSX.read(Buffer.from(content, 'binary'), { type: 'buffer' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]!];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
          rows = rawRows.map((row) => row.map((value) => value == null ? '' : String(value)));
        } else {
          const buffer = Buffer.from(content, 'binary');
          rows = buffer.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map((line) => line.split(','));
        }
        break;
      }
    } else {
      const text = body.toString('utf8').replace(/^\uFEFF/, '');
      rows = text.split(/\r?\n/).map((line) => line.split(','));
    }

    const added: string[] = [];
    const skipped: { row: number; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] ?? [];
      const [puCode, puName, ward, lga, state, registeredVoters, fieldAgentName, fieldAgentPhone] = row;
      if (!puCode || !puName || !ward || !lga || !state) {
        skipped.push({ row: i + 1, reason: 'Missing required fields (pu_code, pu_name, ward, lga, state).' });
        continue;
      }
      try {
        const result = await pool.query<{ id: string }>(
          `INSERT INTO polling_units (pu_code, pu_name, ward, lga, state, registered_voters, field_agent_name, field_agent_phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (pu_code) DO UPDATE SET pu_name = EXCLUDED.pu_name, ward = EXCLUDED.ward, lga = EXCLUDED.lga, state = EXCLUDED.state, registered_voters = EXCLUDED.registered_voters, field_agent_name = EXCLUDED.field_agent_name, field_agent_phone = EXCLUDED.field_agent_phone
           RETURNING id`,
          [puCode.trim(), puName.trim(), ward.trim(), lga.trim(), state.trim(), Number(registeredVoters) || 0, (fieldAgentName ?? '').trim() || null, (fieldAgentPhone ?? '').trim() || null],
        );
        added.push(result.rows[0]?.id ?? '');
      } catch (error) {
        skipped.push({ row: i + 1, reason: error instanceof Error ? error.message : 'Insert failed.' });
      }
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: 'polling_units.imported',
      entityType: 'polling_unit_import',
      metadata: { added: added.length, skipped: skipped.length },
    });

    res.json({ added: added.length, skipped: skipped.length, invalid: skipped });
  } catch (error) {
    next(error);
  }
});

electionRouter.post('/polling-units', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const puCode = typeof body.puCode === 'string' ? body.puCode.trim() : '';
    const puName = typeof body.puName === 'string' ? body.puName.trim() : '';
    const ward = typeof body.ward === 'string' ? body.ward.trim() : '';
    const lga = typeof body.lga === 'string' ? body.lga.trim() : '';
    const state = typeof body.state === 'string' ? body.state.trim() : '';
    const registeredVoters = Number(body.registeredVoters ?? 0);
    const fieldAgentName = typeof body.fieldAgentName === 'string' ? body.fieldAgentName.trim() : null;
    const fieldAgentPhone = typeof body.fieldAgentPhone === 'string' ? body.fieldAgentPhone.trim() : null;

    if (!puCode || !puName || !ward || !lga || !state) {
      res.status(400).json({ message: 'puCode, puName, ward, lga, and state are required.' });
      return;
    }

    const result = await pool.query<{ id: string }>(
      `INSERT INTO polling_units (pu_code, pu_name, ward, lga, state, registered_voters, field_agent_name, field_agent_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [puCode, puName, ward, lga, state, registeredVoters, fieldAgentName, fieldAgentPhone],
    );
    res.status(201).json(mapPollingUnit({ ...result.rows[0], pu_code: puCode, pu_name: puName, ward, lga, state, registered_voters: registeredVoters, field_agent_name: fieldAgentName, field_agent_phone: fieldAgentPhone, created_at: new Date().toISOString() }));
  } catch (error) {
    next(error);
  }
});

electionRouter.put('/polling-units/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [req.params.id];

    if (typeof body.puCode === 'string' && body.puCode.trim()) {
      values.push(body.puCode.trim());
      updates.push(`pu_code = $${values.length}`);
    }
    if (typeof body.puName === 'string' && body.puName.trim()) {
      values.push(body.puName.trim());
      updates.push(`pu_name = $${values.length}`);
    }
    if (typeof body.ward === 'string' && body.ward.trim()) {
      values.push(body.ward.trim());
      updates.push(`ward = $${values.length}`);
    }
    if (typeof body.lga === 'string' && body.lga.trim()) {
      values.push(body.lga.trim());
      updates.push(`lga = $${values.length}`);
    }
    if (typeof body.state === 'string' && body.state.trim()) {
      values.push(body.state.trim());
      updates.push(`state = $${values.length}`);
    }
    if (typeof body.registeredVoters === 'number') {
      values.push(body.registeredVoters);
      updates.push(`registered_voters = $${values.length}`);
    }
    if (typeof body.fieldAgentName === 'string') {
      values.push(body.fieldAgentName.trim() || null);
      updates.push(`field_agent_name = $${values.length}`);
    }
    if (typeof body.fieldAgentPhone === 'string') {
      values.push(body.fieldAgentPhone.trim() || null);
      updates.push(`field_agent_phone = $${values.length}`);
    }

    if (!updates.length) {
      res.status(400).json({ message: 'No fields provided.' });
      return;
    }

    const result = await pool.query(`UPDATE polling_units SET ${updates.join(', ')} WHERE id = $1 RETURNING *`, values);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Polling unit not found.' });
      return;
    }
    res.json(mapPollingUnit(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

electionRouter.delete('/polling-units/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM polling_units WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Polling unit not found.' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

electionRouter.post('/election-assignments', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const pollingUnitIds = Array.isArray(body.pollingUnitIds)
      ? body.pollingUnitIds
      : Array.isArray(body.polling_unit_ids)
        ? body.polling_unit_ids
        : typeof body.pollingUnitId === 'string'
          ? [body.pollingUnitId]
          : typeof body.polling_unit_id === 'string'
            ? [body.polling_unit_id]
            : [];
    const agentId = typeof body.agentId === 'string' ? body.agentId : typeof body.agent_id === 'string' ? body.agent_id : '';
    const interval = Number(body.checkInIntervalMinutes ?? body.check_in_interval_minutes ?? 45);

    const errors: string[] = [];
    if (!pollingUnitIds.length) errors.push('pollingUnitIds array is required.');
    if (!agentId) errors.push('agentId is required.');

    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const agentExists = await pool.query(
      `SELECT a.user_id FROM agents a JOIN users u ON u.id = a.user_id WHERE a.id = $1 AND u.role = 'AGENT' AND u.status = 'ACTIVE' LIMIT 1`,
      [agentId],
    );
    if (!agentExists.rows[0]) {
      res.status(404).json({ message: 'Active agent not found.' });
      return;
    }
    const agentUserId = agentExists.rows[0].user_id;

    const validPuIds: string[] = [];
    for (const puId of pollingUnitIds) {
      if (typeof puId !== 'string') continue;
      const pu = await pool.query('SELECT 1 FROM polling_units WHERE id = $1 LIMIT 1', [puId]);
      if (pu.rows[0]) validPuIds.push(puId);
    }

    const result = await pool.query(
      `INSERT INTO election_monitoring_assignments (polling_unit_id, agent_id, check_in_interval_minutes)
       SELECT pu_id, $1, $2 FROM UNNEST($3::uuid[]) AS pu_id
       ON CONFLICT (polling_unit_id, agent_id) DO UPDATE SET check_in_interval_minutes = EXCLUDED.check_in_interval_minutes, status = 'active'
       RETURNING id`,
      [agentUserId, interval, validPuIds],
    );

    await writeAuditLog({
      userId: req.user!.id,
      action: 'election.assignments.created',
      entityType: 'election_assignment',
      entityId: result.rows[0]?.id,
      metadata: { agentId, count: validPuIds.length, interval },
    });

    res.status(201).json({ assigned: result.rowCount ?? 0 });
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/election-assignments/next', async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'AGENT') {
      res.status(403).json({ message: 'Forbidden.' });
      return;
    }
    const agentResult = await pool.query<{ id: string }>('SELECT id FROM agents WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const agent = agentResult.rows[0];
    if (!agent) {
      res.status(403).json({ message: 'Agent profile is not linked to this user.' });
      return;
    }

    const result = await pool.query('SELECT * FROM get_next_polling_unit_to_call($1)', [req.user.id]);
    const row = result.rows[0];
    if (!row) {
      res.json({ assignment: null });
      return;
    }

    res.json({
      assignment: {
        assignmentId: row.assignment_id,
        pollingUnitId: row.polling_unit_id,
        puCode: row.pu_code,
        puName: row.pu_name,
        ward: row.ward,
        lga: row.lga,
        state: row.state,
        fieldAgentName: row.field_agent_name,
        fieldAgentPhone: row.field_agent_phone,
        lastCalledAt: row.last_called_at,
        checkInIntervalMinutes: row.check_in_interval_minutes,
      },
    });
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/election-assignments/mine', async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'AGENT') {
      res.status(403).json({ message: 'Forbidden.' });
      return;
    }
    const agentResult = await pool.query<{ id: string }>('SELECT id FROM agents WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const agent = agentResult.rows[0];
    if (!agent) {
      res.status(403).json({ message: 'Agent profile is not linked to this user.' });
      return;
    }

    const result = await pool.query<Record<string, unknown>>(
      `
        SELECT ema.id, ema.status, ema.check_in_interval_minutes, ema.last_called_at, ema.created_at,
               pu.id AS polling_unit_id, pu.pu_code, pu.pu_name, pu.ward, pu.lga, pu.state,
               pu.field_agent_name, pu.field_agent_phone
        FROM election_monitoring_assignments ema
        JOIN polling_units pu ON pu.id = ema.polling_unit_id
         WHERE ema.agent_id = $1
         ORDER BY ema.last_called_at ASC NULLS FIRST
      `,
       [req.user.id],
     );

    res.json({ data: result.rows.map(mapElectionAssignment) });
  } catch (error) {
    next(error);
  }
});

electionRouter.post('/polling-unit-reports', async (req, res, next) => {
  const client = await pool.connect();
  try {
    if (!req.user || req.user.role !== 'AGENT') {
      res.status(403).json({ message: 'Forbidden.' });
      return;
    }
    const agentResult = await pool.query<{ id: string }>('SELECT id FROM agents WHERE user_id = $1 LIMIT 1', [req.user.id]);
    const agent = agentResult.rows[0];
    if (!agent) {
      res.status(403).json({ message: 'Agent profile is not linked to this user.' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId : '';
    const reportType = typeof body.reportType === 'string' ? body.reportType : 'checkin';
    const accreditedVoters = body.accreditedVoters == null ? null : Number(body.accreditedVoters);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
    const results = Array.isArray(body.results) ? body.results : [];
    const incident = body.incident as Record<string, unknown> | undefined;

    if (!assignmentId) {
      res.status(400).json({ message: 'assignmentId is required.' });
      return;
    }
    if (!['opening', 'checkin', 'final'].includes(reportType)) {
      res.status(400).json({ message: 'Invalid reportType. Use opening, checkin, or final.' });
      return;
    }

    await client.query('BEGIN');

    const assignmentResult = await client.query<{ id: string; polling_unit_id: string }>(
      `SELECT id, polling_unit_id FROM election_monitoring_assignments WHERE id = $1 AND agent_id = $2 AND status = 'active' FOR UPDATE`,
      [assignmentId, req.user.id],
    );
    const assignment = assignmentResult.rows[0];
    if (!assignment) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Assignment not found.' });
      return;
    }

    const puResult = await client.query<{ registered_voters: number }>('SELECT registered_voters FROM polling_units WHERE id = $1', [assignment.polling_unit_id]);
    const registeredVoters = Number(puResult.rows[0]?.registered_voters ?? 0);

    const reportResult = await client.query<{ id: string }>(
      `INSERT INTO polling_unit_reports (polling_unit_id, agent_id, report_type, accredited_voters, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [assignment.polling_unit_id, req.user.id, reportType, accreditedVoters, notes || null],
    );
    const reportId = reportResult.rows[0].id;

    for (const result of results) {
      const partyCandidateId = typeof result.partyCandidateId === 'string' ? result.partyCandidateId : typeof result.party_candidate_id === 'string' ? result.party_candidate_id : '';
      const voteCount = Number(result.voteCount ?? result.vote_count ?? 0);
      if (!partyCandidateId) continue;
      await client.query(
        `INSERT INTO polling_unit_results (report_id, party_candidate_id, vote_count) VALUES ($1, $2, $3)`,
        [reportId, partyCandidateId, voteCount],
      );
    }

    let incidentId: string | undefined;
    if (incident && incident.category) {
      const incidentResult = await client.query<{ id: string }>(
        `INSERT INTO polling_unit_incidents (polling_unit_id, report_id, category, severity, description, agent_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [assignment.polling_unit_id, reportId, incident.category as string, incident.severity as string || 'medium', incident.description as string || null, req.user.id],
      );
      incidentId = incidentResult.rows[0].id;
    }

    if (reportType === 'final') {
      await client.query("UPDATE election_monitoring_assignments SET status = 'closed', last_called_at = NOW() WHERE id = $1", [assignmentId]);
    } else {
      await client.query('UPDATE election_monitoring_assignments SET last_called_at = NOW() WHERE id = $1', [assignmentId]);
    }

    await client.query('COMMIT');

    await writeAuditLog({
      userId: req.user!.id,
      action: 'polling_unit_report.submitted',
      entityType: 'polling_unit_report',
      entityId: reportId,
      metadata: { assignmentId, reportType, accreditedVoters, incidentId, registeredVoters, overAccredited: accreditedVoters != null && accreditedVoters > registeredVoters },
    });

    res.status(201).json({
      reportId,
      incidentId,
      flagged: accreditedVoters != null && accreditedVoters > registeredVoters,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

electionRouter.get('/situation-room/summary', situationRoomAccess, async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE lr.accredited_voters IS NOT NULL) AS pus_reported,
        COUNT(*) AS total_pus,
        SUM(pu.registered_voters) AS total_registered,
        SUM(COALESCE(lr.accredited_voters, 0)) AS total_accredited,
        ROUND(100.0 * COUNT(*) FILTER (WHERE lr.accredited_voters IS NOT NULL) / NULLIF(COUNT(*), 0), 1) AS coverage_percent,
        ROUND(100.0 * SUM(COALESCE(lr.accredited_voters, 0)) / NULLIF(SUM(pu.registered_voters), 0), 1) AS turnout_percent
      FROM polling_units pu
      LEFT JOIN polling_unit_latest_report lr ON lr.polling_unit_id = pu.id
    `);
    const row = result.rows[0];
    res.json({
      totalPus: Number(row?.total_pus ?? 0),
      pusReported: Number(row?.pus_reported ?? 0),
      totalRegisteredVoters: Number(row?.total_registered ?? 0),
      totalAccreditedVoters: Number(row?.total_accredited ?? 0),
      coveragePercent: Number(row?.coverage_percent ?? 0),
      turnoutPercent: Number(row?.turnout_percent ?? 0),
    });
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/situation-room/geo', situationRoomAccess, async (req, res, next) => {
  try {
    const level = typeof req.query.level === 'string' ? req.query.level : 'lga';
    if (!['state', 'lga', 'ward'].includes(level)) {
      res.status(400).json({ message: 'Invalid level. Use state, lga, or ward.' });
      return;
    }

    let sql = '';
    if (level === 'state') {
      sql = `SELECT state, COUNT(*) AS total_pus, COUNT(pus_reported) AS pus_reported, SUM(registered_voters) AS registered_voters, SUM(accredited_voters) AS accredited_voters FROM election_geo_rollup GROUP BY state ORDER BY state`;
    } else if (level === 'lga') {
      sql = `SELECT state, lga, COUNT(*) AS total_pus, COUNT(pus_reported) AS pus_reported, SUM(registered_voters) AS registered_voters, SUM(accredited_voters) AS accredited_voters FROM election_geo_rollup GROUP BY state, lga ORDER BY state, lga`;
    } else {
      sql = `SELECT state, lga, ward, COUNT(*) AS total_pus, COUNT(pus_reported) AS pus_reported, SUM(registered_voters) AS registered_voters, SUM(accredited_voters) AS accredited_voters FROM election_geo_rollup GROUP BY state, lga, ward ORDER BY state, lga, ward`;
    }

    const result = await pool.query(sql);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/situation-room/stale', situationRoomAccess, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM election_stale_pus ORDER BY due_at ASC');
    res.json({ data: result.rows.map(mapPollingUnit) });
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/situation-room/incidents', situationRoomAccess, async (req, res, next) => {
  try {
    const severity = typeof req.query.severity === 'string' ? req.query.severity : '';
    let sql = 'SELECT * FROM polling_unit_incidents';
    const values: unknown[] = [];
    if (severity) {
      values.push(severity);
      sql += ` WHERE severity = $${values.length}`;
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(sql, values);
    res.json({ data: result.rows.map(mapIncident) });
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/situation-room/projection', situationRoomAccess, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM election_projection');
    const row = result.rows[0];
    if (!row) {
      res.json({ ourVotes: 0, allVotes: 0, currentVoteSharePercent: 0, pusReported: 0, totalPus: 0, coveragePercent: 0, projectedFinalVotes: 0, votesNeededToWin: 0, confidenceLevel: 'Low' });
      return;
    }
    res.json({
      ourVotes: Number(row.our_votes ?? 0),
      allVotes: Number(row.all_votes ?? 0),
      currentVoteSharePercent: Number(row.current_vote_share_percent ?? 0),
      pusReported: Number(row.pus_reported ?? 0),
      totalPus: Number(row.total_pus ?? 0),
      coveragePercent: Number(row.coverage_percent ?? 0),
      projectedFinalVotes: Number(row.projected_final_votes ?? 0),
      votesNeededToWin: Number(row.votes_needed_to_win ?? 0),
      confidenceLevel: row.confidence_level ?? 'Low',
    });
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/election-targets', situationRoomAccess, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM election_targets WHERE scope_level = 'overall' ORDER BY updated_at DESC LIMIT 1");
    const row = result.rows[0];
    res.json({ target: row ? mapElectionTarget(row) : null });
  } catch (error) {
    next(error);
  }
});

electionRouter.put('/election-targets', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const votesNeededToWin = Number(body.votesNeededToWin ?? body.votes_needed_to_win ?? 0);
    const expectedTurnoutPercent = Number(body.expectedTurnoutPercent ?? body.expected_turnout_percent ?? 50);

    if (!Number.isFinite(votesNeededToWin) || votesNeededToWin < 0) {
      res.status(400).json({ message: 'votesNeededToWin must be a non-negative number.' });
      return;
    }
    if (!Number.isFinite(expectedTurnoutPercent) || expectedTurnoutPercent < 0 || expectedTurnoutPercent > 100) {
      res.status(400).json({ message: 'expectedTurnoutPercent must be between 0 and 100.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO election_targets (scope_level, votes_needed_to_win, expected_turnout_percent) VALUES ('overall', $1, $2) RETURNING *`,
      [votesNeededToWin, expectedTurnoutPercent],
    );

    await writeAuditLog({
      userId: req.user!.id,
      action: 'election.targets.updated',
      entityType: 'election_target',
      entityId: result.rows[0]?.id,
      metadata: { votesNeededToWin, expectedTurnoutPercent },
    });

    res.json(mapElectionTarget(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/parties-candidates', situationRoomAccess, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM parties_candidates ORDER BY sort_order ASC, name ASC');
    res.json({ data: result.rows.map(mapPartyCandidate) });
  } catch (error) {
    next(error);
  }
});

electionRouter.post('/parties-candidates', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const partyCode = typeof body.partyCode === 'string' ? body.partyCode.trim() : null;
    const isOurParty = body.isOurParty === true;
    const sortOrder = Number(body.sortOrder ?? 0);

    if (!name) {
      res.status(400).json({ message: 'name is required.' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO parties_candidates (name, party_code, is_our_party, sort_order) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, partyCode, isOurParty, sortOrder],
    );
    res.status(201).json(mapPartyCandidate(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

electionRouter.put('/parties-candidates/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const body = req.body as Record<string, unknown>;
    const updates: string[] = [];
    const values: unknown[] = [req.params.id];

    if (typeof body.name === 'string' && body.name.trim()) {
      values.push(body.name.trim());
      updates.push(`name = $${values.length}`);
    }
    if (typeof body.partyCode === 'string') {
      values.push(body.partyCode.trim() || null);
      updates.push(`party_code = $${values.length}`);
    }
    if (typeof body.isOurParty === 'boolean') {
      values.push(body.isOurParty);
      updates.push(`is_our_party = $${values.length}`);
    }
    if (typeof body.sortOrder === 'number') {
      values.push(body.sortOrder);
      updates.push(`sort_order = $${values.length}`);
    }

    if (!updates.length) {
      res.status(400).json({ message: 'No fields provided.' });
      return;
    }

    const result = await pool.query(`UPDATE parties_candidates SET ${updates.join(', ')} WHERE id = $1 RETURNING *`, values);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Party/candidate not found.' });
      return;
    }
    res.json(mapPartyCandidate(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

electionRouter.delete('/parties-candidates/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM parties_candidates WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ message: 'Party/candidate not found.' });
      return;
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

electionRouter.get('/election-assignments/summary', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const result = await pool.query<{ id: string; full_name: string; email: string; assigned_count: string | number }>(
      `
        SELECT a.id, u.full_name, u.email, COUNT(ema.id) AS assigned_count
        FROM agents a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN election_monitoring_assignments ema ON ema.agent_id = u.id AND ema.status = 'active'
        WHERE u.role = 'AGENT' AND u.status = 'ACTIVE'
        GROUP BY a.id, u.full_name, u.email
        ORDER BY u.full_name ASC
      `,
    );
    res.json({ data: result.rows.map((row) => ({ agentId: row.id, fullName: row.full_name, email: row.email, assignedCount: Number(row.assigned_count ?? 0) })) });
  } catch (error) {
    next(error);
  }
});
