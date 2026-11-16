const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/aerp' });
client.connect().then(async () => {
    try {
        await client.query('BEGIN');
        const res = await client.query(`
            INSERT INTO trx.files (sale_id, sale_type, file_type, r2_key, original_name, mime_type, size_bytes)
            VALUES (null, 'jual', 'retur', 'test', 'test.jpg', 'image/jpeg', 100)
            RETURNING *
        `);
        console.log('Success:', res.rows);
        await client.query('ROLLBACK');
    } catch(err) {
        console.log('Error:', err.message);
    }
    client.end();
});
