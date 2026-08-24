const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.yvvxenphsotorklcsfpk:Amsaf%402026%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

client.connect();
client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'modems' ORDER BY ordinal_position", (err, res) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  res.rows.forEach((r) => console.log(`${r.column_name} (${r.data_type})`));
  client.end();
});
