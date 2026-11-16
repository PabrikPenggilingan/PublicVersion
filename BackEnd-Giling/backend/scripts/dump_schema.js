const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema='trx' AND table_name='inventory_items'
`).then(res => {
    console.table(res.rows);
    pool.end();
}).catch(console.error);
