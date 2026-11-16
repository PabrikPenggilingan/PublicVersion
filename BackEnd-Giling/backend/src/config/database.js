const { Pool } = require('pg');
const config = require('./env');

// Main database connection pool
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.url && (config.database.url.includes('localhost') || config.database.url.includes('postgres:5432') || config.database.url.includes('db:5432')) ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  query_timeout: 20000,
  statement_timeout: 20000,
});

// Log database connection pool
const logPoolUrl = config.database.logUrl || config.database.url;
const logPool = new Pool({
  connectionString: logPoolUrl,
  ssl: logPoolUrl && (logPoolUrl.includes('localhost') || logPoolUrl.includes('postgres:5432') || logPoolUrl.includes('db:5432')) ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
  statement_timeout: 10000,
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to main database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on main database client', err);
  process.exit(-1);
});

logPool.on('connect', () => {
  console.log('Connected to log database');
});

logPool.on('error', (err) => {
  console.error('Unexpected error on log database client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
  pool,
  logQuery: (text, params) => logPool.query(text, params),
  getLogClient: () => logPool.connect(),
  logPool
};
