/**
 * Process Service - Milling flow management
 * v2: Inventory-linked gabah reservation, HPP, rendemen, sack fix
 */

const {
    processesModel,
    processBatchesModel,
    processCostModel,
    batchesModel,
    inventoryItemsModel,
    inventorySacksModel,
    inventoryTransactionsModel
} = require('../models');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const { PROCESS_MAX_BATCHES } = require('../utils/constants');
const { ownershipChecks } = require('../utils/authGuards');
const db = require('../config/database');

class ProcessService {

    // ================================================================
    // START PROCESS — reserve gabah dari inventory
    // ================================================================
    async startProcess(command) {
        const { inventoryItemId, gabahReservedKg, processDate, notes } = command;

        // Validate: inventory item must exist, be AVAILABLE, and be GABAH
        if (!inventoryItemId) throw new BusinessRuleError('Pilih item gabah dari inventory terlebih dahulu');
        if (!gabahReservedKg || parseFloat(gabahReservedKg) <= 0) throw new BusinessRuleError('Jumlah gabah yang akan digiling harus diisi');

        const gabahItem = await inventoryItemsModel.findById(inventoryItemId);
        if (!gabahItem) throw new NotFoundError('Item inventory gabah tidak ditemukan');
        if (gabahItem.status !== 'AVAILABLE') throw new BusinessRuleError('Gabah tidak tersedia (status bukan AVAILABLE)');
        if (gabahItem.product_category_code !== 'GABAH_BASAH' && gabahItem.product_category_code !== 'GABAH_KERING') {
            throw new BusinessRuleError('Item yang dipilih bukan kategori GABAH_BASAH atau GABAH_KERING');
        }

        const reserved = parseFloat(gabahReservedKg);
        if (reserved > parseFloat(gabahItem.remaining_weight_kg)) {
            throw new BusinessRuleError(
                `Jumlah melebihi stok gabah. Tersedia: ${gabahItem.remaining_weight_kg} kg, Diminta: ${reserved} kg`
            );
        }

        // Reserve gabah inventory
        await inventoryItemsModel.update(inventoryItemId, { status: 'RESERVED' });

        // Log transaction RESERVED
        await inventoryTransactionsModel.create({
            inventoryItemId,
            transactionType: 'RESERVED',
            weightKg: reserved,
            sackCount: 0,
            referenceType: 'process',
            referenceId: null, // will be filled after create
            notes: `Direservasi untuk proses giling`,
            createdBy: command.userId
        });

        // Create process record
        const process = await processesModel.create({
            createdBy: command.userId,
            processDate: processDate || new Date(),
            status: 'IN_PROGRESS',
            notes: notes || null,
            inventoryItemId,
            gabahReservedKg: reserved
        });

        return process;
    }

    // ================================================================
    // GET SINGLE
    // ================================================================
    async getProcessById(id) {
        const process = await processesModel.findByIdWithDetails(id);
        if (!process) throw new NotFoundError('Proses tidak ditemukan');
        return process;
    }

    // ================================================================
    // GET ALL
    // ================================================================
    async getAllProcesses(filters, limit, offset) {
        const processes = await processesModel.getAll(filters, limit, offset);
        const total = await processesModel.count(filters);
        return { processes, total };
    }

    // ================================================================
    // UPDATE
    // ================================================================
    async updateProcess(command) {
        await this.getProcessById(command.id);
        return processesModel.update(command.id, command.data);
    }

    // ================================================================
    // DELETE
    // ================================================================
    async deleteProcess(id) {
        const process = await this.getProcessById(id);

        // Unreserve gabah jika masih IN_PROGRESS
        if (process.status === 'IN_PROGRESS' && process.inventory_item_id) {
            await inventoryItemsModel.update(process.inventory_item_id, { status: 'AVAILABLE' });
        }

        return processesModel.delete(id);
    }

    // ================================================================
    // CANCEL PROCESS — kembalikan gabah ke AVAILABLE
    // ================================================================
    async cancelProcess(command) {
        const process = await this.getProcessById(command.id);
        if (process.status !== 'IN_PROGRESS') throw new BusinessRuleError('Hanya proses yang sedang berjalan yang bisa dibatalkan');

        // Update status
        await processesModel.update(command.id, {
            status: 'CANCELLED',
            notes: command.reason ? `[DIBATALKAN] ${command.reason}` : process.notes
        });

        // Unreserve gabah → kembali AVAILABLE
        if (process.inventory_item_id) {
            await inventoryItemsModel.update(process.inventory_item_id, { status: 'AVAILABLE' });

            await inventoryTransactionsModel.create({
                inventoryItemId: process.inventory_item_id,
                transactionType: 'UNRESERVED',
                weightKg: process.gabah_reserved_kg || 0,
                sackCount: 0,
                referenceType: 'process',
                referenceId: command.id,
                notes: 'Proses dibatalkan — gabah dikembalikan ke inventory',
                createdBy: command.userId
            });
        }

        return this.getProcessById(command.id);
    }

