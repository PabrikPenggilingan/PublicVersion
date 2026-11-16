const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const logisticsModel = {
    async getByReference(referenceType, referenceId) {
        const result = await db.query(
            `SELECT * FROM trx.logistics_tasks WHERE reference_type = $1 AND reference_id = $2 LIMIT 1`,
            [referenceType, referenceId]
        );
        return result.rows[0];
    },

    async create(data) {
        const {
            referenceType,
            referenceId,
            driverName,
            crewNames,
            origin,
            destination,
            durationHours,
            operationalCost,
            financeTransactionId,
            status,
            notes,
            createdBy
        } = data;

        const result = await db.query(
            `INSERT INTO trx.logistics_tasks 
            (reference_type, reference_id, driver_name, crew_names, origin, destination, duration_hours, operational_cost, finance_transaction_id, status, notes, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *`,
            [referenceType, referenceId, driverName, crewNames, origin, destination, durationHours, operationalCost, financeTransactionId, status, notes, createdBy]
        );
        return result.rows[0];
    },

    async update(id, data) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                // Convert camelCase to snake_case for DB columns
                const dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
                updates.push(`${dbKey} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        if (updates.length === 0) return this.findById(id);

        params.push(id);
        const result = await db.query(
            `UPDATE trx.logistics_tasks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            `SELECT l.*,
                CASE 
                    WHEN l.reference_type = 'PURCHASE' THEN p.nama
                    WHEN l.reference_type = 'SALE' THEN s.sale_no
                END as reference_name,
                CASE 
                    WHEN l.reference_type = 'PURCHASE' THEN p.tanggal_belanja
                    WHEN l.reference_type = 'SALE' THEN s.sale_date
                END as reference_date
             FROM trx.logistics_tasks l
             LEFT JOIN trx.purchases p ON l.reference_type = 'PURCHASE' AND l.reference_id = p.id
             LEFT JOIN trx.sales s ON l.reference_type = 'SALE' AND l.reference_id = s.id
             WHERE l.id = $1`,
            [id]
        );
        return result.rows[0];
    },

    async findAll(filters = {}) {
        let query = `
            SELECT l.*,
                CASE 
                    WHEN l.reference_type = 'PURCHASE' THEN p.nama
                    WHEN l.reference_type = 'SALE' THEN s.sale_no
                END as reference_name,
                CASE 
                    WHEN l.reference_type = 'PURCHASE' THEN p.tanggal_belanja
                    WHEN l.reference_type = 'SALE' THEN s.sale_date
                END as reference_date
            FROM trx.logistics_tasks l
            LEFT JOIN trx.purchases p ON l.reference_type = 'PURCHASE' AND l.reference_id = p.id
            LEFT JOIN trx.sales s ON l.reference_type = 'SALE' AND l.reference_id = s.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (filters.referenceType) {
            paramCount++;
            query += ` AND l.reference_type = $${paramCount}`;
            params.push(filters.referenceType);
        }

        if (filters.status) {
            paramCount++;
            query += ` AND l.status = $${paramCount}`;
            params.push(filters.status);
        }

        const store = requestContext.getStore();
        const user = store?.user;
        const isAdminOnly = user && (user.role || '').toLowerCase() === 'super_admin';
        if (user && !isAdminOnly) {
            paramCount++;
            query += ` AND l.created_by = ANY($${paramCount}::uuid[])`;
            params.push(tenantIds(user));
        }

        query += ` ORDER BY l.created_at DESC`;

        const result = await db.query(query, params);
        return result.rows;
    },

    async getAvailableReferences(type) {
        const store = requestContext.getStore();
        const user = store?.user;
        const isAdminOnlyRef = user && (user.role || '').toLowerCase() === 'super_admin';
        const purchaseWhereClause = (user && !isAdminOnlyRef) ? `WHERE l.id IS NULL AND p.batch_id IN (SELECT id FROM trx.batches WHERE created_by = ANY(${tenantSql(user)}))` : `WHERE l.id IS NULL`;
        const saleWhereClause = (user && !isAdminOnlyRef) ? `WHERE l.id IS NULL AND s.created_by = ANY(${tenantSql(user)})` : `WHERE l.id IS NULL`;

        // Return purchases or sales that do NOT have a logistics task attached yet
        if (type === 'PURCHASE') {
            const result = await db.query(`
                SELECT p.id, p.nama as name, p.tanggal_belanja as date, p.berat_gabah_kg as weight
                FROM trx.purchases p
                LEFT JOIN trx.logistics_tasks l ON l.reference_type = 'PURCHASE' AND l.reference_id = p.id
                ${purchaseWhereClause}
                ORDER BY p.tanggal_belanja DESC
            `);
            return result.rows;
        } else if (type === 'SALE') {
            const result = await db.query(`
                SELECT s.id, s.sale_no as name, s.sale_date as date, s.total_amount as amount
                FROM trx.sales s
                LEFT JOIN trx.logistics_tasks l ON l.reference_type = 'SALE' AND l.reference_id = s.id
                ${saleWhereClause}
                ORDER BY s.sale_date DESC
            `);
            return result.rows;
        }
        return [];
    }
};

module.exports = logisticsModel;
