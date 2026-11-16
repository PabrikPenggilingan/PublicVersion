const db = require('./backend/src/config/database');
async function run() {
    try {
        const res1 = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'trx' AND table_name = 'inventory_items'");
        console.log("trx.inventory_items columns:", res1.rows.map(r=>r.column_name).join(', '));
        
        const res2 = await db.query("SELECT id, status, name FROM trx.drying_processes LIMIT 5");
        console.log("drying_processes samples:", res2.rows);

        const res3 = await db.query("SELECT id, status, remaining_weight_kg, reserved_weight_kg FROM trx.inventory_items LIMIT 5");
        console.log("inventory_items samples:", res3.rows);
    } catch(e) { console.error(e) }
    process.exit();
}
run();
