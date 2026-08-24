const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.yvvxenphsotorklcsfpk:Amsaf%402026%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

client.connect();
client.query(`
  select
    m.*,
    a.id as assigned_agent_id,
    u.full_name as assigned_agent_name
  from modems m
  left join agents a on a.assigned_modem_id = m.id
  left join users u on u.id = a.user_id
  order by coalesce(m.modem_name, m.id::text) asc
`, (err, res) => {
  if (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
  console.log('ROWS:', res.rows.length);
  console.log(JSON.stringify(res.rows, null, 2));
  client.end();
});
