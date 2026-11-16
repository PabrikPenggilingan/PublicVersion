const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  try {
    console.log('🚀 Running manual migration: 060_update_inventory_transaction_types.sql');
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/060_update_inventory_transaction_types.sql'), 'utf8');
    
    await pool.query('BEGIN');
    await pool.query(sql);
    
    // Record in history
    await pool.query(
      'INSERT INTO public.migrations_history (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
      ['060_update_inventory_transaction_types.sql']
    );
    
    await pool.query('COMMIT');
    console.log('✅ 060 completed successfully');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.log('❌ Failed:', err.message);
  } finally {
    await pool.end();
  }
}
migrate();