    async _resolveGabahPrice(process) {
        let price = parseFloat(process.gabah_price_per_kg || 0);
        if (price > 0) return price;

        const db = require('../config/database');
        if (process.inventory_item_id) {
            const invRes = await db.query(
                `SELECT ii.batch_id, ii.avg_price_per_kg FROM trx.inventory_items ii WHERE ii.id = $1`,
                [process.inventory_item_id]
            );
            if (invRes.rows[0]) {
                price = parseFloat(invRes.rows[0].avg_price_per_kg || 0);
                if (price <= 0 && invRes.rows[0].batch_id) {
                    const bRes = await db.query(
                        `SELECT 
                            (COALESCE(SUM(p.total_harga), 0) + COALESCE(SUM(lt.operational_cost), 0)) / NULLIF(SUM(p.berat_gabah_kg), 0) as avg_p 
                         FROM trx.purchases p
                         LEFT JOIN trx.logistics_tasks lt ON lt.reference_type = 'PURCHASE' AND lt.reference_id = p.id
                         WHERE p.batch_id = $1`,
                        [invRes.rows[0].batch_id]
                    );
                    price = parseFloat(bRes.rows[0]?.avg_p || 0);
                }
            }
        }
        if (price <= 0) {
            const fallbackRes = await db.query(
                `SELECT COALESCE(SUM(total_harga) / NULLIF(SUM(berat_gabah_kg), 0), 5000) as avg_p FROM trx.purchases WHERE berat_gabah_kg > 0 AND payment_status != 'VOID'`
            );
            price = parseFloat(fallbackRes.rows[0]?.avg_p || 5000);
        }
        return price;
    }

