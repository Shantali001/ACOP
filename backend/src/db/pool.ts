import pg from 'pg';

import { env } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
  family: 4,
});

pool.on('error', (error) => {
  console.warn('Database pool error', error instanceof Error ? error.message : error);
});

export async function verifyDatabaseConnection() {
  const result = await pool.query<{ now: Date }>('select now() as now');

  return {
    connected: true,
    checkedAt: result.rows[0]?.now ?? new Date(),
  };
}
