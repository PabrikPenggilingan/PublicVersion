const { purchasesModel, batchesModel } = require('../models');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const { BATCH_MAX_PURCHASES } = require('../utils/constants');
const PurchaseMapper = require('../mappers/purchase.mapper');

class PurchaseService {
  async createPurchase(command) {
    const { batchId, userId, purchaseDto } = command;
    // Check if batch exists
    const batch = await batchesModel.findById(batchId);
    if (!batch) {
      throw new NotFoundError('Batch not found');
    }

    // Check max purchases limit
    const purchaseCount = await purchasesModel.countByBatchId(batchId);
    if (purchaseCount >= BATCH_MAX_PURCHASES) {
      throw new BusinessRuleError(`Maximum ${BATCH_MAX_PURCHASES} purchases allowed per batch`);
    }

    // Convert camelCase to snake_case for database
    const purchaseData = PurchaseMapper.toDatabaseCreate(command);
    // Goods value is always harga × berat; the delivered price (incl. transport) goes in total_dibayar
    purchaseData.total_harga = Number(purchaseDto.hargaPerKg) * Number(purchaseDto.beratGabahKg);

    const purchase = await purchasesModel.create(purchaseData);

    const pendataanGabahModel = require('../models/pendataanGabah.model');
    await pendataanGabahModel.create({
      purchaseId: purchase.id,
      createdBy: userId,
      jenisGabah: purchaseDto.jenisGabah || batch.jenis_gabah,
      varietas: purchaseDto.varietas || batch.jenis_gabah,
      kondisiGabah: purchaseDto.kondisiGabah,
      kadarAir: purchaseDto.kadarAir,
      kadarHampa: purchaseDto.kadarHampa
    });

    const financeModel = require('../models/finance.model');
    const db = require('../config/database');

    try {
      const [invId, apId] = await Promise.all([
        financeModel.getRequiredAccountId('1-300'),
        financeModel.getRequiredAccountId('2-100')
      ]);
      await financeModel.createJournalEntry({
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        description: `Pembelian Gabah: ${purchaseDto.nama} (${purchaseDto.beratGabahKg} Kg)`,
        status: 'APPROVED',
        createdBy: userId,
        lines: [
          { accountId: invId, debit: Number(purchase.total_harga), credit: 0 },
          { accountId: apId,  debit: 0, credit: Number(purchase.total_harga) }
        ]
      });
    } catch (journalErr) {
      console.error('[PurchaseService] Gagal buat jurnal pembelian:', journalErr.message);
      throw journalErr; // re-throw agar CoA error kelihatan
    }

    return PurchaseMapper.toResponse(purchase);
  }

  async getPurchaseById(id) {
    const purchase = await purchasesModel.findById(id);
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    return PurchaseMapper.toResponse(purchase);
  }

  async getPurchasesByBatchId(batchId, limit, offset) {
    const purchases = await purchasesModel.getByBatchId(batchId, limit, offset);
    const total = await purchasesModel.countByBatchId(batchId);
    return { purchases: PurchaseMapper.toResponseList(purchases), total };
  }

  async getAllPurchases(limit, offset, filters = {}) {
    let query = 'SELECT * FROM trx.purchases WHERE 1=1';
    const params = [];
    let paramIdx = 1;

    if (filters.paymentStatus) {
      query += ` AND payment_status = $${paramIdx++}`;
      params.push(filters.paymentStatus);
    }
    if (filters.calo) {
      query += ` AND calo ILIKE $${paramIdx++}`;
      params.push(`%${filters.calo}%`);
    }

    const store = requestContext.getStore();
    const user = store?.user;
    const isAdminOnly = user && (user.role || '').toLowerCase() === 'super_admin';
    if (user && !isAdminOnly) {
      query += ` AND batch_id IN (SELECT id FROM trx.batches WHERE created_by = ANY($${paramIdx++}::uuid[]))`;
      params.push(tenantIds(user));
    }

    const countResult = await require('../config/database').query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );
    
    query += ` ORDER BY tanggal_belanja DESC LIMIT $${paramIdx++ } OFFSET $${paramIdx++ }`;
    params.push(limit, offset);

    const result = await require('../config/database').query(query, params);
    
