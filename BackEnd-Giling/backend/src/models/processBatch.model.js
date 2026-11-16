const db = require('../config/database');

const processBatchesModel = {
    async create(data) {
        const { processId, batchId, qtyUsedKg } = data;
        const result = await db.query(
            `INSERT INTO trx.process_batches (process_id, batch_id, qty_used_kg) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
            [processId, batchId, qtyUsedKg]
        );
        return result.rows[0];
    },

    async findByProcessId(processId) {
        const result = await db.query(
            `SELECT pb.*, b.batch_date, b.status as batch_status, b.total_qty_kg, b.remaining_kg 
       FROM trx.process_batches pb 
       JOIN trx.batches b ON pb.batch_id = b.id 
       WHERE pb.process_id = $1`,
            [processId]
        );
        return result.rows;
    },

    async countByProcessId(processId) {
        const result = await db.query(
            'SELECT COUNT(*) FROM trx.process_batches WHERE process_id = $1',
            [processId]
        );
        return parseInt(result.rows[0].count);
    },

    async delete(processId, batchId) {
        const result = await db.query(
            'DELETE FROM trx.process_batches WHERE process_id = $1 AND batch_id = $2 RETURNING *',
            [processId, batchId]
        );
        return result.rows[0];
    }
};

module.exports = processBatchesModel;
