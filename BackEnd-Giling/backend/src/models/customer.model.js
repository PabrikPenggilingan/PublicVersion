const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const customerModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.customers (name, phone, address, tier_id, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [data.name, data.phone || null, data.address || null,
             data.tierId || null, data.notes || null, data.createdBy || null]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            `SELECT c.*, t.name AS tier_name, t.sort_order AS tier_sort_order
             FROM trx.customers c
             LEFT JOIN mst.customer_tiers t ON c.tier_id = t.id
             WHERE c.id = $1`,
            [id]
        );
        return result.rows[0];
    },

    async findAll({ isActive, tierId, search } = {}) {
        let conditions = [];
        const params = [];

        if (isActive !== undefined) {
            params.push(isActive);
            conditions.push(`c.is_active = $${params.length}`);
        }
        if (tierId) {
            params.push(tierId);
            conditions.push(`c.tier_id = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length})`);
        }

        const store = requestContext.getStore();
        const user = store?.user;
        if (user) {
            params.push(tenantIds(user));
            conditions.push(`c.created_by = ANY($${params.length}::uuid[])`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await db.query(
            `SELECT c.*, t.name AS tier_name, t.sort_order AS tier_sort_order
             FROM trx.customers c
             LEFT JOIN mst.customer_tiers t ON c.tier_id = t.id
             ${where}
             ORDER BY t.sort_order NULLS LAST, c.name`,
            params
        );
        return result.rows;
    },

    async update(id, data) {
        const fields = [];
        const params = [id];

        const map = {
            name: 'name', phone: 'phone', address: 'address',
            tierId: 'tier_id', notes: 'notes', isActive: 'is_active'
        };
        Object.entries(data).forEach(([key, val]) => {
            if (map[key] !== undefined && val !== undefined) {
                params.push(val === '' ? null : val);
                fields.push(`${map[key]} = $${params.length}`);
            }
        });

        if (!fields.length) return this.findById(id);
        const result = await db.query(
            `UPDATE trx.customers SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(id) {
        // Soft delete
        const result = await db.query(
            `UPDATE trx.customers SET is_active = FALSE WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
};

module.exports = customerModel;
