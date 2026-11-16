const db = require('./src/config/database');
async function run() {
    const res = await db.query('SELECT code FROM mst.item_categories');
    console.log('Categories:', res.rows.map(r => r.code));
    process.exit(0);
}
run();
