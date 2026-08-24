/* eslint-disable no-console */
import dotenv from 'dotenv';
import pg from 'pg';

const { Pool } = pg;
dotenv.config({ path: './backend/.env' });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

async function upsertUser(fullName, email, password, role) {
  const result = await pool.query(
    `
      insert into users (full_name, email, password_hash, role, status, created_at, updated_at)
      values ($1, $2, crypt($3, gen_salt('bf')), $4, 'ACTIVE', now(), now())
      on conflict (email) do update
      set full_name = excluded.full_name,
          password_hash = excluded.password_hash,
          role = excluded.role,
          status = 'ACTIVE',
          updated_at = now()
      returning id, full_name, email, role, status
    `,
    [fullName, email, password, role],
  );
  return result.rows[0];
}

async function createAdmin() {
  const fullName = 'Real Admin';
  const email = 'realadmin@example.com';
  const password = 'RealAdmin123!';

  const user = await upsertUser(fullName, email, password, 'ADMIN');
  console.log('Admin created/updated:');
  console.log(`  ID: ${user.id}`);
  console.log(`  Name: ${user.full_name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log('');
}

async function createAgent() {
  const fullName = 'Real Agent';
  const email = 'realagent@example.com';
  const password = 'RealAgent123!';

  const user = await upsertUser(fullName, email, password, 'AGENT');
  const agentResult = await pool.query(
    'insert into agents (user_id) values ($1) on conflict (user_id) do update set user_id = excluded.user_id returning id',
    [user.id],
  );
  console.log('Agent created/updated:');
  console.log(`  ID: ${agentResult.rows[0].id}`);
  console.log(`  User ID: ${user.id}`);
  console.log(`  Name: ${user.full_name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log('');
}

async function createCustomer() {
  const fullName = 'Real Customer';
  const phoneNumber = '08012345678';
  const ward = 'Ward 1';
  const pollingUnit = 'PU 1';
  const lga = 'Demo LGA';
  const state = 'Demo State';
  const gender = 'UNKNOWN';

  const existingCustomer = await pool.query('select id from customers where phone_number = $1 limit 1', [phoneNumber]);
  const customer = existingCustomer.rows[0]
    ? await pool.query(
        `
          update customers
          set full_name = $1,
              ward = $3,
              polling_unit = $4,
              lga = $5,
              state = $6,
              gender = $7
          where id = $2
          returning id, full_name, phone_number, ward, polling_unit, lga, state, gender
        `,
        [fullName, existingCustomer.rows[0].id, ward, pollingUnit, lga, state, gender],
      )
    : await pool.query(
        `
          insert into customers (full_name, phone_number, ward, polling_unit, lga, state, gender)
          values ($1, $2, $3, $4, $5, $6, $7)
          returning id, full_name, phone_number, ward, polling_unit, lga, state, gender
        `,
        [fullName, phoneNumber, ward, pollingUnit, lga, state, gender],
      );

  const result = customer.rows[0];
  console.log('Customer created/updated:');
  console.log(`  ID: ${result.id}`);
  console.log(`  Name: ${result.full_name}`);
  console.log(`  Phone: ${result.phone_number}`);
  console.log(`  Ward: ${result.ward}`);
  console.log(`  Polling Unit: ${result.polling_unit}`);
  console.log(`  LGA: ${result.lga}`);
  console.log(`  State: ${result.state}`);
  console.log('');
}

async function main() {
  await createAdmin();
  await createAgent();
  await createCustomer();
  console.log('All real users created successfully.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
