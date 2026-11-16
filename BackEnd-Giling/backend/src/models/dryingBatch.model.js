const db = require('../config/database');

const dryingBatchesModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.drying_batches (drying_id, batch_id, tonnage_kg) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
            [data.dryingId, data.batchId, data.tonnageKg]
        );
        return result.rows[0];
    },

    async getByDryingId(dryingId) {
        const result = await db.query(
            `SELECT db.*, b.batch_date, b.status as batch_status, b.total_qty_kg
       FROM trx.drying_batches db
       JOIN trx.batches b ON b.id = db.batch_id
       WHERE db.drying_id = $1
       ORDER BY b.batch_date DESC`,
            [dryingId]
        );
        return result.rows;
    },

    async deleteByDryingId(dryingId) {
        await db.query('DELETE FROM trx.drying_batches WHERE drying_id = $1', [dryingId]);
    }
};

module.exports = dryingBatchesModel;
