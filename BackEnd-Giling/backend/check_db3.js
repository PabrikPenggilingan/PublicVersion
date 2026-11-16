require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const sales = await pool.query("SELECT id, sale_no, status, total_amount, paid_amount, payment_status FROM trx.sales WHERE sale_no = 'JUAL/2026/09/036'");
        console.table(sales.rows);
    } finally {
        await pool.end();
    }
}
run();
