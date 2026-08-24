import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { Pool } from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;
const shouldRun = Boolean(databaseUrl);
const describeIntegration = shouldRun ? describe : describe.skip;
const apiBaseUrl = process.env.TEST_API_BASE_URL ?? 'http://127.0.0.1:4010';

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

describeIntegration('ACOP integration smoke flows', () => {
  let server;
  let pool;
  let adminToken;
  let agentToken;
  let agentId;
  let campaignId;
  let customerIds = [];

  before(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'integration-test-secret-that-is-long-enough';
    process.env.DATABASE_SSL = process.env.TEST_DATABASE_SSL ?? 'false';
    process.env.VERIFY_DB_ON_STARTUP = 'false';
    process.env.MODEM_DRIVER = 'mock';

    const { app } = await import('../src/app.js');
    server = app.listen(4010);
    pool = new Pool({ connectionString: databaseUrl, ssl: process.env.TEST_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined });

    const suffix = randomUUID().slice(0, 8);
    const admin = await pool.query(
      "insert into users (full_name, email, password_hash, role, status, created_at, updated_at) values ($1, $2, crypt($3, gen_salt('bf')), 'ADMIN', 'ACTIVE', now(), now()) returning id, email",
      [`Test Admin ${suffix}`, `admin-${suffix}@local.test`, 'AdminPass123!'],
    );
    const agentUser = await pool.query(
      "insert into users (full_name, email, password_hash, role, status, created_at, updated_at) values ($1, $2, crypt($3, gen_salt('bf')), 'AGENT', 'ACTIVE', now(), now()) returning id, email",
      [`Test Agent ${suffix}`, `agent-${suffix}@local.test`, 'AgentPass123!'],
    );
    const agent = await pool.query('insert into agents (user_id) values ($1) returning id', [agentUser.rows[0].id]);
    agentId = agent.rows[0].id;

    const campaign = await pool.query("insert into campaigns (campaign_name, description, status, start_date) values ($1, 'Integration test campaign', 'ACTIVE', current_date) returning id", [`Integration ${suffix}`]);
    campaignId = campaign.rows[0].id;

    for (let index = 0; index < 3; index += 1) {
      const customer = await pool.query(
        "insert into customers (full_name, phone_number, ward, polling_unit, lga, state, gender) values ($1, $2, 'Ward A', 'PU A', 'LGA A', 'State A', 'UNKNOWN') returning id",
        [`Queue Customer ${suffix}-${index}`, `0800000${suffix.slice(0, 3)}${index}`],
      );
      customerIds.push(customer.rows[0].id);
      await pool.query('insert into campaign_members (campaign_id, customer_id) values ($1, $2) on conflict do nothing', [campaignId, customer.rows[0].id]);
    }

    const adminLogin = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: admin.rows[0].email, password: 'AdminPass123!' }) });
    assert.equal(adminLogin.response.status, 200);
    adminToken = adminLogin.body.token;

    const agentLogin = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: agentUser.rows[0].email, password: 'AgentPass123!' }) });
    assert.equal(agentLogin.response.status, 200);
    agentToken = agentLogin.body.token;
  });

  after(async () => {
    await pool?.end();
    await new Promise((resolve) => server?.close(resolve));
  });

  it('logs in with seeded admin credentials', async () => {
    assert.ok(adminToken);
  });

  it('assigns customers to an agent in bulk', async () => {
    const result = await request('/assignments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ campaignId, agentId, customerIds }),
    });
    assert.equal(result.response.status, 201);
    assert.equal(result.body.assigned, 3);
  });

  it('loads next customer, saves call, then loads the next assignment', async () => {
    const first = await request('/agent/next-customer', { headers: { Authorization: `Bearer ${agentToken}` } });
    assert.equal(first.response.status, 200);
    assert.ok(first.body.customer?.assignmentId);

    const saved = await request('/agent/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: JSON.stringify({ assignmentId: first.body.customer.assignmentId, outcome: 'ANSWERED_SUPPORTS', notes: 'Integration note', durationSeconds: 4 }),
    });
    assert.equal(saved.response.status, 201);
    assert.notEqual(saved.body.customer?.assignmentId, first.body.customer.assignmentId);
  });

  it('eventually returns the completion screen state when queue is exhausted', async () => {
    for (;;) {
      const next = await request('/agent/next-customer', { headers: { Authorization: `Bearer ${agentToken}` } });
      if (!next.body.customer) {
        assert.equal(next.body.summary.remaining, 0);
        break;
      }

      const saved = await request('/agent/calls', {
        method: 'POST',
        headers: { Authorization: `Bearer ${agentToken}` },
        body: JSON.stringify({ assignmentId: next.body.customer.assignmentId, outcome: 'NO_ANSWER', notes: '', durationSeconds: 1 }),
      });
      assert.equal(saved.response.status, 201);
    }
  });
});



