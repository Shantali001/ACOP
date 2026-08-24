import type { Pool, PoolClient } from 'pg';

import { pool } from '../db/pool.js';

type Queryable = Pick<Pool | PoolClient, 'query'>;

export async function createNotification(userId: string | null | undefined, message: string, db: Queryable = pool) {
  if (!userId || !message.trim()) return;

  try {
    await db.query('insert into notifications (user_id, message) values ($1, $2)', [userId, message.trim()]);
  } catch (error) {
    console.warn('notification skipped', error instanceof Error ? error.message : error);
  }
}
export async function createAdminNotifications(message: string, db: Queryable = pool) {
  try {
    const result = await db.query<{ id: string }>("select id from users where role = 'ADMIN' and status = 'ACTIVE'");
    await Promise.all(result.rows.map((row) => createNotification(row.id, message, db)));
  } catch (error) {
    console.warn('admin notification skipped', error instanceof Error ? error.message : error);
  }
}