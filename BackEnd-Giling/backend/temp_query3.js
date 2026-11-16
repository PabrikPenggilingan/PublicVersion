const db = require('./src/config/database');
async function run() {
    const res = await db.query("SELECT id, category_code, status, is_titipan FROM trx.inventory_items WHERE id='355f386a-dd9d-4bee-bebc-1b18a9cc52f8'");
    console.log(res.rows[0]);
    process.exit(0);
}
run();
