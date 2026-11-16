const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

// Pengiriman penjualan: a trx.logistics_tasks row with reference_type = 'SALE' that can
// carry several nota (trx.logistics_task_sales). Tonnage = Σ qty_ordered of KG items.

const currentUserId = () => requestContext.getStore()?.user?.id || null;
const currentTenantIds = () => tenantIds();

const SALE_WEIGHT_SQL = `
    SELECT s.id, s.sale_no, s.sale_date, s.status, s.total_amount, s.created_by,
           c.name AS customer_name,
           COALESCE(SUM(si.qty_ordered) FILTER (WHERE si.unit_type = 'KG'), 0)::numeric AS total_kg
    FROM trx.sales s
    LEFT JOIN trx.customers c ON c.id = s.customer_id
    LEFT JOIN trx.sale_items si ON si.sale_id = s.id
`;

const SHIPMENT_SELECT = `
    SELECT l.*,
        COALESCE(sales.items, '[]'::json) AS sales,
        COALESCE(sales.total_kg, 0)       AS total_kg,
        COALESCE(sales.sale_nos, '')      AS reference_name,
        COALESCE(l.shipment_date, l.created_at::date) AS reference_date,
        jt.status AS transport_journal_status,
        jc.status AS commission_journal_status
    FROM trx.logistics_tasks l
    LEFT JOIN LATERAL (
        SELECT json_agg(json_build_object(
                   'id', w.id, 'sale_no', w.sale_no, 'sale_date', w.sale_date, 'status', w.status,
                   'customer_name', w.customer_name, 'total_amount', w.total_amount, 'total_kg', w.total_kg
               ) ORDER BY w.sale_date, w.sale_no) AS items,
               SUM(w.total_kg) AS total_kg,
               string_agg(w.sale_no, ', ' ORDER BY w.sale_date, w.sale_no) AS sale_nos
        FROM trx.logistics_task_sales lts
        JOIN (${SALE_WEIGHT_SQL} GROUP BY s.id, c.name) w ON w.id = lts.sale_id
        WHERE lts.logistics_task_id = l.id
    ) sales ON TRUE
    LEFT JOIN trx.journal_entries jt ON jt.id = l.finance_transaction_id
    LEFT JOIN trx.journal_entries jc ON jc.id = l.commission_transaction_id
`;

const saleShipmentModel = {
    async findAll() {
        const params = [];
        let where = `WHERE l.reference_type = 'SALE'`;
        const userId = currentUserId();
        if (userId) {
            params.push(currentTenantIds());
            where += ` AND l.created_by = ANY($1::uuid[])`;
        }
        const result = await db.query(
            `${SHIPMENT_SELECT} ${where} ORDER BY COALESCE(l.shipment_date, l.created_at::date) DESC, l.created_at DESC`,
            params
        );
        return result.rows;
    },

    async findById(id, client) {
        const executor = client || db;
        const result = await executor.query(
            `${SHIPMENT_SELECT} WHERE l.id = $1 AND l.reference_type = 'SALE'`,
            [id]
        );
        return result.rows[0];
    },

    async findBySaleId(saleId) {
        const result = await db.query(
            `SELECT logistics_task_id FROM trx.logistics_task_sales WHERE sale_id = $1`,
            [saleId]
        );
        if (!result.rows[0]) return null;
        return this.findById(result.rows[0].logistics_task_id);
    },

    // Sales with their tonnage, restricted to the current user's nota (same isolation as sale.model)
    async getSalesWithWeight(saleIds, client) {
        const executor = client || db;
        const params = [saleIds];
        let where = `WHERE s.id = ANY($1::uuid[])`;
        const userId = currentUserId();
        if (userId) {
            params.push(currentTenantIds());
            where += ` AND s.created_by = ANY($2::uuid[])`;
        }
        const result = await executor.query(
            `${SALE_WEIGHT_SQL} ${where} GROUP BY s.id, c.name`,
            params
        );
        return result.rows;
    },

    // Nota that can still be put on a truck: not VOID and not in another shipment
    async getAvailableSales(excludeShipmentId) {
        const params = [excludeShipmentId || null];
        let where = `WHERE s.status <> 'VOID'
            AND NOT EXISTS (
                SELECT 1 FROM trx.logistics_task_sales x
                WHERE x.sale_id = s.id AND x.logistics_task_id IS DISTINCT FROM $1::uuid
            )`;
        const userId = currentUserId();
        if (userId) {
            params.push(currentTenantIds());
            where += ` AND s.created_by = ANY($2::uuid[])`;
        }
        const result = await db.query(
            `${SALE_WEIGHT_SQL} ${where} GROUP BY s.id, c.name ORDER BY s.sale_date DESC, s.sale_no DESC LIMIT 200`,
            params
        );
        return result.rows;
    },

    async findSaleShipmentIds(saleIds, client) {
        const executor = client || db;
        const result = await executor.query(
            `SELECT sale_id, logistics_task_id FROM trx.logistics_task_sales WHERE sale_id = ANY($1::uuid[])`,
            [saleIds]
        );
        return result.rows;
    },

    async insert(data, client) {
        const result = await client.query(
            `INSERT INTO trx.logistics_tasks
                (reference_type, reference_id, shipment_date, driver_name, crew_names, origin, destination,
                 duration_hours, operational_cost, commission_rate_per_kg, commission_amount,
                 commission_recipient, status, notes, created_by)
             VALUES ('SALE', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'COMPLETED', $12, $13)
             RETURNING *`,
            [
                data.referenceId, data.shipmentDate, data.driverName, data.crewNames, data.origin,
                data.destination, data.durationHours, data.operationalCost, data.commissionRatePerKg,
                data.commissionAmount, data.commissionRecipient, data.notes, data.createdBy
            ]
        );
        return result.rows[0];
    },

    async update(id, data, client) {
        const result = await client.query(
            `UPDATE trx.logistics_tasks SET
                reference_id = $2, shipment_date = $3, driver_name = $4, crew_names = $5, origin = $6,
                destination = $7, duration_hours = $8, operational_cost = $9, commission_rate_per_kg = $10,
                commission_amount = $11, commission_recipient = $12, notes = $13
             WHERE id = $1 AND reference_type = 'SALE'
             RETURNING *`,
            [
                id, data.referenceId, data.shipmentDate, data.driverName, data.crewNames, data.origin,
                data.destination, data.durationHours, data.operationalCost, data.commissionRatePerKg,
                data.commissionAmount, data.commissionRecipient, data.notes
            ]
        );
        return result.rows[0];
    },

    async setJournalIds(id, { transportJournalId, commissionJournalId }, client) {
        await client.query(
            `UPDATE trx.logistics_tasks SET finance_transaction_id = $2, commission_transaction_id = $3 WHERE id = $1`,
            [id, transportJournalId, commissionJournalId]
        );
    },

    async replaceSales(id, saleIds, client) {
        await client.query(`DELETE FROM trx.logistics_task_sales WHERE logistics_task_id = $1`, [id]);
        await client.query(
            `INSERT INTO trx.logistics_task_sales (logistics_task_id, sale_id)
             SELECT $1, unnest($2::uuid[])`,
            [id, saleIds]
        );
    },

    async delete(id, client) {
        await client.query(`DELETE FROM trx.logistics_tasks WHERE id = $1 AND reference_type = 'SALE'`, [id]);
    },

    async removeSale(saleId, client) {
        const executor = client || db;
        await executor.query(`DELETE FROM trx.logistics_task_sales WHERE sale_id = $1`, [saleId]);
    }
};

module.exports = saleShipmentModel;
