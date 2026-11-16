const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function check() {
  try {
    const { rows } = await pool.query('SELECT filename FROM public.migrations_history ORDER BY id DESC LIMIT 10');
    console.log('Last executed migrations:', rows.map(r => r.filename));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}
check();
