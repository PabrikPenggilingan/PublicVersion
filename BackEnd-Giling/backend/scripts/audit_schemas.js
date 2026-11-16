/**
 * Compact schema audit - writes clean one-line-per-entry output
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
    const { rows } = await pool.query(`
        SELECT table_schema AS s, table_type AS t, table_name AS n
        FROM information_schema.tables
        WHERE table_schema IN ('public','trx','log','mst','sys')
        ORDER BY table_schema, table_type DESC, table_name
    `);

    const publicTables = rows.filter(r => r.s === 'public' && r.t === 'BASE TABLE');
    const publicViews = rows.filter(r => r.s === 'public' && r.t === 'VIEW');
    const trxTables = rows.filter(r => r.s === 'trx');
    const logTables = rows.filter(r => r.s === 'log');
    const mstTables = rows.filter(r => r.s === 'mst');
    const sysTables = rows.filter(r => r.s === 'sys');

    console.log('\n=== SCHEMA AUDIT RESULT ===');
    console.log('\n[public] BASE TABLES (should be 0):');
    if (publicTables.length === 0) console.log('  ✅ NONE - All tables migrated!');
    else publicTables.forEach(r => console.log('  ❌ ' + r.n));

    console.log('\n[public] VIEWS (bridges):');
    publicViews.forEach(r => console.log('  ◦ ' + r.n));

    console.log('\n[trx] BASE TABLES (' + trxTables.length + '):');
    trxTables.forEach(r => console.log('  • ' + r.n));

    console.log('\n[log] BASE TABLES (' + logTables.length + '):');
    logTables.forEach(r => console.log('  • ' + r.n));

    console.log('\n[mst] BASE TABLES (' + mstTables.length + '):');
    mstTables.forEach(r => console.log('  • ' + r.n));

    console.log('\n[sys] BASE TABLES (' + sysTables.length + '):');
    sysTables.forEach(r => console.log('  • ' + r.n));

    await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
