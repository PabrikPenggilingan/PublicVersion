const db = require('../config/database');

const inventorySacksModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.inventory_sacks (inventory_item_id, sack_number, weight_kg) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
            [data.inventoryItemId, data.sackNumber, data.weightKg]
        );
        return result.rows[0];
    },

    async createBulk(inventoryItemId, sacks) {
        const results = [];
        for (let i = 0; i < sacks.length; i++) {
            const result = await db.query(
                `INSERT INTO trx.inventory_sacks (inventory_item_id, sack_number, weight_kg) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
                [inventoryItemId, i + 1, sacks[i].weightKg]
            );
            results.push(result.rows[0]);
        }
        return results;
    },

    async getByInventoryItemId(inventoryItemId) {
        const result = await db.query(
            `SELECT * FROM trx.inventory_sacks 
       WHERE inventory_item_id = $1 
       ORDER BY sack_number ASC`,
            [inventoryItemId]
        );
        return result.rows;
    },

    async getAvailableSacks(inventoryItemId) {
        const result = await db.query(
            `SELECT * FROM trx.inventory_sacks 
       WHERE inventory_item_id = $1 AND is_taken = false
       ORDER BY sack_number ASC`,
            [inventoryItemId]
        );
        return result.rows;
    },

    async markAsTaken(sackIds, takenFor, takenRefId) {
        const result = await db.query(
            `UPDATE trx.inventory_sacks 
       SET is_taken = true, taken_at = CURRENT_TIMESTAMP, taken_for = $1, taken_ref_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($3)
       RETURNING *`,
            [takenFor, takenRefId, sackIds]
        );
        return result.rows;
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.inventory_sacks WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

module.exports = inventorySacksModel;
