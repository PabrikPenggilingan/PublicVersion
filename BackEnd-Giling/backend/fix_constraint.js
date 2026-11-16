require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

async function fix() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        await pool.query('ALTER TABLE trx.sale_returns DROP CONSTRAINT chk_return_amount_positive');
        console.log('Dropped constraint');
        await pool.query('ALTER TABLE trx.sale_returns ADD CONSTRAINT chk_return_amount_positive CHECK (amount_adjusted >= 0)');
        console.log('Added constraint back');
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
fix();