    return { 
      purchases: PurchaseMapper.toResponseList(result.rows), 
      total: parseInt(countResult.rows[0].count) 
    };
  }

  async updatePurchase(command) {
    const { id, userId, purchaseDto } = command;
    const existing = await purchasesModel.findById(id);
    if (!existing) {
      throw new NotFoundError('Purchase not found');
    }

    const updateData = PurchaseMapper.toDatabaseUpdate(command);
    // Keep the goods value in sync with harga × berat (the DB trigger only fills it when NULL)
    if (updateData.harga_per_kg !== undefined || updateData.berat_gabah_kg !== undefined) {
      const harga = Number(updateData.harga_per_kg ?? existing.harga_per_kg);
      const berat = Number(updateData.berat_gabah_kg ?? existing.berat_gabah_kg);
      updateData.total_harga = harga * berat;
    }
    const updatedPurchase = await purchasesModel.update(id, updateData);

    // Goods value changed → post the difference so Persediaan (1-300) / Hutang (2-100) match the purchase
    const delta = Number(updatedPurchase.total_harga) - Number(existing.total_harga);
    if (Math.abs(delta) >= 0.01) {
      const financeModel = require('../models/finance.model');
      const [invId, apId] = await Promise.all([
        financeModel.getRequiredAccountId('1-300'),
        financeModel.getRequiredAccountId('2-100')
      ]);
      const amount = Math.abs(delta);
      await financeModel.createJournalEntry({
        referenceType: 'PURCHASE',
        referenceId: id,
        description: `Koreksi Pembelian Gabah: ${updatedPurchase.nama || ''} (${delta > 0 ? '+' : '-'}Rp ${amount.toLocaleString('id-ID')})`,
        status: 'APPROVED',
        createdBy: userId,
        lines: delta > 0
          ? [
              { accountId: invId, debit: amount, credit: 0 },
              { accountId: apId,  debit: 0, credit: amount }
            ]
          : [
              { accountId: apId,  debit: amount, credit: 0 },
              { accountId: invId, debit: 0, credit: amount }
            ]
      });
    }

    const pendataanGabahModel = require('../models/pendataanGabah.model');
    const existingPendataan = await pendataanGabahModel.findByPurchaseId(id);
    if (existingPendataan) {
        await pendataanGabahModel.update(existingPendataan.id, {
          jenisGabah: purchaseDto.jenisGabah,
          varietas: purchaseDto.varietas,
          kondisiGabah: purchaseDto.kondisiGabah,
          kadarAir: purchaseDto.kadarAir,
          kadarHampa: purchaseDto.kadarHampa
        });
    } else {
        await pendataanGabahModel.create({
          purchaseId: id,
          createdBy: userId,
          jenisGabah: purchaseDto.jenisGabah,
          varietas: purchaseDto.varietas,
          kondisiGabah: purchaseDto.kondisiGabah,
          kadarAir: purchaseDto.kadarAir,
          kadarHampa: purchaseDto.kadarHampa
        });
    }

    return PurchaseMapper.toResponse(updatedPurchase);
  }

  async deletePurchase(id) {
    await this.getPurchaseById(id); // verify existence
    const db = require('../config/database');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      
      // Clean up or reverse any journal entries linked to this purchase
      const jeRes = await client.query(
        `SELECT id, status, created_by FROM trx.journal_entries 
         WHERE reference_type = 'PURCHASE' AND reference_id = $1`,
        [id]
      );
      for (const je of jeRes.rows) {
        if (je.status === 'APPROVED') {
          const linesRes = await client.query('SELECT account_id, debit, credit FROM trx.journal_lines WHERE journal_id = $1', [je.id]);
          const financeModel = require('../models/finance.model');
          await financeModel.createJournalEntry({
            referenceType: 'VOID',
            referenceId: je.id,
            description: `Void: Hapus Pembelian Gabah (${id})`,
            status: 'APPROVED',
            createdBy: je.created_by || null,
            lines: linesRes.rows.map(l => ({
              accountId: l.account_id,
              debit: Number(l.credit),
              credit: Number(l.debit)
            }))
          }, client);
        } else {
          await client.query('DELETE FROM trx.journal_lines WHERE journal_id = $1', [je.id]);
          await client.query('DELETE FROM trx.journal_entries WHERE id = $1', [je.id]);
        }
      }

      const deletedPurchase = await purchasesModel.delete(id);
      await client.query('COMMIT');
      return PurchaseMapper.toResponse(deletedPurchase);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async uploadPhoto(purchaseId, file) {
    const { query } = require('../config/database');
    const result = await query(
      `INSERT INTO trx.purchase_photos (purchase_id, file_path, file_name, file_size)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [purchaseId, file.path, file.originalname, file.size]
    );
    return result.rows[0];
  }
}

module.exports = new PurchaseService();
