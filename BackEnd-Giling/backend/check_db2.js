require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        const res = await pool.query(`
            SELECT p.proname, p.prosrc 
            FROM pg_proc p 
            WHERE p.proname IN ('check_sale_item_qty', 'sync_sale_subtotal', 'sync_sale_delivery_status')
        `);
        console.log(res.rows);
    } finally {
        await pool.end();
    }
}
run();
