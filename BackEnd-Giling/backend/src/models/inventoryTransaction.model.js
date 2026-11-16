const db = require('../config/database');

const inventoryTransactionsModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.inventory_transactions 
       (inventory_item_id, transaction_type, weight_kg, sack_count, reference_type, reference_id, notes, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
            [
                data.inventoryItemId, data.transactionType, data.weightKg,
                data.sackCount, data.referenceType, data.referenceId,
                data.notes, data.createdBy
            ]
        );
        return result.rows[0];
    },

    async getByInventoryItemId(inventoryItemId) {
        const result = await db.query(
            `SELECT it.*, u.username as created_by_name
       FROM trx.inventory_transactions it
       LEFT JOIN sys.users u ON it.created_by = u.id
       WHERE it.inventory_item_id = $1 
       ORDER BY it.created_at DESC`,
            [inventoryItemId]
        );
        return result.rows;
    }
};

module.exports = inventoryTransactionsModel;
