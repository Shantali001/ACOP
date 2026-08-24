// API test script for admin and agent auth and customer operations
require('dotenv').config({ path: './.env' });
const fetch = globalThis.fetch ?? require('node-fetch');

const adminUser = { email: 'admin@local.test', password: 'AdminPass123!' };
const agentUser = { email: 'agent@local.test', password: 'AgentPass123!' };

async function login(user) {
  const res = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  return { status: res.status, body: await res.json() };
}

async function apiRequest(path, method, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`http://localhost:4000${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch (e) {}
  return { status: res.status, body: parsed };
}

(async () => {
  const adminLogin = await login(adminUser);
  const agentLogin = await login(agentUser);
  console.log('adminLogin', adminLogin.status, adminLogin.body.user?.email);
  console.log('agentLogin', agentLogin.status, agentLogin.body.user?.email);
  const adminToken = adminLogin.body.token;
  const agentToken = agentLogin.body.token;
  if (!adminToken || !agentToken) {
    console.error('Login failed', adminLogin, agentLogin);
    process.exit(1);
  }
  const adminCreate = await apiRequest('/customers', 'POST', adminToken, {
    fullName: 'Alice Example',
    phoneNumber: '+2348012345678',
    ward: 'Ward 1',
    pollingUnit: 'Unit A',
    lga: 'Test LGA',
    state: 'Test State',
    gender: 'Female',
  });
  console.log('adminCreate', adminCreate.status, adminCreate.body.id ? 'created' : adminCreate.body);
  const agentCreate = await apiRequest('/customers', 'POST', agentToken, {
    fullName: 'Bob Example',
    phoneNumber: '+2348098765432',
    ward: 'Ward 2',
    pollingUnit: 'Unit B',
    lga: 'Test LGA',
    state: 'Test State',
    gender: 'Male',
  });
  console.log('agentCreate', agentCreate.status, agentCreate.body);
  const list = await apiRequest('/customers?search=Alice&page=1&pageSize=10', 'GET', adminToken);
  console.log('adminList', list.status, list.body.data?.length, 'total', list.body.total);
})();
