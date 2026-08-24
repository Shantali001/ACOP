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

const adminEmail = 'admin@acop.demo';
const agentEmails = ['agent1@acop.demo', 'agent2@acop.demo', 'agent3@acop.demo'];
const adminPassword = 'AdminPass123!';
const agentPassword = 'AgentPass123!';

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
      returning id
    `,
    [fullName, email, password, role],
  );
  return result.rows[0].id;
}

async function main() {
  const adminId = await upsertUser('Demo Admin', adminEmail, adminPassword, 'ADMIN');
  const agentIds = [];

  for (const [index, email] of agentEmails.entries()) {
    const userId = await upsertUser(`Demo Agent ${index + 1}`, email, agentPassword, 'AGENT');
    const agent = await pool.query(
      'insert into agents (user_id) values ($1) on conflict (user_id) do update set user_id = excluded.user_id returning id',
      [userId],
    );
    agentIds.push(agent.rows[0].id);
  }

  const campaign = await pool.query(
    `
      insert into campaigns (campaign_name, description, status, start_date, end_date)
      values ('Demo Campaign', 'Seeded campaign for ACOP demo/testing.', 'ACTIVE', current_date, current_date + interval '30 days')
      on conflict do nothing
      returning id
    `,
  );
  const campaignId = campaign.rows[0]?.id ?? (await pool.query("select id from campaigns where campaign_name = 'Demo Campaign' limit 1")).rows[0].id;

  const customerIds = [];
  for (let index = 1; index <= 20; index += 1) {
    const phone = `0803000${String(index).padStart(4, '0')}`;
    const existingCustomer = await pool.query('select id from customers where phone_number = $1 limit 1', [phone]);
    const customer = existingCustomer.rows[0]
      ? await pool.query(
        `
          update customers
          set full_name = $1,
              ward = $3,
              polling_unit = $4,
              lga = 'Demo LGA',
              state = 'Demo State'
          where id = $2
          returning id
        `,
        [`Demo Customer ${index}`, existingCustomer.rows[0].id, `Ward ${((index - 1) % 5) + 1}`, `PU ${index}`],
      )
      : await pool.query(
        `
          insert into customers (full_name, phone_number, ward, polling_unit, lga, state, gender)
          values ($1, $2, $3, $4, 'Demo LGA', 'Demo State', 'UNKNOWN')
          returning id
        `,
        [`Demo Customer ${index}`, phone, `Ward ${((index - 1) % 5) + 1}`, `PU ${index}`],
      );
    customerIds.push(customer.rows[0].id);
    await pool.query('insert into campaign_members (campaign_id, customer_id) values ($1, $2) on conflict do nothing', [campaignId, customer.rows[0].id]);
  }

  for (const [index, customerId] of customerIds.entries()) {
    const agentId = agentIds[index % agentIds.length];
    await pool.query(
      `
        insert into customer_assignments (campaign_id, customer_id, agent_id, assigned_by, assignment_status)
        values ($1, $2, $3, $4, 'ACTIVE')
        on conflict do nothing
      `,
      [campaignId, customerId, agentId, adminId],
    );
  }

  console.log('Seed complete.');
  console.log(`Admin: ${adminEmail} / ${adminPassword} (${adminId})`);
  console.log(`Agents: ${agentEmails.join(', ')} / ${agentPassword}`);
  console.log(`Campaign ID: ${campaignId}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


