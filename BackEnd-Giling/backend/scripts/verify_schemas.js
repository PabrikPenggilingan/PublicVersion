/**
 * Schema verification script (uses same .env path as migrate.js)
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const checks = [
    { schema: 'log', name: 'activity', type: 'BASE TABLE' },
    { schema: 'trx', name: 'inventory_items', type: 'BASE TABLE' },
    { schema: 'trx', name: 'inventory_sacks', type: 'BASE TABLE' },
    { schema: 'trx', name: 'inventory_transactions', type: 'BASE TABLE' },
    { schema: 'trx', name: 'drying_sessions', type: 'BASE TABLE' },
    { schema: 'trx', name: 'drying_batches', type: 'BASE TABLE' },
    { schema: 'trx', name: 'drying_links', type: 'BASE TABLE' },
    { schema: 'trx', name: 'drying_photos', type: 'BASE TABLE' },
    { schema: 'mst', name: 'item_categories', type: 'BASE TABLE' },
    { schema: 'sys', name: 'config', type: 'BASE TABLE' },
    { schema: 'public', name: 'log_history', type: 'VIEW' },
    { schema: 'public', name: 'inventory_items', type: 'VIEW' },
    { schema: 'public', name: 'inventory_sacks', type: 'VIEW' },
    { schema: 'public', name: 'inventory_transactions', type: 'VIEW' },
    { schema: 'public', name: 'drying_sessions', type: 'VIEW' },
    { schema: 'public', name: 'drying_batches', type: 'VIEW' },
    { schema: 'public', name: 'drying_links', type: 'VIEW' },
    { schema: 'public', name: 'drying_photos', type: 'VIEW' },
];

(async () => {
    console.log('\n🔍 Schema Verification\n' + '='.repeat(50));
    let allOk = true;
    for (const c of checks) {
        const { rows } = await pool.query(
            `SELECT table_type FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2`,
            [c.schema, c.name]
        );
        const ok = rows[0]?.table_type === c.type;
        if (!ok) allOk = false;
        console.log(`${ok ? '✅' : '❌'} ${c.schema}.${c.name} [${c.type}]${!ok ? ' → GOT: ' + (rows[0]?.table_type || 'NOT FOUND') : ''}`);
    }
    await pool.end();
    console.log('\n' + (allOk ? '🎉 All checks passed!' : '💥 Some checks failed.'));
    if (!allOk) process.exit(1);
})();
