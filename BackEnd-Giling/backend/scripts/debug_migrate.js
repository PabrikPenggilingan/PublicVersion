const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
        process.stdout.write(`Testing ${file}... `);
        try {
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await pool.query(sql);
            console.log('✅');
        } catch (e) {
            console.log('❌');
            console.error(`Error in ${file}:`, e.message);
            console.error(e);
            break;
        }
    }
    await pool.end();
}
test();
