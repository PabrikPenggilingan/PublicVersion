const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');

const dashboardService = {
    async getTimeline(user) {
        let whereClause = '';
        const params = [];
        
        if (user) {
            whereClause = 'WHERE b.created_by = ANY($1::uuid[])';
            params.push(tenantIds(user));
        }

        const query = `
            WITH batch_base AS (
                SELECT 
                    b.id as batch_id,
                    b.batch_date,
                    b.status as batch_status,
                    b.total_qty_kg,
                    b.remaining_kg,
                    (
                        SELECT string_agg(DISTINCT p.nama, ', ')
                        FROM trx.purchases p
                        WHERE p.batch_id = b.id
                    ) AS farmers
                FROM trx.batches b
                ${whereClause}
            ),
            drying_info AS (
                SELECT 
                    db.batch_id,
                    COUNT(dp.id) as active_drying_count,
                    SUM(db.tonnage_kg) as pengeringan_kg
                FROM trx.drying_batches db
                JOIN trx.drying_processes dp ON db.drying_id = dp.id
                WHERE dp.status IN ('PENDING', 'IN_PROGRESS', 'PENDING_APPROVAL')
                   OR (dp.status = 'COMPLETED' AND NOT EXISTS (
                       SELECT 1 FROM trx.inventory_items ii 
                       WHERE ii.drying_id = dp.id
                   ))
                GROUP BY db.batch_id
            ),
            gudang_gabah_info AS (
                SELECT 
                    batch_id,
                    SUM(remaining_weight_kg) as gabah_kering_kg
                FROM trx.inventory_items
                WHERE product_category_code LIKE 'GABAH%' 
                  AND status = 'AVAILABLE'
                  AND batch_id IS NOT NULL
                GROUP BY batch_id
            ),
            milling_info AS (
                SELECT 
                    COALESCE(ii.batch_id, pb.batch_id) as batch_id,
                    COUNT(p.id) as active_milling_count,
                    SUM(p.gabah_reserved_kg) as penggilingan_kg
                FROM trx.processes p
                LEFT JOIN trx.inventory_items ii ON p.inventory_item_id = ii.id
                LEFT JOIN trx.process_batches pb ON pb.process_id = p.id
                WHERE p.status = 'IN_PROGRESS'
                GROUP BY COALESCE(ii.batch_id, pb.batch_id)
            ),
            gudang_hasil_info AS (
                SELECT 
                    p.batch_id,
                    SUM(ii2.remaining_weight_kg) as hasil_kering_kg
                FROM (
                    SELECT id, COALESCE(
                        (SELECT batch_id FROM trx.inventory_items WHERE id = p.inventory_item_id),
                        (SELECT batch_id FROM trx.process_batches WHERE process_id = p.id LIMIT 1)
                    ) as batch_id
                    FROM trx.processes p
                ) p
                JOIN trx.inventory_items ii2 ON ii2.source_type = 'process' AND ii2.process_id = p.id
                WHERE ii2.status IN ('AVAILABLE', 'RESERVED')
                GROUP BY p.batch_id
            ),
            sales_info AS (
                 SELECT 
                    p.batch_id,
                    SUM(si.qty_ordered - COALESCE(si.qty_delivered, 0)) as pending_delivery_kg,
                    SUM(CASE WHEN s.payment_status = 'PAID' THEN si.qty_ordered ELSE 0 END) as paid_sales_kg
                 FROM (
                    SELECT id, COALESCE(
                        (SELECT batch_id FROM trx.inventory_items WHERE id = p.inventory_item_id),
                        (SELECT batch_id FROM trx.process_batches WHERE process_id = p.id LIMIT 1)
                    ) as batch_id
                    FROM trx.processes p
                 ) p
                 JOIN trx.inventory_items ii ON ii.source_type = 'process' AND ii.process_id = p.id
                 JOIN trx.sale_items si ON si.inventory_item_id = ii.id
                 JOIN trx.sales s ON s.id = si.sale_id
                 WHERE s.status != 'VOID'
                 GROUP BY p.batch_id
            )
            SELECT 
                b.*,
                COALESCE(d.active_drying_count, 0) as active_drying_count,
                COALESCE(d.pengeringan_kg, 0) as pengeringan_kg,
                COALESCE(g.gabah_kering_kg, 0) as gabah_kering_kg,
                COALESCE(m.active_milling_count, 0) as active_milling_count,
                COALESCE(m.penggilingan_kg, 0) as penggilingan_kg,
                COALESCE(gh.hasil_kering_kg, 0) as gudang_beras_kg,
                COALESCE(s.pending_delivery_kg, 0) as pending_delivery_kg,
                COALESCE(s.paid_sales_kg, 0) as penjualan_kg
            FROM batch_base b
            LEFT JOIN drying_info d ON b.batch_id = d.batch_id
            LEFT JOIN gudang_gabah_info g ON b.batch_id = g.batch_id
            LEFT JOIN milling_info m ON b.batch_id = m.batch_id
            LEFT JOIN gudang_hasil_info gh ON b.batch_id = gh.batch_id
            LEFT JOIN sales_info s ON b.batch_id = s.batch_id
            ORDER BY b.batch_date DESC;
        `;

        const result = await db.query(query, params);
        
        const timeline = result.rows.map(row => {
            const pengeringanKg = parseFloat(row.pengeringan_kg) || 0;
            const penggilinganKg = parseFloat(row.penggilingan_kg) || 0;
            const gabahKeringKgRaw = parseFloat(row.gabah_kering_kg) || 0;
            const gudangBerasInventoryKg = parseFloat(row.gudang_beras_kg) || 0;
            
            const pendingDeliveryKg = parseFloat(row.pending_delivery_kg) || 0;
            const penjualanKg = parseFloat(row.penjualan_kg) || 0;

            const gabahKeringKg = Math.max(0, gabahKeringKgRaw - penggilinganKg);
            const gudangBerasKg = Math.max(0, gudangBerasInventoryKg - pendingDeliveryKg);

            const pengeringanPhase = parseInt(row.active_drying_count) > 0;
            const gudangGabahPhase = gabahKeringKg > 0;
            const penggilinganPhase = parseInt(row.active_milling_count) > 0;
            const gudangBerasPhase = gudangBerasKg > 0;
            const penjualanPhase = penjualanKg > 0;

            const belanjaPhase = !pengeringanPhase && !gudangGabahPhase && !penggilinganPhase && !gudangBerasPhase && !penjualanPhase;

            const totalActivity = parseFloat(row.remaining_kg) + parseInt(row.active_drying_count) + 
                                  gabahKeringKg + parseInt(row.active_milling_count) + 
                                  gudangBerasKg;

            const isCompleted = totalActivity === 0 && row.batch_status === 'CLOSED';

            return {
                batchId: row.batch_id,
                batchName: `${row.farmers || 'Tanpa Nama'} - ${new Date(row.batch_date).toLocaleDateString('id-ID')}`,
                totalQtyKg: parseFloat(row.total_qty_kg),
                phases: {
                    belanja: belanjaPhase,
                    pengeringan: pengeringanPhase,
                    gudang_gabah: gudangGabahPhase,
                    penggilingan: penggilinganPhase,
                    gudang_beras: gudangBerasPhase,
                    penjualan: penjualanPhase
                },
                amounts: {
                    pengeringan_kg: pengeringanKg,
                    gudang_gabah_kg: gabahKeringKg,
                    penggilingan_kg: penggilinganKg,
                    gudang_beras_kg: gudangBerasKg,
                    penjualan_kg: penjualanKg
                },
                isCompleted
            };
        });

        return timeline.filter(t => !t.isCompleted);
    }
};

module.exports = dashboardService;
