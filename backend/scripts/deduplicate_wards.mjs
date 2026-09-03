import { config } from 'dotenv';
import { pool } from '../src/db/pool.js';

config();

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const duplicateWards = await client.query(`
      SELECT w.id, w.name, l.name AS lga_name, s.name AS state_name, COUNT(*) OVER (PARTITION BY w.name, w.lga_id) AS dup_count
      FROM wards w
      JOIN lgas l ON l.id = w.lga_id
      JOIN states s ON s.id = l.state_id
      WHERE w.name IS NOT NULL AND w.name <> ''
      ORDER BY w.lga_id, w.name, w.id
    `);

    const groups = new Map<string, typeof duplicateWards.rows>();
    for (const row of duplicateWards.rows) {
      const key = `${row.lga_name}|${row.name}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    let merged = 0;
    for (const [key, rows] of groups) {
      if (rows.length <= 1) continue;
      const [survivor, ...duplicates] = rows;
      console.log(`Merging ${duplicates.length} duplicate(s) for ward "${survivor.name}" in ${survivor.lga_name} -> keeping id=${survivor.id}`);

      for (const dup of duplicates) {
        await client.query('UPDATE polling_units SET ward_id = $1 WHERE ward_id = $2', [survivor.id, dup.id]);
        await client.query('DELETE FROM wards WHERE id = $1', [dup.id]);
        merged++;
      }
    }

    await client.query('COMMIT');
    console.log(`Deduplication complete. Merged ${merged} duplicate ward(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deduplication failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
