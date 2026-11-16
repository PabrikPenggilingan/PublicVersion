const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Try multiple .env locations
const envLocations = [
  path.join(__dirname, '../../.env'),   
  path.join(__dirname, '../.env'),      
  path.join(process.cwd(), '.env'),
];
for (const envPath of envLocations) {
  const result = require('dotenv').config({ path: envPath });
  if (!result.error) break;
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('postgres:5432') || process.env.DATABASE_URL.includes('db:5432') ? false : { rejectUnauthorized: false }
});

const logPool = new Pool({
  connectionString: process.env.LOG_DATABASE_URL || process.env.DATABASE_URL,
  ssl: (process.env.LOG_DATABASE_URL || process.env.DATABASE_URL).includes('localhost') || (process.env.LOG_DATABASE_URL || process.env.DATABASE_URL).includes('postgres:5432') || (process.env.LOG_DATABASE_URL || process.env.DATABASE_URL).includes('db:5432') ? false : { rejectUnauthorized: false }
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '../migrations');
  
  try {
    // 1. Ensure migrations table exists in main DB
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.migrations_history (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Get all migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files`);

    // 3. Get already executed migrations
    const { rows } = await pool.query('SELECT filename FROM public.migrations_history');
    const executedFiles = new Set(rows.map(r => r.filename));

    // 4. Run pending migrations
    for (const file of files) {
      if (executedFiles.has(file)) {
        // console.log(`⏩ Skipping ${file} (already executed)`);
        continue;
      }

      console.log(`🚀 Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      const targetPool = file.includes('log_history') ? logPool : pool;
      
      try {
        await targetPool.query('BEGIN');
        await targetPool.query(sql);
        
        // Record in history (always in main pool)
        await pool.query(
          'INSERT INTO public.migrations_history (filename) VALUES ($1)',
          [file]
        );
        
        await targetPool.query('COMMIT');
        console.log(`✅ ${file} completed\n`);
      } catch (err) {
        await targetPool.query('ROLLBACK');
        throw err;
      }
    }

    console.log('✨ All pending migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
    await logPool.end();
  }
}

runMigrations();