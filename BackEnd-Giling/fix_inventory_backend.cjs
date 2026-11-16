const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'models', 'inventoryItem.model.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace getCategoryStats
const getCategoryStatsOld = `    async getCategoryStats() {
        const result = await db.query(
            \`SELECT
               cat.code,
               cat.name,
               cat.color_hex,
               cat.icon,
               COUNT(ii.id)                              as item_count,
               COALESCE(SUM(ii.remaining_weight_kg), 0)  as total_remaining_kg,
               COALESCE(SUM(ii.remaining_sacks), 0)      as total_remaining_sacks
             FROM mst.item_categories cat
             LEFT JOIN trx.inventory_items ii
               ON cat.code = ii.product_category_code AND ii.status != 'DEPLETED'
             WHERE cat.is_active = true
             GROUP BY cat.code, cat.name, cat.color_hex, cat.icon, cat.sort_order
             ORDER BY cat.sort_order ASC\`
        );
        return result.rows;
    },`;

const getCategoryStatsNew = `    async getCategoryStats() {
        const store = requestContext.getStore();
        const ctxUser = store?.user;
        let query = \`
             SELECT
               cat.code,
               cat.name,
               cat.color_hex,
               cat.icon,
               COUNT(ii.id)                              as item_count,
               COALESCE(SUM(ii.remaining_weight_kg), 0)  as total_remaining_kg,
               COALESCE(SUM(ii.remaining_sacks), 0)      as total_remaining_sacks
             FROM mst.item_categories cat
             LEFT JOIN trx.inventory_items ii
               ON cat.code = ii.product_category_code AND ii.status != 'DEPLETED'\`;

        const params = [];
        if (ctxUser && ctxUser.role !== 'admin') {
            query += \` AND ii.created_by = $1\`;
            params.push(ctxUser.id);
        }

        query += \`
             WHERE cat.is_active = true
             GROUP BY cat.code, cat.name, cat.color_hex, cat.icon, cat.sort_order
             ORDER BY cat.sort_order ASC\`;

        const result = await db.query(query, params);
        return result.rows;
    },`;

content = content.replace(getCategoryStatsOld, getCategoryStatsNew);

// Replace findAvailableFIFO
const findAvailableFIFOOld = `             WHERE ii.status = 'AVAILABLE' AND ii.remaining_weight_kg > 0
             ORDER BY ii.entry_date ASC
             LIMIT $1\`,
            [limit]
        );
        return result.rows;
    },`;

const findAvailableFIFONew = `             WHERE ii.status = 'AVAILABLE' AND ii.remaining_weight_kg > 0 \${ctxUser && ctxUser.role !== 'admin' ? \`AND ii.created_by = '\${ctxUser.id}'\` : ''}
             ORDER BY ii.entry_date ASC
             LIMIT $1\`,
            [limit]
        );
        return result.rows;
    },`;

// To correctly modify the function header of findAvailableFIFO:
const fifoHeaderOld = `    async findAvailableFIFO(limit = 50) {
        const result = await db.query(`;

const fifoHeaderNew = `    async findAvailableFIFO(limit = 50) {
        const store = requestContext.getStore();
        const ctxUser = store?.user;
        const result = await db.query(`;

content = content.replace(fifoHeaderOld, fifoHeaderNew);
content = content.replace(findAvailableFIFOOld, findAvailableFIFONew);

fs.writeFileSync(filePath, content);
console.log('Done modifying inventoryItem.model.js');
