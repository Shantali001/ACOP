const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.yvvxenphsotorklcsfpk:Amsaf%402026%40@aws-0-eu-west-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

client.connect();
client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name", (err, res) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  res.rows.forEach((r) => console.log(r.table_name));
  client.end();
});
