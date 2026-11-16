const db = require('../config/database');

const processCostModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.process_costs
               (process_id, cost_type, description, amount, finance_transaction_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [data.processId, data.costType, data.description || null, data.amount, data.financeTransactionId || null, data.createdBy]
        );
        return result.rows[0];
    },

    async getByProcessId(processId) {
        const result = await db.query(
            `SELECT pc.*, u.username AS created_by_name
             FROM trx.process_costs pc
             LEFT JOIN sys.users u ON pc.created_by = u.id
             WHERE pc.process_id = $1
             ORDER BY pc.created_at ASC`,
            [processId]
        );
        return result.rows;
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.process_costs WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    },

    async getTotalByProcessId(processId) {
        const result = await db.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM trx.process_costs WHERE process_id = $1',
            [processId]
        );
        return parseFloat(result.rows[0].total);
    }
};

module.exports = processCostModel;
