const db = require('../src/config/database');
(async () => {
    try {
        const res = await db.query(`SELECT * FROM trx.batches ORDER BY created_at DESC LIMIT 3`);
        const res2 = await db.query(`SELECT * FROM trx.purchases ORDER BY created_at DESC LIMIT 3`);
        require('fs').writeFileSync('output.json', JSON.stringify({batches: res.rows, purchases: res2.rows}, null, 2));
        console.log("Saved to output.json");
    } catch(e) { console.error(e); } finally { process.exit(); }
})();
