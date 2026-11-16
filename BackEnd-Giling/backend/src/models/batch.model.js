const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const batchesModel = {
    async create(data) {
        const { createdBy, batchDate, status, jenisGabah } = data;
        const result = await db.query(
            `INSERT INTO trx.batches (created_by, batch_date, status, jenis_gabah) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
            [createdBy ?? null, batchDate ?? null, status || 'OPEN', jenisGabah ?? null]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            `SELECT b.*, 
                    (SELECT COALESCE(SUM(p.berat_gabah_kg), 0) FROM trx.purchases p WHERE p.batch_id = b.id) AS total_qty_kg 
             FROM trx.batches b WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    },

    async getAll(filters = {}, limit = 50, offset = 0) {
        let query = `
            SELECT b.*,
                   (
                       SELECT string_agg(DISTINCT p.lokasi_belanja, ', ')
                       FROM trx.purchases p
                       WHERE p.batch_id = b.id
                   ) AS areas,
                   (
                       SELECT string_agg(DISTINCT p.nama, ', ')
                       FROM trx.purchases p
                       WHERE p.batch_id = b.id
                   ) AS farmers,
                   (
                       SELECT COALESCE(SUM(p.berat_gabah_kg), 0)
                       FROM trx.purchases p
                       WHERE p.batch_id = b.id
                   ) AS total_qty_kg,
                   -- Latest pengeringan this batch is in (if any): where its gabah currently is
                   (
                       SELECT json_build_object('id', dp.id, 'name', dp.name, 'status', dp.status)
                       FROM trx.drying_batches dbx
                       JOIN trx.drying_processes dp ON dp.id = dbx.drying_id
                       WHERE dbx.batch_id = b.id
                       ORDER BY dp.created_at DESC
                       LIMIT 1
                   ) AS drying
            FROM trx.batches b
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (filters && filters.status) {
            query += ` AND b.status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters && filters.availableForDrying) {
            query += ` AND NOT EXISTS (SELECT 1 FROM trx.drying_batches db WHERE db.batch_id = b.id)`;
        }

        const store = requestContext.getStore();
        const user = store?.user;
        
        if (user) {
            query += ` AND b.created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(user));
            paramIndex++;
        }

        query += ` ORDER BY b.batch_date DESC, b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset || 0);

        const result = await db.query(query, params);
        return result.rows;
    },

    async count(filters = {}) {
        let query = 'SELECT COUNT(*) FROM trx.batches WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters && filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        if (filters && filters.availableForDrying) {
            query += ` AND NOT EXISTS (SELECT 1 FROM trx.drying_batches db WHERE db.batch_id = trx.batches.id)`;
        }

        const store = requestContext.getStore();
        const user = store?.user;
        
        if (user) {
            query += ` AND created_by = ANY($${paramIndex}::uuid[])`;
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
            `UPDATE trx.batches SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.batches WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

module.exports = batchesModel;
