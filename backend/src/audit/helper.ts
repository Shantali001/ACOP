import type { Pool, PoolClient } from 'pg';

import { pool } from '../db/pool.js';

type Queryable = Pick<Pool | PoolClient, 'query'>;

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

let cachedColumns: Set<string> | null = null;

async function getAuditColumns(db: Queryable) {
  if (cachedColumns) return cachedColumns;

  const result = await db.query<{ column_name: string }>(
    `
      select column_name
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'audit_logs'
    `,
  );

  cachedColumns = new Set(result.rows.map((row) => row.column_name));
  return cachedColumns;
}

function push(columns: string[], values: unknown[], placeholders: string[], name: string, value: unknown) {
  columns.push(name);
  values.push(value);
  placeholders.push(`$${values.length}`);
}

export async function writeAuditLog(input: AuditInput, db: Queryable = pool) {
  try {
    const tableExists = await db.query<{ exists: boolean }>("select to_regclass('audit_logs') is not null as exists");
    if (!tableExists.rows[0]?.exists) return;

    const tableColumns = await getAuditColumns(db);
    const columns: string[] = [];
    const values: unknown[] = [];
    const placeholders: string[] = [];

    if (tableColumns.has('user_id')) push(columns, values, placeholders, 'user_id', input.userId ?? null);
    if (tableColumns.has('action')) push(columns, values, placeholders, 'action', input.action);
    if (tableColumns.has('created_at')) push(columns, values, placeholders, 'created_at', new Date());
    if (tableColumns.has('entity_type')) push(columns, values, placeholders, 'entity_type', input.entityType ?? null);
    if (tableColumns.has('entity')) push(columns, values, placeholders, 'entity', input.entityType ?? null);
    if (tableColumns.has('entity_id')) push(columns, values, placeholders, 'entity_id', input.entityId ?? null);
    if (tableColumns.has('metadata')) push(columns, values, placeholders, 'metadata', JSON.stringify(input.metadata ?? {}));
    if (tableColumns.has('details')) push(columns, values, placeholders, 'details', JSON.stringify(input.metadata ?? {}));

    if (!columns.includes('action')) return;

    await db.query(`insert into audit_logs (${columns.join(', ')}) values (${placeholders.join(', ')})`, values);
  } catch (error) {
    console.warn('audit log skipped', error instanceof Error ? error.message : error);
  }
}