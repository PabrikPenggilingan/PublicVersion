const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const processesModel = {
    async create(data) {
        const {
            createdBy, processDate, endDate, status, notes,
            inventoryItemId, gabahReservedKg
        } = data;
        const result = await db.query(
            `INSERT INTO trx.processes
               (created_by, process_date, end_date, status, notes, inventory_item_id, gabah_reserved_kg, total_input_kg)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [
                createdBy, processDate, endDate || null,
                status || 'IN_PROGRESS', notes || null,
                inventoryItemId || null, gabahReservedKg || null,
                gabahReservedKg || null
            ]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            'SELECT * FROM trx.processes WHERE id = $1',
            [id]
        );
        return result.rows[0];
    },

    async findByIdWithDetails(id) {
        const processResult = await db.query(
            `SELECT p.*,
                    ii.product_category_code  AS gabah_category,
                    ii.total_weight_kg        AS gabah_total_kg,
                    ii.remaining_weight_kg    AS gabah_remaining_kg,
                    ii.status                 AS gabah_status,
                    ii.avg_price_per_kg       AS gabah_price_per_kg,
                    ii.area                   AS gabah_area,
                    ii.tanda                  AS gabah_tanda,
                    ii.is_titipan             AS gabah_is_titipan,
                    ii.titipan_subtype        AS gabah_titipan_subtype,
                    ii.batch_id               AS gabah_batch_id,
                    b.batch_date              AS gabah_batch_date,
                    b.total_qty_kg            AS gabah_initial_weight,
                    dp.name                   AS gabah_drying_name
             FROM trx.processes p
             LEFT JOIN trx.inventory_items ii ON p.inventory_item_id = ii.id
             LEFT JOIN trx.batches         b  ON ii.batch_id = b.id
             LEFT JOIN trx.drying_processes dp ON ii.drying_id = dp.id
             WHERE p.id = $1`,
            [id]
        );
        if (processResult.rows.length === 0) return null;

        const process = processResult.rows[0];

        // Get attached batches (legacy support)
        const batchesResult = await db.query(
            `SELECT pb.*, b.batch_date, b.status as batch_status, b.total_qty_kg
             FROM trx.process_batches pb
             JOIN trx.batches b ON pb.batch_id = b.id
             WHERE pb.process_id = $1`,
            [id]
        );
        process.batches = batchesResult.rows;

        // Get process costs (HPP)
        const costsResult = await db.query(
            `SELECT pc.*, u.username AS created_by_name
             FROM trx.process_costs pc
             LEFT JOIN sys.users u ON pc.created_by = u.id
             WHERE pc.process_id = $1
             ORDER BY pc.created_at ASC`,
            [id]
        );
        process.costs = costsResult.rows;

        return process;
    },

    async getAll(filters = {}, limit = 50, offset = 0) {
        let query = 'SELECT * FROM trx.processes WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters && filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
        }

        const store = requestContext.getStore();
        const user = store?.user;
        if (user) {
            query += ` AND created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(user));
            paramIndex++;
        }

        query += ` ORDER BY process_date DESC, created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset || 0);

        const result = await db.query(query, params);
        return result.rows;
    },

    async count(filters = {}) {
        let query = 'SELECT COUNT(*) FROM trx.processes WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters && filters.status) {
            query += ` AND status = $${paramIndex}`;
            params.push(filters.status);
            paramIndex++;
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

        const fieldMap = {
            processDate:      'process_date',
            endDate:          'end_date',
            status:           'status',
            notes:            'notes',
            inventoryItemId:  'inventory_item_id',
            gabahReservedKg:  'gabah_reserved_kg',
            totalInputKg:     'total_input_kg',
            gabahUsedKg:      'gabah_used_kg',
            sekamKg:          'sekam_kg',
            sekamNotes:       'sekam_notes',
            rendemenPct:      'rendemen_pct',
            hppPerKg:         'hpp_per_kg',
            wasteKg:          'waste_kg',
            wasteReason:      'waste_reason'
        };

        Object.entries(data).forEach(([key, value]) => {
            const dbField = fieldMap[key] || key;
            if (value !== undefined) {
                updates.push(`${dbField} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        if (updates.length === 0) {
            return this.findById(id);
        }

        params.push(id);
        const result = await db.query(
            `UPDATE trx.processes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.processes WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

module.exports = processesModel;
