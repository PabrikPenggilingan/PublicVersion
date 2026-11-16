const db = require('../src/config/database');
const crypto = require('crypto');

async function test() {
    try {
        // Find existing open batch or create one
        let batchRes = await db.query("SELECT id FROM trx.batches WHERE status = 'OPEN' LIMIT 1");
        let batchId;
        if (batchRes.rows.length === 0) {
            batchRes = await db.query("INSERT INTO trx.batches (batch_date, created_by) VALUES (CURRENT_DATE, (SELECT id FROM sys.users LIMIT 1)) RETURNING id");
        }
        batchId = batchRes.rows[0].id;

        const genCode = () => {
            const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            return Array.from({length: 6}, () => c[Math.floor(Math.random()*c.length)]).join('');
        };
        const linkCode = genCode();
        
        await db.query(`INSERT INTO trx.batch_links (batch_id, link_code, form_type, is_active, created_by) VALUES ($1, $2, 'PURCHASE', true, (SELECT id FROM sys.users LIMIT 1))`, [batchId, linkCode]);

        console.log("LINK:", linkCode);
        process.exit(0);
    } catch(e) {
        console.error(e);
        process.exit(1);
    }
}
test();
