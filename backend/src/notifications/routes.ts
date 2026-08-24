import { Router } from 'express';

import { requireAuth } from '../auth/middleware.js';
import { pool } from '../db/pool.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `
        select id, message, read, created_at
        from notifications
        where user_id = $1
        order by created_at desc
        limit 20
      `,
      [req.user!.id],
    );
    const unreadResult = await pool.query<{ count: string }>('select count(*)::text as count from notifications where user_id = $1 and read = false', [req.user!.id]);

    res.json({
      unreadCount: Number(unreadResult.rows[0]?.count ?? 0),
      data: result.rows.map((row) => ({ id: row.id, message: row.message, read: row.read, createdAt: row.created_at })),
    });
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/:id/read', async (req, res, next) => {
  try {
    const result = await pool.query('update notifications set read = true where id = $1 and user_id = $2 returning id', [req.params.id, req.user!.id]);

    if (!result.rows[0]) {
      res.status(404).json({ message: 'Notification not found.' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

notificationsRouter.post('/read-all', async (req, res, next) => {
  try {
    await pool.query('update notifications set read = true where user_id = $1', [req.user!.id]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});