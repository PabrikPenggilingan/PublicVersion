const db = require('./src/config/database');
const fs = require('fs');

async function checkCategories() {
    try {
        const result = await db.query('SELECT DISTINCT product_category_code FROM mst.inventory_items');
        fs.writeFileSync('output.txt', JSON.stringify(result.rows, null, 2));
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('output.txt', e.toString());
        process.exit(1);
    }
}

checkCategories();
