const { batchesModel } = require('../models');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const batchPaymentModel = require('../models/batchPayment.model');
const { NotFoundError } = require('../utils/errors');

class BatchService {
  async createBatch(command) {
    const batchData = {
      createdBy: command.userId,
      batchDate: command.batchDate,
      status: command.status || 'OPEN',
      jenisGabah: command.jenisGabah
    };

    const batch = await batchesModel.create(batchData);
    return batch;
  }

  async getBatchById(id) {
    const batch = await batchesModel.findById(id);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }
    return batch;
  }

  async getAllBatches(filters, limit, offset) {
    const batches = await batchesModel.getAll(filters, limit, offset);
    const total = await batchesModel.count(filters);
    return { batches, total };
  }

  async updateBatch(command) {
    const batch = await this.getBatchById(command.id);
    
    const updatedBatch = await batchesModel.update(command.id, command.data);
    return updatedBatch;
  }

  async deleteBatch(id) {
    const batch = await this.getBatchById(id);
    
    const deletedBatch = await batchesModel.delete(id);
    return deletedBatch;
  }

  // =========================================================================
  // MANAGERIAL INSIGHT: BATCH MARGIN REPORT (UNIT ECONOMICS, BERAS ONLY)
  // -------------------------------------------------------------------------
  // Total Cost   = gabah purchase + purchase transport + drying costs + milling costs
  //                (everything spent until beras is obtained; sales transport excluded)
  // Unit Cost    = Total Cost / beras obtained (kg)
  // Unit Revenue = beras sales income / beras sold (kg)   — based on qty_delivered
  //                (returns already reduce sale_items.qty_delivered, see saleV2.model createReturn)
  // Unit Margin  = Unit Revenue - Unit Cost
  // Total Profit = Unit Margin * beras sold (kg)
  // Strict multi-tenancy: only batches created by the requesting user.
  // =========================================================================
  async getBatchMarginReport(batchId, userId) {
    await this.getOwnedBatch(batchId, userId);
    const [report] = await this._queryMarginReports({ userId, batchId, limit: 1 });
    if (!report) {
      throw new NotFoundError('Batch not found');
    }
    return report;
  }

  async getAllBatchMarginReports(userId, limit = 10) {
    if (!userId) return [];
    return this._queryMarginReports({ userId, batchId: null, limit });
  }

  async _queryMarginReports({ userId, batchId, limit }) {
    const db = require('../config/database');
    const query = `
      WITH batch_list AS (
        SELECT id, batch_date, status, jenis_gabah
        FROM trx.batches
        WHERE created_by = ANY($1::uuid[])
          AND ($2::uuid IS NULL OR id = $2::uuid)
        ORDER BY batch_date DESC
        LIMIT $3
      ),
      -- Each milling process belongs to exactly one batch (its input stock first,
      -- else its earliest linked batch) so costs/output are never counted twice.
      process_batch AS (
        SELECT
          p.id AS process_id,
          COALESCE(
            input_ii.batch_id,
            (SELECT pb.batch_id FROM trx.process_batches pb
             WHERE pb.process_id = p.id
             ORDER BY pb.created_at, pb.batch_id
             LIMIT 1)
          ) AS batch_id
        FROM trx.processes p
        LEFT JOIN trx.inventory_items input_ii ON p.inventory_item_id = input_ii.id
      ),
      purchases_agg AS (
        SELECT batch_id, SUM(total_harga) AS raw_material_cost
        FROM trx.purchases
        WHERE batch_id IN (SELECT id FROM batch_list)
        GROUP BY batch_id
      ),
      logistics_agg AS (
        SELECT p.batch_id, SUM(lt.operational_cost) AS transport_cost
        FROM trx.logistics_tasks lt
        JOIN trx.purchases p ON lt.reference_id = p.id
        WHERE p.batch_id IN (SELECT id FROM batch_list)
          AND lt.reference_type = 'PURCHASE'
        GROUP BY p.batch_id
      ),
      drying_agg AS (
        SELECT db.batch_id, SUM(dc.amount) AS drying_cost
        FROM trx.drying_costs dc
        JOIN trx.drying_batches db ON dc.drying_id = db.drying_id
        WHERE db.batch_id IN (SELECT id FROM batch_list)
        GROUP BY db.batch_id
      ),
      milling_agg AS (
        SELECT pb.batch_id, SUM(pc.amount) AS milling_cost
        FROM trx.process_costs pc
        JOIN process_batch pb ON pb.process_id = pc.process_id
        WHERE pb.batch_id IN (SELECT id FROM batch_list)
        GROUP BY pb.batch_id
      ),
      output_agg AS (
        SELECT pb.batch_id, SUM(ii.total_weight_kg) AS rice_obtained_kg
        FROM trx.inventory_items ii
        JOIN process_batch pb ON pb.process_id = ii.process_id
        WHERE ii.source_type = 'process'
          AND ii.product_category_code = 'BERAS'
          AND pb.batch_id IN (SELECT id FROM batch_list)
        GROUP BY pb.batch_id
      ),
      rice_sale_lines AS (
        SELECT
          COALESCE(pb.batch_id, ii.batch_id) AS batch_id,
          si.unit_price,
          si.qty_delivered,
          CASE WHEN si.unit_type = 'SACK' THEN COALESCE(ii.packaging_size_kg, 0) ELSE 1 END AS kg_per_unit
        FROM trx.sale_items si
        JOIN trx.sales s ON s.id = si.sale_id
        JOIN trx.inventory_items ii ON ii.id = si.inventory_item_id
        LEFT JOIN process_batch pb ON pb.process_id = ii.process_id
        WHERE si.category_code = 'BERAS'
          AND s.status NOT IN ('VOID', 'DRAFT')
      ),
      sales_agg AS (
        SELECT
          l.batch_id,
          SUM(l.unit_price * l.qty_delivered) AS rice_revenue,
          SUM(l.qty_delivered * l.kg_per_unit) AS rice_sold_kg
        FROM rice_sale_lines l
        WHERE l.batch_id IN (SELECT id FROM batch_list)
        GROUP BY l.batch_id
      )
      SELECT
        b.id AS "batchId",
        b.batch_date AS "batchDate",
        b.status,
        b.jenis_gabah AS "jenisGabah",
        COALESCE(p.raw_material_cost, 0) AS "rawMaterial",
        COALESCE(l.transport_cost, 0) AS "transport",
        COALESCE(d.drying_cost, 0) AS "drying",
        COALESCE(m.milling_cost, 0) AS "milling",
        COALESCE(o.rice_obtained_kg, 0) AS "riceObtainedKg",
        COALESCE(s.rice_revenue, 0) AS "riceRevenue",
        COALESCE(s.rice_sold_kg, 0) AS "riceSoldKg"
      FROM batch_list b
      LEFT JOIN purchases_agg p ON b.id = p.batch_id
      LEFT JOIN logistics_agg l ON b.id = l.batch_id
      LEFT JOIN drying_agg d ON b.id = d.batch_id
      LEFT JOIN milling_agg m ON b.id = m.batch_id
      LEFT JOIN output_agg o ON b.id = o.batch_id
      LEFT JOIN sales_agg s ON b.id = s.batch_id
      ORDER BY b.batch_date DESC;
    `;
    const result = await db.query(query, [tenantIds().length ? tenantIds() : [userId], batchId, limit]);
    return result.rows.map(row => {
      const rawMaterial = parseFloat(row.rawMaterial) || 0;
      const transport = parseFloat(row.transport) || 0;
      const drying = parseFloat(row.drying) || 0;
      const milling = parseFloat(row.milling) || 0;
      const totalCost = rawMaterial + transport + drying + milling;

      const riceObtainedKg = parseFloat(row.riceObtainedKg) || 0;
      const riceRevenue = parseFloat(row.riceRevenue) || 0;
      const riceSoldKg = parseFloat(row.riceSoldKg) || 0;

      // null = not computable yet (no beras milled / none sold)
      const unitCost = riceObtainedKg > 0 ? totalCost / riceObtainedKg : null;
      const unitRevenue = riceSoldKg > 0 ? riceRevenue / riceSoldKg : null;
      const unitMargin = unitCost !== null && unitRevenue !== null ? unitRevenue - unitCost : null;
      const totalProfit = unitMargin !== null ? unitMargin * riceSoldKg : null;

      return {
        batchId: row.batchId,
        batchDate: row.batchDate,
        status: row.status,
        jenisGabah: row.jenisGabah,
        financials: {
          costs: {
            rawMaterial,
            transport,
            drying,
            milling,
            total: totalCost
          },
          riceObtainedKg,
          riceSoldKg,
          riceRevenue,
          unitCost,
          unitRevenue,
          unitMargin,
          totalProfit
        }
      };
    });
  }

  // ─── Batch Debt (Hutang Pembelian) ─────────────────────────────────
  // Strict multi-tenancy: a tenant may only see/pay debt of its own batches.
  // Responds 404 (not 403) so other tenants' batch IDs are not revealed.
  async getOwnedBatch(batchId, userId) {
    const batch = await batchesModel.findById(batchId);
    if (!batch || !userId || !(batch.created_by === userId || inTenant(batch.created_by))) {
      throw new NotFoundError('Batch not found');
    }
    return batch;
  }

  async getBatchDebt(batchId, userId) {
    await this.getOwnedBatch(batchId, userId);
    return batchPaymentModel.getDebt(batchId);
  }

  async createBatchPayment(command) {
    await this.getOwnedBatch(command.batchId, command.userId);
    await batchPaymentModel.create(command.batchId, command, command.userId);
    return batchPaymentModel.getDebt(command.batchId);
  }
}

module.exports = new BatchService();