    // ================================================================
    // COMPLETE PROCESS — catat output, hitung rendemen & HPP, fix sacks
    // ================================================================
    async completeProcess(command) {
        const process = await this.getProcessById(command.id);
        if (process.status === 'COMPLETED') throw new BusinessRuleError('Proses sudah selesai');
        if (process.status !== 'IN_PROGRESS') throw new BusinessRuleError('Hanya proses IN_PROGRESS yang bisa diselesaikan');

        // -------- Validasi outputs --------
        if (!command.outputs || !Array.isArray(command.outputs) || command.outputs.length === 0) {
            throw new BusinessRuleError('Minimal satu output produksi harus diisi');
        }

        // -------- Hitung total gabah yang dipakai --------
        const gabahUsedKg = parseFloat(process.gabah_reserved_kg || 0);

        // -------- Hitung total beras dan total output dulu untuk HPP dan Rendemen --------
        let totalBerasKg = 0;
        let totalOutputKg = 0;
        for (const out of command.outputs) {
            const weight = parseFloat(out.weight_kg) || 0;
            totalOutputKg += weight;
            if ((out.category || '').toUpperCase() === 'BERAS') {
                totalBerasKg += weight;
            }
        }

        // -------- Hitung HPP --------
        const processCostModel = require('../models/processCost.model');
        const totalExtraCosts = await processCostModel.getTotalByProcessId(command.id);
        const resolvedGabahPrice = await this._resolveGabahPrice(process);
        const gabahCostTotal = gabahUsedKg * resolvedGabahPrice;
        const totalCost = gabahCostTotal + totalExtraCosts;
        const hppPerKg = totalBerasKg > 0
            ? Number((totalCost / totalBerasKg).toFixed(2))
            : 0;

        // -------- Tentukan origin batch_id --------
        const originBatchId = process.gabah_batch_id || (process.batches && process.batches[0] ? process.batches[0].batch_id : null);

        // -------- Buat inventory items dari outputs --------
        const createdItems = [];

        for (const out of command.outputs) {
            const weightKg  = parseFloat(out.weight_kg) || 0;
            const sackCount = parseInt(out.sacks)       || 0;
            let category    = (out.category || '').toUpperCase();
            // Handle field name mismatch from frontend (pack_size vs packaging_size_kg)
            const packSize  = parseFloat(out.packaging_size_kg || out.pack_size) || null;

            if (weightKg <= 0) continue;
            if (category === 'BERAS' && sackCount <= 0) {
                throw new BusinessRuleError(`Jumlah karung untuk kategori BERAS harus diisi`);
            }

            // -------- Mapping Kategori agar sesuai Master Data (FK Constraint) --------
            let originalCategory = category;
            let displayNotes = out.notes || '';

            if (category === 'MENIR' || category === 'DEDAK') {
                category = 'TURUNAN';
                displayNotes = `[${originalCategory}] ${displayNotes}`.trim();
            } else if (category === 'SEKAM') {
                category = 'LIMBAH';
                displayNotes = `[SEKAM] ${displayNotes}`.trim();
            } else if (category === 'BROKEN') {
                category = 'BERAS';
                displayNotes = `[BROKEN] ${displayNotes}`.trim();
            }

            // Hitung berat per karung (weight_kg per sack)
            const weightPerSack = sackCount > 0 ? Number((weightKg / sackCount).toFixed(3)) : 0;

            // Buat inventory item
            const item = await inventoryItemsModel.create({
                sourceType:          'process',
                processId:           command.id,
                batchId:             originBatchId,
                productCategoryCode: category,
                totalWeightKg:       weightKg,
                remainingWeightKg:   weightKg,
                totalSacks:          sackCount,
                remainingSacks:      sackCount,
                status:              'AVAILABLE',
                avgPricePerKg:       category === 'BERAS' ? hppPerKg : 0, // Set HPP hanya untuk Beras (Option 1)
                packagingSizeKg:     packSize,
                notes:               displayNotes || null,
                isTitipan:           process.gabah_is_titipan,
                titipanSubtype:      process.gabah_titipan_subtype,
                createdBy:           command.userId
            });

            // Buat sacks dengan weight_kg yang benar (FIX BUG: field name)
            if (sackCount > 0) {
                const sacksData = Array.from({ length: sackCount }, (_, i) => ({
                    sack_number: i + 1,
                    weight_kg:   weightPerSack  // ← field name konsisten dengan DB
                }));
                await this._createSacksBulk(item.id, sacksData);

                // Recalculate totals dari sacks yang baru dibuat
                await inventoryItemsModel.updateWeightsFromSacks(item.id);
            }

            // Log transaksi IN
            await inventoryTransactionsModel.create({
                inventoryItemId: item.id,
                transactionType: 'IN',
                weightKg,
                sackCount,
                referenceType: 'process',
                referenceId:   command.id,
                notes:         `Output penggilingan: ${category}`,
                createdBy:     command.userId
            });

            createdItems.push(item);
        }

        if (parseFloat(command.sekamKg) > 0) {
            const sekamWeight = parseFloat(command.sekamKg);
            const item = await inventoryItemsModel.create({
                sourceType:          'process',
                processId:           command.id,
                batchId:             originBatchId,
                productCategoryCode: 'LIMBAH',
                totalWeightKg:       sekamWeight,
                remainingWeightKg:   sekamWeight,
                totalSacks:          0,
                remainingSacks:      0,
                status:              'AVAILABLE',
                avgPricePerKg:       0,
                packagingSizeKg:     null,
                notes:               `[SEKAM] ${command.sekamNotes || ''}`.trim(),
                isTitipan:           process.gabah_is_titipan,
                titipanSubtype:      process.gabah_titipan_subtype,
                createdBy:           command.userId
            });

            await inventoryTransactionsModel.create({
                inventoryItemId: item.id,
                transactionType: 'IN',
                weightKg:        sekamWeight,
                sackCount:       0,
                referenceType:   'process',
                referenceId:     command.id,
                notes:           `Output penggilingan: LIMBAH (Sekam)`,
                createdBy:       command.userId
            });

            createdItems.push(item);
        }

        // -------- Hitung rendemen --------
        const rendemenPctRaw = gabahUsedKg > 0
            ? Number(((totalBerasKg / gabahUsedKg) * 100).toFixed(2))
            : 0;
        const rendemenPct = Math.min(rendemenPctRaw, 999.99); // Prevent numeric(5,2) overflow


        // -------- Update proses: COMPLETED --------
        await processesModel.update(command.id, {
            status:         'COMPLETED',
            endDate:        new Date(),
            notes:          command.notes || process.notes,
            gabahUsedKg:    gabahUsedKg,
            totalInputKg:   gabahUsedKg,
            sekamKg:        parseFloat(command.sekamKg) || 0,
            sekamNotes:     command.sekamNotes || null,
            wasteKg:        parseFloat(command.wasteKg) || 0,
            wasteReason:    command.wasteReason || null,
            rendemenPct:    rendemenPct,
            hppPerKg:       hppPerKg
        });

        // -------- Submit Deferred Process Costs --------
        const financeModel = require('../models/finance.model');
        const expId = await financeModel.getRequiredAccountId('5-400');

        // Fetch all costs where financeTransactionId IS NULL
        const costsResult = await db.query(`SELECT * FROM trx.process_costs WHERE process_id = $1 AND finance_transaction_id IS NULL`, [command.id]);
        
        for (const c of costsResult.rows) {
            const financeTx = await financeModel.createJournalEntry({
                referenceType: 'MILLING',
                referenceId: command.id,
                description: `Biaya Giling ${process.process_no || ''}: ${c.description || c.cost_type}`,
                status: 'PENDING',
                createdBy: command.userId,
                lines: [
                    { accountId: expId, debit: Number(c.amount), credit: 0 },
                    { accountId: null, debit: 0, credit: Number(c.amount) }
                ]
            });
            await db.query(`UPDATE trx.process_costs SET finance_transaction_id = $1 WHERE id = $2`, [financeTx.id, c.id]);
        }

        // -------- Update stok gabah: RESERVED → DEPLETED/AVAILABLE --------
        if (process.inventory_item_id) {
            const gabahItem = await inventoryItemsModel.findById(process.inventory_item_id);
            const sisa = parseFloat(gabahItem.remaining_weight_kg || 0) - gabahUsedKg;

            if (sisa <= 0) {
                await inventoryItemsModel.update(process.inventory_item_id, { status: 'DEPLETED', remainingWeightKg: 0 });
            } else {
                // Ada sisa: kembalikan AVAILABLE dengan sisa berat
                await inventoryItemsModel.update(process.inventory_item_id, {
                    remainingWeightKg: sisa,
                    status: 'AVAILABLE'
                });
            }

            // Log transaksi OUT gabah
            await inventoryTransactionsModel.create({
                inventoryItemId: process.inventory_item_id,
                transactionType: 'OUT',
                weightKg:        gabahUsedKg,
                sackCount:       0,
                referenceType:   'process',
                referenceId:     command.id,
                notes:           `Terpakai untuk penggilingan. Rendemen beras: ${rendemenPct}%`,
                createdBy:       command.userId
            });
        }

        return createdItems;
    }

