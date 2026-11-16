const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.lyicozrmdmizqacoiwwd:cH5YkoEGpNHxmrd1@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    try {
        const res = await client.query(`
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'files' AND table_schema = 'trx';
        `);
        console.log(res.rows);
    } catch(err) {
        console.log('Error:', err.message);
    }
    client.end();
});
