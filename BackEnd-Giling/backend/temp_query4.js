const db = require('./src/config/database');
async function run() {
    const res = await db.query("SELECT * FROM trx.finance_transactions WHERE status='PENDING'");
    console.log(res.rows);
    process.exit(0);
}
run();
