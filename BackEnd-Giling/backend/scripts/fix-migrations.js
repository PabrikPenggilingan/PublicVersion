const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://postgres:12345678@localhost:5432/gabah_db';

const pool = new Pool({
  connectionString: DATABASE_URL
});

async function run() {
  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  // Ensure history table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.migrations_history (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // Get executed migrations
  const { rows } = await pool.query('SELECT filename FROM public.migrations_history');
  const executedFiles = new Set(rows.map(r => r.filename));

  // Also check if tables already exist to mark existing migrations as done
  // (Simplified: if customer_tiers exists, 044 is done)
  const { rows: tableRows } = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname IN ('mst', 'trx', 'sys', 'public')");
  const existingTables = new Set(tableRows.map(r => r.tablename));

  for (const file of files) {
    const num = parseInt(file.split('_')[0]);
    
    // Logic to skip already done or partially done migrations
    if (executedFiles.has(file)) continue;

    // Hardcoded check for existing tables to skip errors
    if (num === 1 && existingTables.has('users')) {
       await pool.query('INSERT INTO public.migrations_history (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
       continue;
    }
    if (num === 44 && existingTables.has('customer_tiers')) {
       await pool.query('INSERT INTO public.migrations_history (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
       continue;
    }

    console.log(`🚀 Running: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO public.migrations_history (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`✅ ${file} OK`);
    } catch (err) {
      await pool.query('ROLLBACK');
      if (err.message.includes('already exists')) {
        console.log(`⚠️ ${file} already exists, marking as done`);
        await pool.query('INSERT INTO public.migrations_history (filename) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
      } else {
        console.error(`❌ ${file} FAILED:`, err.message);
        // Don't exit, try next one as some might be partially applied
      }
    }
  }
  
  await pool.end();
}

run();