    // ================================================================
    // HELPER: createBulk sacks (dengan field name yang benar)
    // ================================================================
    async _createSacksBulk(inventoryItemId, sacks) {
        const db = require('../config/database');
        for (let i = 0; i < sacks.length; i++) {
            await db.query(
                `INSERT INTO trx.inventory_sacks (inventory_item_id, sack_number, weight_kg)
                 VALUES ($1, $2, $3)`,
                [inventoryItemId, sacks[i].sack_number, sacks[i].weight_kg]
            );
        }
    }

    // ================================================================
    // ATTACH BATCH (legacy support)
    // ================================================================
    async attachBatch(command) {
        const process = await processesModel.findById(command.processId);
        if (!process) throw new NotFoundError('Process not found');

        const batch = await batchesModel.findById(command.batchId);
        if (!batch) throw new NotFoundError('Batch not found');

        const batchCount = await processBatchesModel.countByProcessId(command.processId);
        if (batchCount >= PROCESS_MAX_BATCHES) {
            throw new BusinessRuleError(`Maximum ${PROCESS_MAX_BATCHES} batches allowed per process`);
        }

        if (parseFloat(batch.remaining_kg) < command.qtyUsedKg) {
            throw new BusinessRuleError(
                `Batch tidak cukup. Tersedia: ${batch.remaining_kg} kg, Diminta: ${command.qtyUsedKg} kg`
            );
        }

        return processBatchesModel.create({ processId: command.processId, batchId: command.batchId, qtyUsedKg: command.qtyUsedKg });
    }

    async detachBatch(processId, batchId) {
        const process = await processesModel.findById(processId);
        if (!process) throw new NotFoundError('Process not found');

        // processBatchesModel.delete already scopes by both processId AND batchId,
        // so if it returns null the combination doesn't exist on this process.
        const deleted = await processBatchesModel.delete(processId, batchId);
        if (!deleted) throw new NotFoundError('Batch is not attached to this process');

        return deleted;
    }

    async getProcessBatches(processId) {
        return processBatchesModel.findByProcessId(processId);
    }

