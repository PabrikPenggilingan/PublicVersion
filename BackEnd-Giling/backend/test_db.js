const db = require('./src/config/database');
async function test() {
    const res = await db.query("SELECT id, status, product_category_code, total_weight_kg, remaining_weight_kg FROM trx.inventory_items WHERE product_category_code = 'GABAH_KERING'");
    console.log(res.rows);
    process.exit(0);
}
test();
