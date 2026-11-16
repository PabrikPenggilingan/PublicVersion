require('dotenv').config({ path: '../.env' });
const db = require('../src/config/database');

async function run() {
  try {
    console.log('Adding jenis_gabah to trx.batches...');
    await db.query(`
      ALTER TABLE trx.batches ADD COLUMN IF NOT EXISTS jenis_gabah VARCHAR(50);
    `);
    
    // Set default value for existing open batches where it's null (e.g. IR64)
    await db.query(`
      UPDATE trx.batches SET jenis_gabah = 'IR64' WHERE jenis_gabah IS NULL;
    `);

    console.log('Success!');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();
