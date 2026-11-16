const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const dryingProcessesModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.drying_processes (created_by, status, name, notes, drying_type, vendor_name, is_titipan, titipan_data, titipan_inventory_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
            [data.createdBy, data.status || 'PENDING', data.name, data.notes, data.dryingType || 'oven_mandiri', data.vendorName, data.isTitipan || false, data.titipanData ? JSON.stringify(data.titipanData) : null, data.titipanInventoryId || null]
        );
        return result.rows[0];
    },

    async findById(id, user) {
        let queryStr = `SELECT dp.*, 
              (SELECT COUNT(*) FROM trx.drying_batches WHERE drying_id = dp.id) as batch_count,
              CASE 
                  WHEN dp.titipan_inventory_id IS NOT NULL THEN (SELECT (titipan_data->>'beratKg')::numeric FROM trx.inventory_items WHERE id = dp.titipan_inventory_id)
                  WHEN dp.is_titipan THEN (dp.titipan_data->>'beratKg')::numeric 
                  ELSE (SELECT COALESCE(SUM(tonnage_kg), 0) FROM trx.drying_batches WHERE drying_id = dp.id) 
              END as total_tonnage,
              (dp.is_titipan OR dp.titipan_inventory_id IS NOT NULL) as is_titipan,
              COALESCE(dp.titipan_data, (SELECT titipan_data FROM trx.inventory_items WHERE id = dp.titipan_inventory_id)) as titipan_data
       FROM trx.drying_processes dp 
       WHERE dp.id = $1`;
       
        const params = [id];

        const result = await db.query(queryStr, params);
        return result.rows[0];
    },

    async findByIdWithDetails(id, user) {
        const drying = await this.findById(id, user);
        if (!drying) return null;

        // Get batches
        const batchesResult = await db.query(
            `SELECT db.*, b.batch_date, b.status as batch_status
             FROM trx.drying_batches db
             JOIN trx.batches b ON db.batch_id = b.id
             WHERE db.drying_id = $1`,
            [id]
        );
        drying.batches = batchesResult.rows;

        // Get sessions
        const sessionsResult = await db.query(
            `SELECT * FROM trx.drying_sessions 
             WHERE drying_id = $1 
             ORDER BY session_date ASC, session_time ASC`,
            [id]
        );
        drying.sessions = sessionsResult.rows;

        return drying;
    },

    async getAll(filters = {}, limit = 50, offset = 0, user) {
        let query = `SELECT dp.*, 
                        (SELECT COUNT(*) FROM trx.drying_batches WHERE drying_id = dp.id) as batch_count,
                        COALESCE(
                            (SELECT MIN(b.batch_date) FROM trx.drying_batches dbx JOIN trx.batches b ON b.id = dbx.batch_id WHERE dbx.drying_id = dp.id),
                            (SELECT DATE(ii.created_at) FROM trx.inventory_items ii WHERE ii.id = dp.titipan_inventory_id)
                        ) as belanja_date,
                        CASE 
                            WHEN dp.titipan_inventory_id IS NOT NULL THEN (SELECT (titipan_data->>'beratKg')::numeric FROM trx.inventory_items WHERE id = dp.titipan_inventory_id)
                            WHEN dp.is_titipan THEN (dp.titipan_data->>'beratKg')::numeric 
                            ELSE (SELECT COALESCE(SUM(tonnage_kg), 0) FROM trx.drying_batches WHERE drying_id = dp.id) 
                        END as total_tonnage,
                        (dp.is_titipan OR dp.titipan_inventory_id IS NOT NULL) as is_titipan,
                        COALESCE(dp.titipan_data, (SELECT titipan_data FROM trx.inventory_items WHERE id = dp.titipan_inventory_id)) as titipan_data
                 FROM trx.drying_processes dp`;
        const params = [];
        const conditions = [];
        let paramIndex = 1;

        if (filters && filters.status) {
            conditions.push(`dp.status = $${paramIndex}`);
            params.push(filters.status);
            paramIndex++;
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const store = requestContext.getStore();
        const userContext = store?.user;
        if (userContext) {
            query += conditions.length > 0 ? ` AND dp.created_by = ANY($${paramIndex}::uuid[])` : ` WHERE dp.created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(userContext));
            paramIndex++;
        }

        query += ` ORDER BY dp.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset || 0);

        const result = await db.query(query, params);
        return result.rows;
    },

    async count(filters = {}, user) {
        let query = 'SELECT COUNT(*) FROM trx.drying_processes';
        const params = [];
        const conditions = [];
        let paramIndex = 1;

        if (filters && filters.status) {
            conditions.push(`status = $${paramIndex}`);
            params.push(filters.status);
            paramIndex++;
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        const store = requestContext.getStore();
        const userContext = store?.user;
        if (userContext) {
            query += conditions.length > 0 ? ` AND created_by = ANY($${paramIndex}::uuid[])` : ` WHERE created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(userContext));
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

        if (updates.length === 0) return this.findById(id);

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(id);

        await db.query(
            `UPDATE trx.drying_processes SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
            params
        );
        return this.findById(id);
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.drying_processes WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

module.exports = dryingProcessesModel;
