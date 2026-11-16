const db = require('./src/config/database');
async function test() {
    const res = await db.query("UPDATE trx.batches b SET status = 'CLOSED' WHERE EXISTS (SELECT 1 FROM trx.drying_batches db2 WHERE db2.batch_id = b.id) RETURNING *");
    console.log(res.rows.length + ' batches closed');
    process.exit(0);
}
test();
