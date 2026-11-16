const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const saleModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.sales (customer_id, sale_date, notes, created_by)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [data.customerId || null, data.saleDate || new Date(),
             data.notes || null, data.createdBy]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            `SELECT s.*,
                c.name        AS customer_name,
                c.phone       AS customer_phone,
                t.name        AS tier_name,
                t.sort_order  AS tier_sort_order,
                u.username    AS created_by_name
             FROM trx.sales s
             LEFT JOIN trx.customers c      ON s.customer_id = c.id
             LEFT JOIN mst.customer_tiers t ON c.tier_id = t.id
             LEFT JOIN sys.users u          ON s.created_by = u.id
             WHERE s.id = $1`,
            [id]
        );
        return result.rows[0];
    },

    async findAll({ status, paymentStatus, customerId, dateFrom, dateTo, page = 1, limit = 20 } = {}) {
        const conditions = [];
        const params = [];

        if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
        if (paymentStatus) { params.push(paymentStatus); conditions.push(`s.payment_status = $${params.length}`); }
        if (customerId) { params.push(customerId); conditions.push(`s.customer_id = $${params.length}`); }
        if (dateFrom) { params.push(dateFrom); conditions.push(`s.sale_date >= $${params.length}`); }
        if (dateTo) { params.push(dateTo); conditions.push(`s.sale_date <= $${params.length}`); }

        const store = requestContext.getStore();
        const user = store?.user;
        if (user) {
            params.push(tenantIds(user));
            conditions.push(`s.created_by = ANY($${params.length}::uuid[])`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const offset = (page - 1) * limit;

        params.push(limit);
        params.push(offset);

        const [rows, countResult] = await Promise.all([
            db.query(
                `SELECT s.*,
                    c.name       AS customer_name,
                    t.name       AS tier_name,
                    t.sort_order AS tier_sort_order
                 FROM trx.sales s
                 LEFT JOIN trx.customers c      ON s.customer_id = c.id
                 LEFT JOIN mst.customer_tiers t ON c.tier_id = t.id
                 ${where}
                 ORDER BY s.sale_date DESC, s.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`,
                params
            ),
            db.query(
                `SELECT COUNT(*) FROM trx.sales s ${where}`,
                params.slice(0, -2)
            )
        ]);

        return {
            data: rows.rows,
            total: parseInt(countResult.rows[0].count),
            page, limit
        };
    },

    async setDeductionJournal(id, journalId) {
        await db.query(`UPDATE trx.sales SET deduction_journal_id = $2 WHERE id = $1`, [id, journalId]);
    },

    async confirm(id) {
        const result = await db.query(
            `UPDATE trx.sales SET status = 'CONFIRMED' WHERE id = $1 AND status = 'DRAFT'
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    async void(id, reason, voidBy) {
        const result = await db.query(
            `UPDATE trx.sales
             SET status = 'VOID', void_reason = $2, void_at = NOW(), void_by = $3
             WHERE id = $1 AND status != 'VOID'
             RETURNING *`,
            [id, reason, voidBy]
        );
        return result.rows[0];
    },

    async close(id) {
        const result = await db.query(
            `UPDATE trx.sales SET status = 'COMPLETED' WHERE id = $1
             RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    async updateNotes(id, notes) {
        const result = await db.query(
            `UPDATE trx.sales SET notes = $2 WHERE id = $1 RETURNING *`,
            [id, notes]
        );
        return result.rows[0];
    },

    async updateCustomer(id, customerId) {
        const result = await db.query(
            `UPDATE trx.sales SET customer_id = $2 WHERE id = $1 RETURNING *`,
            [id, customerId]
        );
        return result.rows[0];
    },

    // Get sale items with current delivery progress
    async getItems(saleId) {
        const result = await db.query(
            `SELECT si.*,
                ii.product_category_code,
                ii.remaining_weight_kg AS stock_remaining,
                ii.remaining_sacks     AS stock_remaining_sacks
             FROM trx.sale_items si
             LEFT JOIN trx.inventory_items ii ON si.inventory_item_id = ii.id
             WHERE si.sale_id = $1
             ORDER BY si.created_at`,
            [saleId]
        );
        return result.rows;
    },

    // Get deliveries for a sale
    async getDeliveries(saleId) {
        const result = await db.query(
            `SELECT sd.*,
                u.username AS created_by_name,
                json_agg(json_build_object(
                    'id', sdi.id,
                    'sale_item_id', sdi.sale_item_id,
                    'qty_delivered', sdi.qty_delivered,
                    'item_name', si.item_name,
                    'unit_type', si.unit_type
                ) ORDER BY sdi.id) AS items
             FROM trx.sale_deliveries sd
             LEFT JOIN trx.sale_delivery_items sdi ON sd.id = sdi.delivery_id
             LEFT JOIN trx.sale_items si ON sdi.sale_item_id = si.id
             LEFT JOIN sys.users u ON sd.created_by = u.id
             WHERE sd.sale_id = $1
             GROUP BY sd.id, u.username
             ORDER BY sd.delivery_date DESC`,
            [saleId]
        );
        return result.rows;
    },

    // Get payments for a sale
    async getPayments(saleId) {
        const result = await db.query(
            `SELECT sp.*, u.username AS created_by_name
             FROM trx.sale_payments sp
             LEFT JOIN sys.users u ON sp.created_by = u.id
             WHERE sp.sale_id = $1
             ORDER BY sp.payment_date DESC`,
            [saleId]
        );
        return result.rows;
    },

    // Get returns for a sale
    async getReturns(saleId) {
        const result = await db.query(
            `SELECT sr.*, u.username AS created_by_name, si.item_name, si.unit_price
             FROM trx.sale_returns sr
             LEFT JOIN sys.users u ON sr.created_by = u.id
             LEFT JOIN trx.sale_items si ON sr.sale_item_id = si.id
             WHERE sr.sale_id = $1
             ORDER BY sr.return_date DESC`,
            [saleId]
        );
        return result.rows;
    },

    // Summary stats for dashboard
    async getSummaryStats() {
        const store = requestContext.getStore();
        const user = store?.user;
        const whereClause = user ? `WHERE created_by = ANY(${tenantSql(user)})` : '';
        const andWhereClause = user ? `AND created_by = ANY(${tenantSql(user)})` : '';

        const result = await db.query(
            `SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('VOID', 'DRAFT') ${andWhereClause}) AS total_active,
                COUNT(*) FILTER (WHERE payment_status = 'UNPAID' AND status NOT IN ('VOID', 'DRAFT') ${andWhereClause}) AS unpaid_count,
                COALESCE(SUM(outstanding) FILTER (WHERE status NOT IN ('VOID', 'DRAFT') ${andWhereClause}), 0) AS total_outstanding,
                COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('VOID', 'DRAFT') AND DATE_TRUNC('month', sale_date) = DATE_TRUNC('month', NOW()) ${andWhereClause}), 0) AS this_month_revenue
             FROM trx.sales ${whereClause}`
        );
        return result.rows[0];
    }
};

module.exports = saleModel;
