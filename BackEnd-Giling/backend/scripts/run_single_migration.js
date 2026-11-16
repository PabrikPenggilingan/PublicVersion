/**
 * Run a single migration file directly.
 * Usage: node scripts/run_single_migration.js <filename>
 * Example: node scripts/run_single_migration.js 034_enterprise_schemas_and_item_categories.sql
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load .env
const envPath = path.join(__dirname, '../../.env');
require('dotenv').config({ path: envPath });

if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found. Check .env path:', envPath);
    process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
    const fileName = process.argv[2];
    if (!fileName) {
        console.error('❌ Please supply a migration filename as an argument.');
        process.exit(1);
    }

    const filePath = path.join(__dirname, '../migrations', fileName);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`\n🚀 Running migration: ${fileName}\n`);

    try {
        await pool.query(sql);
        console.log(`✅ Migration '${fileName}' completed successfully!\n`);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        console.error('\nFull error:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
