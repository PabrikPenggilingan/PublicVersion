const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://gabah_user:gabah_password@localhost:5432/gabah_db' });

async function clean() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('sys', 'trx')");

    const tablesToTruncate = [];
    for (const row of res.rows) {
      if (row.table_schema === 'trx') {
        tablesToTruncate.push(`${row.table_schema}."${row.table_name}"`);
      }
    }

    if (tablesToTruncate.length > 0) {
      const truncateQuery = `TRUNCATE TABLE ${tablesToTruncate.join(', ')} CASCADE`;
      console.log('Executing:', truncateQuery);
      await client.query(truncateQuery);
    }

    for (const row of res.rows) {
      if (row.table_schema === 'sys') {
        if (row.table_name === 'users') {
          console.log(`Deleting non-admin from sys.users...`);
          await client.query(`DELETE FROM sys.users WHERE username != 'admin'`);
        } else if (row.table_name === 'config') {
          console.log(`Skipping sys.config...`);
        } else {
          console.log(`Truncating ${row.table_schema}.${row.table_name}...`);
          await client.query(`TRUNCATE TABLE ${row.table_schema}."${row.table_name}" CASCADE`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('Successfully cleaned the database, kept admin user and config.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to clean DB', e);
  } finally {
    client.release();
    pool.end();
  }
}
clean();
