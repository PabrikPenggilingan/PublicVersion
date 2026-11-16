require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        await pool.query("UPDATE trx.sales SET status = 'CONFIRMED' WHERE sale_no = 'JUAL/2026/09/036'");
        console.log("Fixed sale status for JUAL/2026/09/036");
    } finally {
        await pool.end();
    }
}
run();
