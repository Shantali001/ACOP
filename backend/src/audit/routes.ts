import { Router } from 'express';

import { requireAuth, requireRole } from '../auth/middleware.js';
import { pool } from '../db/pool.js';

export const auditRouter = Router();

auditRouter.use(requireAuth);
auditRouter.use(requireRole('ADMIN'));

auditRouter.get('/', async (req, res, next) => {
  try {
    const values: unknown[] = [];
    const filters: string[] = [];
    const { user, action, entity, dateFrom, dateTo, search } = req.query as Record<string, string | undefined>;

    if (user?.trim()) {
      values.push(`%${user.trim()}%`);
      filters.push(`(u.full_name ilike $${values.length} or u.email ilike $${values.length})`);
    }
    if (action?.trim()) {
      values.push(`%${action.trim()}%`);
      filters.push(`al.action ilike $${values.length}`);
    }
    if (entity?.trim()) {
      values.push(`%${entity.trim()}%`);
      filters.push(`coalesce(al.entity_type, '') ilike $${values.length}`);
    }
    if (dateFrom) {
      values.push(dateFrom);
      filters.push(`al.created_at >= $${values.length}`);
    }
    if (dateTo) {
      values.push(dateTo);
      filters.push(`al.created_at <= $${values.length}`);
    }
    if (search?.trim()) {
      values.push(`%${search.trim()}%`);
      filters.push(`(al.action ilike $${values.length} or coalesce(al.entity_type, '') ilike $${values.length} or coalesce(al.entity_id::text, '') ilike $${values.length})`);
    }

    const where = filters.length ? `where ${filters.join(' and ')}` : '';
    const result = await pool.query(
      `
        select al.id, al.user_id, u.full_name, u.email, al.action, al.entity_type as entity_type, al.entity_id, al.metadata as metadata, al.created_at
        from audit_logs al
        left join users u on u.id = al.user_id
        ${where}
        order by al.created_at desc
        limit 200
      `,
      values,
    );

    res.json({
      data: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.full_name,
        userEmail: row.email,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        metadata: row.metadata,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    next(error);
  }
});