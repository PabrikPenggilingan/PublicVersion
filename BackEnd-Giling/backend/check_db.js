require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        console.log("--- INVENTORY ITEMS ---");
        const inv = await pool.query("SELECT id, product_category_code, remaining_weight_kg, status FROM trx.inventory_items ORDER BY created_at DESC LIMIT 5");
        console.table(inv.rows);

        console.log("--- SALES ---");
        const sales = await pool.query("SELECT id, sale_no, status, total_amount FROM trx.sales ORDER BY created_at DESC LIMIT 2");
        console.table(sales.rows);

        if (sales.rows.length > 0) {
            const saleId = sales.rows[0].id;
            console.log("--- SALE ITEMS ---");
            const si = await pool.query("SELECT id, inventory_item_id, qty_ordered, qty_delivered FROM trx.sale_items WHERE sale_id = $1", [saleId]);
            console.table(si.rows);

            console.log("--- SALE RETURNS ---");
            const sr = await pool.query("SELECT * FROM trx.sale_returns WHERE sale_id = $1", [saleId]);
            console.table(sr.rows);
        }
    } finally {
        await pool.end();
    }
}
run();
