require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const res = await pool.query("SELECT tgname, tgfoid::regproc FROM pg_trigger WHERE tgrelid = 'trx.sale_items'::regclass;");
        console.log(res.rows);
    } finally {
        await pool.end();
    }
}
run();
