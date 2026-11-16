const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const purchasesModel = {
    async create(data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const result = await db.query(
            `INSERT INTO trx.purchases (${columns.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
            values
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            'SELECT * FROM trx.purchases WHERE id = $1',
            [id]
        );
        return result.rows[0];
    },

    async getByBatchId(batchId, limit, offset) {
        const store = requestContext.getStore();
        const user = store?.user;
        
        let query = `SELECT p.*, 
              (SELECT COUNT(*) FROM trx.purchase_photos WHERE purchase_id = p.id) as photo_count,
              COALESCE((SELECT json_agg(ph.file_path ORDER BY ph.created_at) FROM trx.purchase_photos ph WHERE ph.purchase_id = p.id), '[]'::json) as photos
       FROM trx.purchases p
       JOIN trx.batches b ON p.batch_id = b.id
       WHERE p.batch_id = $1`;
        
        const params = [batchId];
        let paramIndex = 2;
        
        if (user) {
            query += ` AND b.created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(user));
            paramIndex++;
        }
        
        query += ` ORDER BY p.tanggal_belanja DESC, p.created_at DESC 
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        
        params.push(limit, offset);
        
        const result = await db.query(query, params);
        return result.rows;
    },

    async countByBatchId(batchId) {
        const store = requestContext.getStore();
        const user = store?.user;
        
        let query = 'SELECT COUNT(*) FROM trx.purchases p JOIN trx.batches b ON p.batch_id = b.id WHERE p.batch_id = $1';
        const params = [batchId];
        let paramIndex = 2;
        
        if (user) {
            query += ` AND b.created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(user));
            paramIndex++;
        }
        
        const result = await db.query(query, params);
        return parseInt(result.rows[0].count);
    },

    async update(id, data) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                updates.push(`${key} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        if (updates.length === 0) {
            return this.findById(id);
        }

        params.push(id);
        const result = await db.query(
            `UPDATE trx.purchases SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.purchases WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

module.exports = purchasesModel;
