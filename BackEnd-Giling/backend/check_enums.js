const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.lyicozrmdmizqacoiwwd:cH5YkoEGpNHxmrd1@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres' });
client.connect().then(async () => {
    try {
        const res = await client.query(`
            SELECT unnest(enum_range(NULL::file_type_enum)) AS file_type,
                   unnest(enum_range(NULL::sale_type_enum)) AS sale_type;
        `);
        console.log(res.rows);
    } catch(err) {
        console.log('Error:', err.message);
    }
    client.end();
});
