const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const inventoryItemsModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.inventory_items
               (source_type, batch_id, drying_id, process_id, product_category_code,
                area, tanda, kualitas, avg_price_per_kg,
                total_weight_kg, remaining_weight_kg, total_sacks, remaining_sacks,
                status, entry_date, notes, packaging_size_kg, created_by,
                is_titipan, titipan_subtype, titipan_data)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
             RETURNING *`,
            [
                data.sourceType, data.batchId || null, data.dryingId || null,
                data.processId || null, data.productCategoryCode || 'GABAH_KERING',
                data.area || null, data.tanda || null, data.kualitas || null,
                data.avgPricePerKg || 0,
                data.totalWeightKg, data.remainingWeightKg,
                data.totalSacks, data.remainingSacks,
                data.status || 'AVAILABLE',
                data.entryDate || new Date(),
                data.notes || null,
                data.packagingSizeKg || null,
                data.createdBy,
                data.isTitipan || false,
                data.titipanSubtype || null,
                data.titipanData ? JSON.stringify(data.titipanData) : null
            ]
        );
        return result.rows[0];
    },

    async findById(id, user) {
        // CTE computes sale_reserved_kg once; outer SELECT aliases jenis_gabah->jenisGabah
        // and derives available_weight_kg without any duplicate subqueries.
        const result = await db.query(
            `WITH item_data AS (
               SELECT
                 ii.*,
                 ii.is_titipan,
                 ii.titipan_subtype,
                 ii.titipan_data,
                 b.batch_date,
                 b.total_qty_kg AS initial_batch_weight_kg,
                 dp.name AS drying_name,
                 COALESCE(
                   ii.titipan_data->>'jenisGabah',
                   ii.titipan_data->>'jenis_gabah',
                   b.jenis_gabah,
                   dp.titipan_data->>'jenisGabah',
                   dp.titipan_data->>'jenis_gabah',
                   drying_batch_jg.jenis_gabah,
                   process_jg.jg,
                   process_batch_jg.jenis_gabah
                 ) AS jenis_gabah,
                 cat.name      AS category_name,
                 cat.color_hex AS category_color,
                 cat.icon      AS category_icon,
                 (
                   SELECT COALESCE(SUM(si.qty_ordered - si.qty_delivered), 0)
                   FROM trx.sale_items si
                   JOIN trx.sales s ON si.sale_id = s.id
                   WHERE si.inventory_item_id = ii.id
                   AND s.status IN ('DRAFT', 'CONFIRMED', 'PARTIAL_DELIVERED')
                 ) AS sale_reserved_kg
               FROM trx.inventory_items ii
               LEFT JOIN trx.batches b               ON ii.batch_id = b.id
               LEFT JOIN trx.drying_processes dp     ON ii.drying_id = dp.id
               LEFT JOIN mst.item_categories cat     ON ii.product_category_code = cat.code
               LEFT JOIN LATERAL (
                 SELECT b2.jenis_gabah
                 FROM trx.drying_batches db2
                 JOIN trx.batches b2 ON db2.batch_id = b2.id
                 WHERE db2.drying_id = ii.drying_id AND b2.jenis_gabah IS NOT NULL
                 LIMIT 1
               ) drying_batch_jg ON true
               LEFT JOIN LATERAL (
                 SELECT COALESCE(ii2.titipan_data->>'jenisGabah', ii2.titipan_data->>'jenis_gabah', b3.jenis_gabah) AS jg
                 FROM trx.processes pr
                 JOIN trx.inventory_items ii2 ON pr.inventory_item_id = ii2.id
                 LEFT JOIN trx.batches b3 ON ii2.batch_id = b3.id
                 WHERE pr.id = ii.process_id
                 LIMIT 1
               ) process_jg ON true
               LEFT JOIN LATERAL (
                 SELECT b4.jenis_gabah
                 FROM trx.process_batches pb
                 JOIN trx.batches b4 ON pb.batch_id = b4.id
                 WHERE pb.process_id = ii.process_id AND b4.jenis_gabah IS NOT NULL
                 LIMIT 1
               ) process_batch_jg ON true
               WHERE ii.id = $1
             )
             SELECT
               *,
               jenis_gabah                            AS "jenisGabah",
               (remaining_weight_kg - sale_reserved_kg) AS available_weight_kg
             FROM item_data`,
            [id]
        );
        return result.rows[0];
    },

    async findAll(filters = {}, user) {
        // Build WHERE conditions first, then inject into a single CTE-based query.
        // CTEs (sale_res, sack_avail) aggregate across the whole table once — O(1) instead of O(n).
        // LATERAL JOINs replace correlated subqueries for jenis_gabah fallback chain.
        const conditions = [];
        const params = [];
        let paramCount = 0;

        if (filters.status) {
            paramCount++;
            conditions.push(`ii.status = $${paramCount}`);
            params.push(filters.status);
        } else if (filters.includeDepleted !== 'true' && filters.includeDepleted !== true) {
            // Default behavior: hide depleted items unless specifically requested
            conditions.push(`ii.status != 'DEPLETED'`);
        }

        if (filters.sourceType) {
            paramCount++;
            conditions.push(`ii.source_type = $${paramCount}`);
            params.push(filters.sourceType);
        }

        if (filters.processId) {
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(filters.processId)) {
                paramCount++;
                conditions.push(`ii.process_id = $${paramCount}`);
                params.push(filters.processId);
            } else {
                conditions.push(`1=0`);
            }
        }

        if (filters.categoryCode) {
            const categories = filters.categoryCode.split(',');
            if (categories.length > 0) {
                const placeholders = categories.map((_, i) => `$${paramCount + i + 1}`).join(',');
                conditions.push(`ii.product_category_code IN (${placeholders})`);
                params.push(...categories);
                paramCount += categories.length;
            }
        }

        if (filters.isTitipan !== undefined && filters.isTitipan !== null && filters.isTitipan !== '') {
            paramCount++;
            conditions.push(`ii.is_titipan = $${paramCount}`);
            params.push(filters.isTitipan === 'true' || filters.isTitipan === true);
        }

        if (filters.titipanSubtype) {
            paramCount++;
            conditions.push(`ii.titipan_subtype = $${paramCount}`);
            params.push(filters.titipanSubtype);
        }

        if (filters.isTitipanBasah) {
            conditions.push(`ii.is_titipan = true`);
            conditions.push(`ii.titipan_subtype = 'basah'`);
            conditions.push(`ii.status = 'AVAILABLE'`);
            conditions.push(`NOT EXISTS (SELECT 1 FROM trx.drying_processes dp2 WHERE dp2.titipan_inventory_id = ii.id AND dp2.status != 'CANCELLED')`);
        }

        const store = requestContext.getStore();
        const ctxUser = store?.user;
        if (ctxUser) {
            paramCount++;
            conditions.push(`ii.created_by = ANY($${paramCount}::uuid[])`);
            params.push(tenantIds(ctxUser));
        }

        const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
        const orderBy = filters.fifo ? `ORDER BY ii.entry_date ASC` : `ORDER BY ii.created_at DESC`;

        let limitClause = '';
        if (filters.limit) {
            paramCount++;
            limitClause = `LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        let offsetClause = '';
        if (filters.offset) {
            paramCount++;
            offsetClause = `OFFSET $${paramCount}`;
            params.push(filters.offset);
        }

        const query = `
          WITH sale_res AS (
            SELECT
              si.inventory_item_id,
              COALESCE(SUM(si.qty_ordered - si.qty_delivered), 0) AS reserved_kg
            FROM trx.sale_items si
            JOIN trx.sales s ON si.sale_id = s.id
            WHERE s.status IN ('DRAFT', 'CONFIRMED', 'PARTIAL_DELIVERED')
            GROUP BY si.inventory_item_id
          ),
          sack_avail AS (
            SELECT inventory_item_id, COUNT(*) AS available_count
            FROM trx.inventory_sacks
            WHERE is_taken = false
            GROUP BY inventory_item_id
          )
          SELECT
            ii.*,
            ii.is_titipan,
            ii.titipan_subtype,
            ii.titipan_data,
            b.batch_date,
            b.total_qty_kg AS initial_batch_weight_kg,
            dp.name AS drying_name,
            COALESCE(
              ii.titipan_data->>'jenisGabah',
              ii.titipan_data->>'jenis_gabah',
              b.jenis_gabah,
              dp.titipan_data->>'jenisGabah',
              dp.titipan_data->>'jenis_gabah',
              drying_batch_jg.jenis_gabah,
              process_jg.jg,
              process_batch_jg.jenis_gabah
            ) AS jenis_gabah,
            COALESCE(
              ii.titipan_data->>'jenisGabah',
              ii.titipan_data->>'jenis_gabah',
              b.jenis_gabah,
              dp.titipan_data->>'jenisGabah',
              dp.titipan_data->>'jenis_gabah',
              drying_batch_jg.jenis_gabah,
              process_jg.jg,
              process_batch_jg.jenis_gabah
            ) AS "jenisGabah",
            cat.name      AS category_name,
            cat.color_hex AS category_color,
            cat.icon      AS category_icon,
            COALESCE(sack_avail.available_count, 0)                       AS available_sacks,
            COALESCE(sale_res.reserved_kg, 0)                             AS sale_reserved_kg,
            (ii.remaining_weight_kg - COALESCE(sale_res.reserved_kg, 0)) AS available_weight_kg
          FROM trx.inventory_items ii
          LEFT JOIN trx.batches b           ON ii.batch_id = b.id
          LEFT JOIN trx.drying_processes dp ON ii.drying_id = dp.id
          LEFT JOIN mst.item_categories cat ON ii.product_category_code = cat.code
          LEFT JOIN sale_res               ON sale_res.inventory_item_id = ii.id
          LEFT JOIN sack_avail             ON sack_avail.inventory_item_id = ii.id
          LEFT JOIN LATERAL (
            SELECT b2.jenis_gabah
            FROM trx.drying_batches db2
            JOIN trx.batches b2 ON db2.batch_id = b2.id
            WHERE db2.drying_id = ii.drying_id AND b2.jenis_gabah IS NOT NULL
            LIMIT 1
          ) drying_batch_jg ON true
          LEFT JOIN LATERAL (
            SELECT COALESCE(ii2.titipan_data->>'jenisGabah', ii2.titipan_data->>'jenis_gabah', b3.jenis_gabah) AS jg
            FROM trx.processes pr
            JOIN trx.inventory_items ii2 ON pr.inventory_item_id = ii2.id
            LEFT JOIN trx.batches b3 ON ii2.batch_id = b3.id
            WHERE pr.id = ii.process_id
            LIMIT 1
          ) process_jg ON true
          LEFT JOIN LATERAL (
            SELECT b4.jenis_gabah
            FROM trx.process_batches pb
            JOIN trx.batches b4 ON pb.batch_id = b4.id
            WHERE pb.process_id = ii.process_id AND b4.jenis_gabah IS NOT NULL
            LIMIT 1
          ) process_batch_jg ON true
          WHERE 1=1 ${whereClause}
          ${orderBy}
          ${limitClause}
          ${offsetClause}
        `;

        const result = await db.query(query, params);
        return result.rows;
    },

    /**
     * Get all active item categories from MST schema
     */
    async getCategories() {
        const result = await db.query(
            `SELECT code, name, description, color_hex, icon, sort_order
             FROM mst.item_categories
             WHERE is_active = true
             ORDER BY sort_order ASC`
        );
        return result.rows;
    },

    /**
     * Get category summary: total stock per category
     */
    async getCategoryStats() {
        const store = requestContext.getStore();
        const ctxUser = store?.user;
        let query = `
             SELECT
               cat.code,
               cat.name,
               cat.color_hex,
               cat.icon,
               COUNT(ii.id)                              as item_count,
               COALESCE(SUM(ii.remaining_weight_kg), 0)  as total_remaining_kg,
               COALESCE(SUM(ii.remaining_sacks), 0)      as total_remaining_sacks
             FROM mst.item_categories cat
             LEFT JOIN trx.inventory_items ii
               ON cat.code = ii.product_category_code AND ii.status != 'DEPLETED'`;
               
        const params = [];
        if (ctxUser) {
            query += ` AND ii.created_by = ANY($1::uuid[])`;
            params.push(tenantIds(ctxUser));
        }

        query += `
             WHERE cat.is_active = true
             GROUP BY cat.code, cat.name, cat.color_hex, cat.icon, cat.sort_order
             ORDER BY cat.sort_order ASC`;

        const result = await db.query(query, params);
        return result.rows;
    },

    async findAvailableFIFO(limit = 50) {
        const store = requestContext.getStore();
        const ctxUser = store?.user;
        let whereClause = "ii.status = 'AVAILABLE' AND ii.remaining_weight_kg > 0";
        const params = [limit];

        if (ctxUser) {
            whereClause += " AND ii.created_by = ANY($2::uuid[])";
            params.push(tenantIds(ctxUser));
        }

        const result = await db.query(
            `WITH sale_res AS (
               SELECT
                 si.inventory_item_id,
                 COALESCE(SUM(si.qty_ordered - si.qty_delivered), 0) AS reserved_kg
               FROM trx.sale_items si
               JOIN trx.sales s ON si.sale_id = s.id
               WHERE s.status IN ('DRAFT', 'CONFIRMED', 'PARTIAL_DELIVERED')
               GROUP BY si.inventory_item_id
             )
             SELECT
               ii.*,
               b.batch_date,
               b.total_qty_kg AS initial_batch_weight_kg,
               dp.name AS drying_name,
               COALESCE(
                 ii.titipan_data->>'jenisGabah',
                 ii.titipan_data->>'jenis_gabah',
                 b.jenis_gabah,
                 dp.titipan_data->>'jenisGabah',
                 dp.titipan_data->>'jenis_gabah',
                 drying_batch_jg.jenis_gabah,
                 process_jg.jg,
                 process_batch_jg.jenis_gabah
               ) AS jenis_gabah,
               COALESCE(
                 ii.titipan_data->>'jenisGabah',
                 ii.titipan_data->>'jenis_gabah',
                 b.jenis_gabah,
                 dp.titipan_data->>'jenisGabah',
                 dp.titipan_data->>'jenis_gabah',
                 drying_batch_jg.jenis_gabah,
                 process_jg.jg,
                 process_batch_jg.jenis_gabah
               ) AS "jenisGabah",
               COALESCE(sale_res.reserved_kg, 0)                             AS sale_reserved_kg,
               (ii.remaining_weight_kg - COALESCE(sale_res.reserved_kg, 0)) AS available_weight_kg
             FROM trx.inventory_items ii
             LEFT JOIN trx.batches b           ON ii.batch_id = b.id
             LEFT JOIN trx.drying_processes dp ON ii.drying_id = dp.id
             LEFT JOIN sale_res               ON sale_res.inventory_item_id = ii.id
             LEFT JOIN (
               SELECT db2.drying_id, MAX(b2.jenis_gabah) as jenis_gabah
               FROM trx.drying_batches db2
               JOIN trx.batches b2 ON db2.batch_id = b2.id
               WHERE b2.jenis_gabah IS NOT NULL
               GROUP BY db2.drying_id
             ) drying_batch_jg ON drying_batch_jg.drying_id = ii.drying_id
             LEFT JOIN (
               SELECT pr.id as process_id, MAX(COALESCE(ii2.titipan_data->>'jenisGabah', ii2.titipan_data->>'jenis_gabah', b3.jenis_gabah)) as jg
               FROM trx.processes pr
               JOIN trx.inventory_items ii2 ON pr.inventory_item_id = ii2.id
               LEFT JOIN trx.batches b3 ON ii2.batch_id = b3.id
               GROUP BY pr.id
             ) process_jg ON process_jg.process_id = ii.process_id
             LEFT JOIN (
               SELECT pb.process_id, MAX(b4.jenis_gabah) as jenis_gabah
               FROM trx.process_batches pb
               JOIN trx.batches b4 ON pb.batch_id = b4.id
               WHERE b4.jenis_gabah IS NOT NULL
               GROUP BY pb.process_id
             ) process_batch_jg ON process_batch_jg.process_id = ii.process_id
             WHERE ${whereClause}
             ORDER BY ii.entry_date ASC
             LIMIT $1`,
            params
        );
        return result.rows;
    },

    async update(id, data) {
        const fields = [];
        const values = [];
        let paramCount = 0;

        const allowedFields = [
            'area', 'tanda', 'kualitas', 'avg_price_per_kg', 'total_weight_kg',
            'remaining_weight_kg', 'total_sacks', 'remaining_sacks', 'status',
            'notes', 'packaging_size_kg', 'titipan_subtype', 'drying_id',
            'source_type', 'titipan_data', 'product_category_code'
        ];

        for (const [key, value] of Object.entries(data)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey)) {
                paramCount++;
                fields.push(`${snakeKey} = $${paramCount}`);
                values.push(value);
            }
        }

        if (fields.length === 0) return this.findById(id);

        paramCount++;
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(id);

        const result = await db.query(
            `UPDATE trx.inventory_items SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        return result.rows[0];
    },

    async updateWeightsFromSacks(id) {
        const result = await db.query(
            `UPDATE trx.inventory_items 
       SET total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM trx.inventory_sacks WHERE inventory_item_id = $1),
           remaining_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM trx.inventory_sacks WHERE inventory_item_id = $1 AND is_taken = false),
           total_sacks = (SELECT COUNT(*) FROM trx.inventory_sacks WHERE inventory_item_id = $1),
           remaining_sacks = (SELECT COUNT(*) FROM trx.inventory_sacks WHERE inventory_item_id = $1 AND is_taken = false),
           status = CASE 
             WHEN (SELECT COUNT(*) FROM trx.inventory_sacks WHERE inventory_item_id = $1 AND is_taken = false) = 0 THEN 'DEPLETED'
             ELSE status 
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.inventory_items WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    },

    async count(filters = {}, user) {
        let query = 'SELECT COUNT(*) as total FROM trx.inventory_items ii WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (filters.status) {
            paramCount++;
            query += ` AND ii.status = $${paramCount}`;
            params.push(filters.status);
        }

        if (filters.sourceType) {
            paramCount++;
            query += ` AND ii.source_type = $${paramCount}`;
            params.push(filters.sourceType);
        }

        if (filters.categoryCode) {
            const categories = filters.categoryCode.split(',');
            if (categories.length > 0) {
                const placeholders = categories.map((_, i) => `$${paramCount + i + 1}`).join(',');
                query += ` AND ii.product_category_code IN (${placeholders})`;
                params.push(...categories);
                paramCount += categories.length;
            }
        }

        if (filters.isTitipan !== undefined && filters.isTitipan !== null && filters.isTitipan !== '') {
            paramCount++;
            query += ` AND ii.is_titipan = $${paramCount}`;
            params.push(filters.isTitipan === 'true' || filters.isTitipan === true);
        }

        if (filters.titipanSubtype) {
            paramCount++;
            query += ` AND ii.titipan_subtype = $${paramCount}`;
            params.push(filters.titipanSubtype);
        }

        const store = requestContext.getStore();
        const ctxUser = store?.user;
        if (ctxUser) {
            paramCount++;
            query += ` AND ii.created_by = ANY($${paramCount}::uuid[])`;
            params.push(tenantIds(ctxUser));
        }

        const result = await db.query(query, params);
        return parseInt(result.rows[0].total);
    }
};

module.exports = inventoryItemsModel;
