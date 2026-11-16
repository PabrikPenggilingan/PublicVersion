const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function check() {
  const { rows } = await pool.query("SELECT count(*) FROM public.migrations_history WHERE filename = '002_create_batches.sql'");
  console.log('Count:', rows[0].count);
  await pool.end();
}
check();
