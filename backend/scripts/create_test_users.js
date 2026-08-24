// Creates temporary test users for local testing
require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const adminRes = await pool.query("INSERT INTO users (full_name,email,password_hash,role,status,created_at,updated_at) VALUES ('Test Admin','admin@local.test',crypt('AdminPass123!', gen_salt('bf')),'ADMIN','ACTIVE',now(),now()) RETURNING id");
    const agentRes = await pool.query("INSERT INTO users (full_name,email,password_hash,role,status,created_at,updated_at) VALUES ('Test Agent','agent@local.test',crypt('AgentPass123!', gen_salt('bf')),'AGENT','ACTIVE',now(),now()) RETURNING id");
    console.log('CREATED_ADMIN_ID', adminRes.rows[0].id);
    console.log('CREATED_AGENT_ID', agentRes.rows[0].id);
    console.log('Admin credentials: admin@local.test / AdminPass123!');
    console.log('Agent credentials: agent@local.test / AgentPass123!');
  } catch (err) {
    console.error('ERR', err.message);
  } finally {
    await pool.end();
  }
})();
