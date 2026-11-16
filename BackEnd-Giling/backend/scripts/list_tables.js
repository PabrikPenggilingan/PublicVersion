const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://gabah_user:gabah_password@localhost:5432/gabah_db' });

async function check() {
  const res = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('sys', 'trx')");
  console.log(res.rows);
  pool.end();
}
check();
