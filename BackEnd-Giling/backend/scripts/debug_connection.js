const env = require('../src/config/env');
const { Pool } = require('pg');

console.log('--- DATABASE CONFIGURATION ---');
console.log('DATABASE_URL:', env.database.url);
console.log('LOG_DATABASE_URL:', env.database.logUrl);
console.log('PORT:', env.port);
console.log('NODE_ENV:', env.nodeEnv);

const pool = new Pool({
  connectionString: env.database.url
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT current_database(), current_user, inet_server_port()');
    console.log('Connection Info:', res.rows[0]);

    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'trx' AND table_name = 'finance_transactions' AND column_name = 'status';
    `);
    console.log('status column in finance_transactions:', cols.rows);
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await pool.end();
  }
}

testConnection();
