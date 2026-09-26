import { config } from 'dotenv';

import { pool } from '../dist/db/pool.js';

config();

const sourceBaseUrl = 'https://raw.githubusercontent.com/saidiadegoke/nigeria-inec-geo/main/data';

async function getJson(name) {
  const response = await fetch(`${sourceBaseUrl}/${name}`);
  if (!response.ok) throw new Error(`Could not download ${name}: ${response.status}`);
  return response.json();
}

function codeOf(row, field) {
  const value = row[field] ?? row[`${field}_code`];
  return value == null ? '' : String(value).padStart(2, '0');
}

async function findOrCreateState(client, name) {
  await client.query(
    `insert into states (name)
     select $1
     where not exists (
       select 1 from states where lower(trim(name)) = lower(trim($1))
     )`,
    [name],
  );
  const result = await client.query(
    'select id from states where lower(trim(name)) = lower(trim($1)) limit 1',
    [name],
  );
  return result.rows[0].id;
}

async function findOrCreateLga(client, stateId, name) {
  await client.query(
    `insert into lgas (name, state_id)
     select $1, $2
     where not exists (
       select 1 from lgas
       where state_id = $2 and lower(trim(name)) = lower(trim($1))
     )`,
    [name, stateId],
  );
  const result = await client.query(
    `select id from lgas
     where state_id = $2 and lower(trim(name)) = lower(trim($1))
     limit 1`,
    [name, stateId],
  );
  return result.rows[0].id;
}

async function main() {
  const [states, lgas, wards] = await Promise.all([
    getJson('states.json'),
    getJson('lgas.json'),
    getJson('wards.json'),
  ]);

  if (states.length !== 37 || lgas.length !== 774 || wards.length !== 8809) {
    throw new Error(`Unexpected INEC data counts: ${states.length} states, ${lgas.length} LGAs, ${wards.length} wards.`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      create table if not exists states (
        id serial primary key,
        name text not null unique
      );
      create table if not exists lgas (
        id serial primary key,
        name text not null,
        state_id integer not null references states(id) on delete cascade,
        unique (name, state_id)
      );
      create table if not exists wards (
        id serial primary key,
        name text not null,
        lga_id integer not null references lgas(id) on delete cascade,
        unique (name, lga_id)
      );
    `);

    const stateIds = new Map();
    for (const state of states) {
      stateIds.set(codeOf(state, 'code'), await findOrCreateState(client, state.name));
    }

    const lgaIds = new Map();
    for (const lga of lgas) {
      const stateCode = codeOf(lga, 'state');
      const stateId = stateIds.get(stateCode);
      if (!stateId) throw new Error(`Missing state for LGA ${lga.name}.`);
      const lgaId = await findOrCreateLga(client, stateId, lga.name);
      lgaIds.set(`${stateCode}/${codeOf(lga, 'code')}`, lgaId);
    }

    for (const ward of wards) {
      const stateCode = codeOf(ward, 'state');
      const lgaId = lgaIds.get(`${stateCode}/${codeOf(ward, 'lga')}`);
      if (!lgaId) throw new Error(`Missing LGA for ward ${ward.name}.`);
      await client.query(
        `insert into wards (name, lga_id)
         select $1, $2
         where not exists (
           select 1 from wards
           where lga_id = $2 and lower(trim(name)) = lower(trim($1))
         )`,
        [ward.name, lgaId],
      );
    }

    await client.query('COMMIT');
    console.log(`Imported ${states.length} states, ${lgas.length} LGAs, and ${wards.length} INEC wards.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