    // ================================================================
    // PROCESS COSTS (HPP)
    // ================================================================
    async addProcessCost(command) {
        const processDetails = await this.getProcessById(command.processId); // validate exists
        const financeModel = require('../models/finance.model');
        const db = require('../config/database');

        // 1. Check if process is COMPLETED. If so, create PENDING Finance Transaction immediately.
        let financeTx = null;
        if (processDetails.status === 'COMPLETED') {
            const expId = await financeModel.getRequiredAccountId('5-400');

            financeTx = await financeModel.createJournalEntry({
                referenceType: 'MILLING',
                referenceId: command.processId,
                description: `Biaya Giling ${processDetails.process_no || ''}: ${command.costData.description || command.costData.costType}`,
                status: 'PENDING',
                createdBy: command.userId,
                lines: [
                    { accountId: expId, debit: Number(command.costData.amount), credit: 0 },
                    { accountId: null, debit: 0, credit: Number(command.costData.amount) }
                ]
            });
        }

        // 2. Create Process Cost record
        const cost = await processCostModel.create({
            processId:   command.processId,
            costType:    command.costData.costType,
            description: command.costData.description,
            amount:      command.costData.amount,
            financeTransactionId: financeTx ? financeTx.id : null,
            createdBy:   command.userId
        });

        // 3. Recalculate HPP if process is COMPLETED
        const process = await processesModel.findById(command.processId);
        if (process.status === 'COMPLETED' && process.gabah_used_kg > 0) {
            const totalExtraCosts = await processCostModel.getTotalByProcessId(command.processId);
            const resolvedPrice = await this._resolveGabahPrice(process);
            const gabahCost = parseFloat(process.gabah_used_kg) * resolvedPrice;
            const outputItems = await inventoryItemsModel.findAll({ processId: command.processId, categoryCode: 'BERAS' });
            const totalBeras = outputItems.reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);

            if (totalBeras > 0) {
                const newHpp = Number(((gabahCost + totalExtraCosts) / totalBeras).toFixed(2));
                await processesModel.update(command.processId, { hppPerKg: newHpp });
            }
        }

        return cost;
    }

    async getProcessCosts(processId) {
        await this.getProcessById(processId);
        return processCostModel.getByProcessId(processId);
    }

    async deleteProcessCost(processId, costId) {
        await this.getProcessById(processId);
        // Verify cost belongs to this process before deleting
        await ownershipChecks.processCost(costId, processId, 'Biaya tidak ditemukan untuk proses ini');
        const deleted = await processCostModel.delete(costId);
        if (!deleted) throw new NotFoundError('Biaya tidak ditemukan');

        if (deleted.finance_transaction_id) {
            const db = require('../config/database');
            const financeModel = require('../models/finance.model');
            const jeId = deleted.finance_transaction_id; // already stores journal_entries.id

            const jeResult = await db.query(
                'SELECT id, status, created_by FROM trx.journal_entries WHERE id = $1',
                [jeId]
            );

            if (jeResult.rows[0]) {
                const je = jeResult.rows[0];
                if (je.status === 'APPROVED') {
                    // Build a reversal (void) journal to maintain audit trail
                    const linesRes = await db.query(
                        'SELECT account_id, debit, credit FROM trx.journal_lines WHERE journal_id = $1',
                        [je.id]
                    );
                    if (linesRes.rows.length > 0) {
                        await financeModel.createJournalEntry({
                            referenceType: 'VOID',
                            referenceId: je.id,
                            description: `Void: Hapus Biaya Giling (${deleted.description || deleted.cost_type})`,
                            status: 'APPROVED',
                            createdBy: je.created_by || null,
                            lines: linesRes.rows.map(l => ({
                                accountId: l.account_id,
                                debit: Number(l.credit),   // swap debit↔credit for reversal
                                credit: Number(l.debit)
                            }))
                        });
                    }
                } else {
                    // PENDING → safe to delete directly (no balance impact yet)
                    await db.query('DELETE FROM trx.journal_lines WHERE journal_id = $1', [je.id]);
                    await db.query('DELETE FROM trx.journal_entries WHERE id = $1', [je.id]);
                }
            }
        }

        // Recalculate HPP if process is COMPLETED
        const process = await processesModel.findById(processId);
        if (process.status === 'COMPLETED' && process.gabah_used_kg > 0) {
            const totalExtraCosts = await processCostModel.getTotalByProcessId(processId);
            const resolvedPrice = await this._resolveGabahPrice(process);
            const gabahCost = parseFloat(process.gabah_used_kg) * resolvedPrice;
            const outputItems = await inventoryItemsModel.findAll({ processId, categoryCode: 'BERAS' });
            const totalBeras = outputItems.reduce((s, i) => s + parseFloat(i.total_weight_kg || 0), 0);

            if (totalBeras > 0) {
                const newHpp = Number(((gabahCost + totalExtraCosts) / totalBeras).toFixed(2));
                await processesModel.update(processId, { hppPerKg: newHpp });
            }
        }

        return deleted;
    }
}

module.exports = new ProcessService();
