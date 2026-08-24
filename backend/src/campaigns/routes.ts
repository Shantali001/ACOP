import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { createAdminNotifications } from '../notifications/helper.js';
import { validateCampaignInput } from './validation.js';
import type { CampaignRow, MemberPayload } from './types.js';

export const campaignsRouter = Router();

function mapCampaign(row: CampaignRow) {
  return {
    id: row.id,
    campaignName: row.campaign_name,
    description: row.description,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
  };
}
campaignsRouter.use(requireAuth);
campaignsRouter.use(requireRole('ADMIN'));

// Create campaign
campaignsRouter.post('/', async (req, res, next) => {
  try {
    const { campaign, errors } = validateCampaignInput(req.body as Record<string, unknown>);
    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const result = await pool.query(
      `INSERT INTO campaigns (campaign_name, description, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING id, campaign_name, description, status, start_date, end_date`,
      [campaign.campaignName, campaign.description, campaign.startDate ?? null, campaign.endDate ?? null],
    );

    res.status(201).json(mapCampaign(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

// Edit campaign
campaignsRouter.put('/:id', async (req, res, next) => {
  try {
    const { campaign, errors } = validateCampaignInput(req.body as Record<string, unknown>);
    if (errors.length) {
      res.status(400).json({ message: errors.join(' '), errors });
      return;
    }

    const result = await pool.query(
      `UPDATE campaigns SET campaign_name = $2, description = $3, start_date = $4, end_date = $5 WHERE id = $1 RETURNING id, campaign_name, description, status, start_date, end_date`,
      [req.params.id, campaign.campaignName, campaign.description, campaign.startDate ?? null, campaign.endDate ?? null],
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    res.json(mapCampaign(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

// Activate campaign
campaignsRouter.post('/:id/activate', async (req, res, next) => {
  try {
    const result = await pool.query<CampaignRow>(`UPDATE campaigns SET status = 'ACTIVE' WHERE id = $1 RETURNING id, campaign_name, description, status, start_date, end_date`, [
      req.params.id,
    ]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    await createAdminNotifications('Campaign activated: ' + result.rows[0].campaign_name);
    res.json(mapCampaign(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

// Close campaign
campaignsRouter.post('/:id/close', async (req, res, next) => {
  try {
    const result = await pool.query<CampaignRow>(`UPDATE campaigns SET status = 'CLOSED' WHERE id = $1 RETURNING id, campaign_name, description, status, start_date, end_date`, [
      req.params.id,
    ]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    await createAdminNotifications('Campaign completed: ' + result.rows[0].campaign_name);
    res.json(mapCampaign(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

// List campaigns with optional status filter
campaignsRouter.get('/', async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const values: unknown[] = [];
    let where = '';

    if (status === 'ACTIVE' || status === 'CLOSED') {
      where = 'WHERE c.status = $1';
      values.push(status);
    }

    const result = await pool.query(
      `SELECT
         c.id,
         c.campaign_name,
         c.description,
         c.status,
         c.start_date,
         c.end_date,
         (SELECT COUNT(*) FROM campaign_members cm WHERE cm.campaign_id = c.id) AS total_members,
         (SELECT COUNT(*) FROM customer_assignments ca WHERE ca.campaign_id = c.id) AS total_assigned,
         (SELECT COUNT(*) FROM customer_assignments ca WHERE ca.campaign_id = c.id AND ca.assignment_status = 'COMPLETED') AS completed,
         (SELECT COUNT(*) FROM customer_assignments ca WHERE ca.campaign_id = c.id AND ca.assignment_status = 'ACTIVE') AS pending
       FROM campaigns c
       ${where}
       ORDER BY c.start_date DESC NULLS LAST`,
      values,
    );

    res.json(result.rows.map((row) => ({
      ...row,
      campaignName: row.campaign_name,
      description: row.description,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      totalMembers: Number(row.total_members),
      totalAssigned: Number(row.total_assigned),
      completed: Number(row.completed),
      pending: Number(row.pending),
    })));
  } catch (error) {
    next(error);
  }
});

// Get campaign detail
campaignsRouter.get('/:id', async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const result = await pool.query(
      `SELECT id, campaign_name, description, status, start_date, end_date FROM campaigns WHERE id = $1`,
      [campaignId],
    );

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      campaignName: row.campaign_name,
      description: row.description,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
    });
  } catch (error) {
    next(error);
  }
});

// Campaign stats
campaignsRouter.get('/:id/stats', async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const exists = await pool.query('SELECT 1 FROM campaigns WHERE id = $1', [campaignId]);
    if (!exists.rows[0]) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    const totalMembersRes = await pool.query(
      `SELECT COUNT(*)::int AS total_members FROM campaign_members WHERE campaign_id = $1`,
      [campaignId],
    );

    const totalAssignedRes = await pool.query(
      `SELECT COUNT(*)::int AS total_assigned FROM customer_assignments WHERE campaign_id = $1`,
      [campaignId],
    );

    const completedRes = await pool.query(
      `SELECT COUNT(*)::int AS completed FROM customer_assignments WHERE campaign_id = $1 AND assignment_status = 'COMPLETED'`,
      [campaignId],
    );

    const pendingRes = await pool.query(
      `SELECT COUNT(*)::int AS pending FROM customer_assignments WHERE campaign_id = $1 AND assignment_status = 'ACTIVE'`,
      [campaignId],
    );

    res.json({
      totalMembers: totalMembersRes.rows[0].total_members,
      totalAssigned: totalAssignedRes.rows[0].total_assigned,
      completed: completedRes.rows[0].completed,
      pending: pendingRes.rows[0].pending,
    });
  } catch (error) {
    next(error);
  }
});

// Add members to campaign (customer IDs[]) and skip duplicates.
campaignsRouter.post('/:id/members', async (req, res, next) => {
  try {
    const payload = req.body as MemberPayload;
    const customerIds = Array.isArray(payload?.customerIds)
      ? [...new Set(payload.customerIds.filter((customerId) => typeof customerId === 'string' && customerId.trim()))]
      : [];

    if (!customerIds.length) {
      res.status(400).json({ message: 'customerIds array is required.' });
      return;
    }

    const campaignId = req.params.id;
    const campaignExists = await pool.query('SELECT 1 FROM campaigns WHERE id = $1', [campaignId]);
    if (!campaignExists.rows[0]) {
      res.status(404).json({ message: 'Campaign not found.' });
      return;
    }

    const added: string[] = [];
    const skipped: string[] = [];

    for (const customerId of customerIds) {
      try {
        const r = await pool.query(
          `INSERT INTO campaign_members (customer_id, campaign_id) VALUES ($1, $2) ON CONFLICT (customer_id, campaign_id) DO NOTHING RETURNING id`,
          [customerId, campaignId],
        );

        if (r.rows[0]) {
          added.push(customerId);
        } else {
          skipped.push(customerId);
        }
      } catch {
        skipped.push(customerId);
      }
    }

    res.json({ added, skipped });
  } catch (error) {
    next(error);
  }
});

// List members for campaign
campaignsRouter.get('/:id/members', async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const { page = '1', pageSize = '20', search = '' } = req.query as Record<string, string>;
    const pageNum = Math.max(Number(page) || 1, 1);
    const size = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
    const offset = (pageNum - 1) * size;

    const values: unknown[] = [campaignId];
    let where = '';

    if (search && search.trim()) {
      where = `AND (c.full_name ILIKE $${values.length + 1} OR c.phone_number ILIKE $${values.length + 1})`;
      values.push(`%${search.trim()}%`);
    }

    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM campaign_members cm JOIN customers c ON c.id = cm.customer_id WHERE cm.campaign_id = $1 ${where}`,
      values,
    );

    const resRows = await pool.query(
      `SELECT c.id, c.full_name, c.phone_number, c.ward, c.lga, c.state, c.created_at FROM campaign_members cm JOIN customers c ON c.id = cm.customer_id WHERE cm.campaign_id = $1 ${where} ORDER BY c.full_name ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, size, offset],
    );

    res.json({ data: resRows.rows, page: pageNum, pageSize: size, total: countRes.rows[0].count });
  } catch (error) {
    next(error);
  }
});
