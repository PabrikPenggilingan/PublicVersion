/**
 * Inventory Service - FIFO inventory management
 */

const {
    inventoryItemsModel,
    inventorySacksModel,
    inventoryTransactionsModel,
    batchesModel,
    dryingProcessesModel,
    dryingBatchesModel
} = require('../models');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const logsService = require('./logger.service');

class InventoryService {
    /**
     * Create manual inventory item (for gabah kering direct)
     * Also handles Gabah Titipan Basah and Kering creation.
     */
    async createManualItem(command) {
        const isTitipanBasah = command.sourceType === 'titipan_basah';
        const isTitipanKering = command.sourceType === 'titipan_kering';
        const isTitipan = isTitipanBasah || isTitipanKering || command.sourceType === 'titipan' || command.isTitipan === true;

        // Validate source for regular batch
        if (command.sourceType === 'batch' && command.batchId) {
            const batch = await batchesModel.findById(command.batchId);
            if (!batch) throw new NotFoundError('Batch tidak ditemukan');
        }

        // For titipan, derive weight from data.weightKg or titipanData (no sacks)
        const totalWeightKg = isTitipan
            ? (parseFloat(command.weightKg) || parseFloat(command.titipanData?.beratKg) || 0)
            : 0;

        console.log('--- CREATING MANUAL ITEM ---', {
            type: command.sourceType,
            weightInput: command.weightKg,
            parsedTotalWeightKg: totalWeightKg
        });

        // Determine product category code safely based on DB reality
        let defaultCategory = 'GABAH_KERING';
        if (isTitipanBasah) defaultCategory = 'GABAH_BASAH';
        
        const finalCategoryCode = command.productCategoryCode || defaultCategory;

        // Create inventory item
        const item = await inventoryItemsModel.create({
            sourceType: command.sourceType, 
            batchId: command.batchId || null,
            dryingId: command.dryingId || null,
            area: command.area,
            tanda: command.tanda,
            kualitas: command.kualitas,
            avgPricePerKg: command.avgPricePerKg || 0,
            totalWeightKg: totalWeightKg,
            remainingWeightKg: totalWeightKg,
            totalSacks: 0,
            remainingSacks: 0,
            productCategoryCode: finalCategoryCode,
            notes: isTitipan
                ? (command.notes || `Gabah Titipan. Pemilik: ${command.titipanData?.pemilikNama || '-'}`)
                : command.notes,
            isTitipan: isTitipan,
            titipanSubtype: isTitipanBasah ? 'basah' : (isTitipanKering ? 'kering' : null),
            titipanData: isTitipan ? command.titipanData : null,
            createdBy: command.userId
        });

        // Add sacks if provided (regular items only)
        if (!isTitipan && command.sacks && command.sacks.length > 0) {
            await inventorySacksModel.createBulk(item.id, command.sacks);
            await inventoryItemsModel.updateWeightsFromSacks(item.id);
        }

        // Create transaction
        const updatedItem = await inventoryItemsModel.findById(item.id);
        await inventoryTransactionsModel.create({
            inventoryItemId: item.id,
            transactionType: 'IN',
            weightKg: updatedItem.total_weight_kg,
            sackCount: updatedItem.total_sacks,
            referenceType: command.sourceType,
            referenceId: command.batchId || command.dryingId,
            notes: isTitipan ? `Gabah Titipan ${isTitipanBasah ? 'Basah' : 'Kering'} masuk` : 'Manual entry',
            createdBy: command.userId
        });

        return this.getItemById(item.id);
    }

    /**
     * Create inventory items from approved drying process
     * Creates one item per batch in the drying
     */
    async createFromDrying(command) {
        const drying = await dryingProcessesModel.findById(command.dryingId);
        if (!drying) throw new NotFoundError('Pengeringan tidak ditemukan');

        // Check if drying is already associated with inventory
        // (Optional: prevent duplicate transfers if needed)

        // IMPORT drying service to get end session
        const dryingService = require('./drying.service');
        const startSession = await dryingService.getStartSessionByDryingId(command.dryingId);
        const endSession = await dryingService.getEndSessionByDryingId(command.dryingId);

        let finalTonnage = 0;
        const w1 = (startSession && startSession.tonnage_kg) ? parseFloat(startSession.tonnage_kg) : parseFloat(drying.total_tonnage || 0);
        let explicitEndTonnage = (endSession && endSession.tonnage_kg) ? parseFloat(endSession.tonnage_kg) : 0;

        if (startSession && endSession && w1 > 0) {
            const x1 = (parseFloat(startSession.moisture_content) || 0) / 100;
            const x2 = (parseFloat(endSession.moisture_content) || 0) / 100;

            if (x1 > 0 && x2 > 0 && x2 < 1) {
                finalTonnage = w1 * (1 - x1) / (1 - x2);
            } else if (explicitEndTonnage > 0) {
                finalTonnage = explicitEndTonnage;
            } else {
                finalTonnage = w1;
            }
        } else if (explicitEndTonnage > 0) {
            finalTonnage = explicitEndTonnage;
        } else {
            finalTonnage = w1;
        }

        finalTonnage = Math.round(finalTonnage);

        if (drying.status !== 'COMPLETED') {
            throw new BusinessRuleError('Pengeringan harus sudah selesai (COMPLETED)');
        }

        const createdItems = [];

        if (drying.is_titipan) {
            const titipanData = typeof drying.titipan_data === 'string' ? JSON.parse(drying.titipan_data) : (drying.titipan_data || {});
            const weight = finalTonnage || parseFloat(titipanData.beratKg) || 0;

            if (drying.titipan_inventory_id) {
                // Update existing titipan item instead of duplicating
                const item = await inventoryItemsModel.update(drying.titipan_inventory_id, {
                    titipan_subtype: 'kering',
                    product_category_code: 'GABAH_KERING',
                    area: command.area || '',
                    tanda: command.tanda || '',
                    total_weight_kg: Number(parseFloat(weight).toFixed(2)),
                    remaining_weight_kg: Number(parseFloat(weight).toFixed(2)),
                    drying_id: command.dryingId,
                    notes: command.notes || `Gabah Titipan dari pengeringan: ${drying.name}. Pemilik: ${titipanData.pemilikNama || '-'}`
                });
                
                createdItems.push(item);

                const shrinkage = Math.max(0, w1 - weight);
                await inventoryTransactionsModel.create({
                    inventoryItemId: item.id,
                    transactionType: 'ADJUST',
                    weightKg: shrinkage,
                    sackCount: 0,
                    referenceType: 'drying',
                    referenceId: command.dryingId,
                    notes: `Penyusutan dan perubahan status ke kering dari pengeringan: ${drying.name}`,
                    createdBy: command.userId
                });
            } else {
                // Legacy titipan handling
                const item = await inventoryItemsModel.create({
                    sourceType: 'drying',
                    batchId: null,
                    dryingId: command.dryingId,
                    productCategoryCode: 'GABAH_KERING',
                    area: command.area || '',
                    tanda: command.tanda || '',
                    kualitas: titipanData.kualitas || command.kualitas || 'biasa',
                    avgPricePerKg: 0,
                    totalWeightKg: Number(parseFloat(weight).toFixed(2)),
                    remainingWeightKg: Number(parseFloat(weight).toFixed(2)),
                    totalSacks: 0,
                    remainingSacks: 0,
                    notes: command.notes || `Gabah Titipan dari pengeringan: ${drying.name}. Pemilik: ${titipanData.pemilikNama || '-'}`,
                    createdBy: command.userId,
                    isTitipan: true,
                    titipanSubtype: 'kering',
                    titipanData: titipanData
                });

                createdItems.push(item);

                await inventoryTransactionsModel.create({
                    inventoryItemId: item.id,
                    transactionType: 'IN',
                    weightKg: item.total_weight_kg,
                    sackCount: 0,
                    referenceType: 'drying',
                    referenceId: command.dryingId,
                    notes: `Transfer dari pengeringan titipan: ${drying.name}`,
                    createdBy: command.userId
                });
            }
        } else {
            // Get linked batches for regular drying
            const linkedBatches = await dryingBatchesModel.getByDryingId(command.dryingId);
            if (!linkedBatches || linkedBatches.length === 0) {
                throw new BusinessRuleError('Pengeringan tidak memiliki batch. Hubungkan batch terlebih dahulu di Detail Pengeringan.');
            }

            // Calculate tonnage per batch if multiple batches (split equally for now)
            const tonnagePerBatch = finalTonnage / linkedBatches.length;

            // Create one inventory item per batch
            for (const link of linkedBatches) {
                const batch = await batchesModel.findById(link.batch_id);

                // 1. Calculate raw material purchase cost for this batch
                const priceResult = await require('../config/database').query(
                    `SELECT
                        COALESCE(SUM(total_harga), 0) as total_cost,
                        COALESCE(SUM(berat_gabah_kg), 0) as total_weight
                     FROM trx.purchases WHERE batch_id = $1`,
                    [link.batch_id]
                );
                const rawCost = parseFloat(priceResult.rows[0].total_cost) || 0;

                // 2. Calculate logistics transport cost for this batch (Option B)
                const transportResult = await require('../config/database').query(
                    `SELECT COALESCE(SUM(lt.operational_cost), 0) as transport_cost
                     FROM trx.logistics_tasks lt
                     JOIN trx.purchases p ON lt.reference_id = p.id
                     WHERE lt.reference_type = 'PURCHASE' AND p.batch_id = $1`,
                    [link.batch_id]
                );
                const transportCost = parseFloat(transportResult.rows[0].transport_cost) || 0;

                // 3. Calculate drying costs for this drying process
                const dryingCostResult = await require('../config/database').query(
                    `SELECT COALESCE(SUM(amount), 0) as total_drying_cost
                     FROM trx.drying_costs WHERE drying_id = $1`,
                    [command.dryingId]
                );
                const totalDryingCost = parseFloat(dryingCostResult.rows[0].total_drying_cost) || 0;
                const batchDryingCost = linkedBatches.length > 0 ? (totalDryingCost / linkedBatches.length) : totalDryingCost;

                // 4. Total Accumulated Cost (Bahan Baku + Logistik + Jemur)
                const totalAccumulatedCost = rawCost + transportCost + batchDryingCost;

                // 5. HPP Gabah Kering per kg (menyerap biaya & penyusutan bobot air)
                const outputWeight = parseFloat(tonnagePerBatch) || 0;
                const calculatedHppPerKg = outputWeight > 0 
                    ? Number((totalAccumulatedCost / outputWeight).toFixed(2)) 
                    : 0;

                const item = await inventoryItemsModel.create({
                    sourceType: 'drying',
                    batchId: link.batch_id,
                    dryingId: command.dryingId,
                    productCategoryCode: 'GABAH_KERING',
                    area: command.area || '',
                    tanda: command.tanda || '',
                    avgPricePerKg: (command.avgPricePerKg !== undefined && command.avgPricePerKg !== null && command.avgPricePerKg !== '') ? parseFloat(command.avgPricePerKg) : calculatedHppPerKg,
                    totalWeightKg: Number(parseFloat(tonnagePerBatch).toFixed(2)),
                    remainingWeightKg: Number(parseFloat(tonnagePerBatch).toFixed(2)),
                    totalSacks: 0,
                    remainingSacks: 0,
                    notes: command.notes || `Dari pengeringan: ${drying.name}`,
                    createdBy: command.userId
                });

                // Update hpp_per_kg pada drying_sessions jika ada
                await require('../config/database').query(
                    `UPDATE trx.drying_sessions SET hpp_per_kg = $1 WHERE drying_id = $2`,
                    [calculatedHppPerKg, command.dryingId]
                ).catch(() => {});

                createdItems.push(item);

                // Update batch status to CLOSED
                await batchesModel.update(link.batch_id, { status: 'CLOSED' });

                // Record transaction
                await inventoryTransactionsModel.create({
                    inventoryItemId: item.id,
                    transactionType: 'IN',
                    weightKg: item.total_weight_kg,
                    sackCount: 0,
                    referenceType: 'drying',
                    referenceId: command.dryingId,
                    notes: `Transfer dari pengeringan: ${drying.name}`,
                    createdBy: command.userId
                });
            }
        }

        // Update drying process status to IN_WAREHOUSE now that items are in inventory
        await dryingProcessesModel.update(command.dryingId, { status: 'IN_WAREHOUSE' });

        return Promise.all(createdItems.map(item => this.getItemById(item.id)));
    }

    /**
     * Create inventory item directly from a batch (bypassing drying)
     * Transfers the specified tonnage from batch.remaining_kg to inventory.
     */
    async createFromBatch(command) {
        const batch = await batchesModel.findById(command.batchId);
        if (!batch) throw new NotFoundError('Batch tidak ditemukan');

        const tonnageKg = parseFloat(command.tonnageKg);
        const remainingKg = parseFloat(batch.remaining_kg) || 0;

        if (isNaN(tonnageKg) || tonnageKg <= 0) {
            throw new BusinessRuleError('Tonase transfer harus lebih dari 0');
        }

        if (tonnageKg > remainingKg) {
            throw new BusinessRuleError(`Tonase transfer (${tonnageKg} kg) melebihi sisa batch (${remainingKg} kg)`);
        }

        // Get 'GABAH' category ID
        // Hardcoding 'GABAH' isn't ideal but we don't have category lookup in inventoryItemsModel easily.
        // Wait, inventoryItemsModel handles this or we can just pass categoryCode? No, we don't need categoryCode for inventory_items, we need it if there's a category_id. Actually, the table uses item_category_id, but the create method in inventoryItemsModel might handle it. Let's check how createManualItem does it.
        // Wait, looking at createManualItem above, it doesn't even specify item_category_id or categoryCode.
        // Let's look at `create` in `inventoryItem.model.js` later. Let's just create it similar to `createFromDrying`.

        // Calculate real avg purchase price + logistics transport from purchases linked to this batch
        const priceResult = await require('../config/database').query(
            `SELECT
                COALESCE(SUM(p.total_harga), 0) as total_cost,
                COALESCE(SUM(p.berat_gabah_kg), 0) as total_weight,
                COALESCE(SUM(lt.operational_cost), 0) as total_transport
             FROM trx.purchases p
             LEFT JOIN trx.logistics_tasks lt ON lt.reference_type = 'PURCHASE' AND lt.reference_id = p.id
             WHERE p.batch_id = $1`,
            [command.batchId]
        );
        const batchTotalCost = (parseFloat(priceResult.rows[0].total_cost) || 0) + (parseFloat(priceResult.rows[0].total_transport) || 0);
        const batchTotalWeight = parseFloat(priceResult.rows[0].total_weight) || 0;
        const batchAvgPrice = batchTotalWeight > 0 ? Number((batchTotalCost / batchTotalWeight).toFixed(2)) : 0;

        const item = await inventoryItemsModel.create({
            sourceType: 'batch',
            batchId: command.batchId,
            dryingId: null,
            productCategoryCode: 'GABAH_KERING',
            area: command.area || '',
            tanda: command.tanda || '',
            kualitas: batch.kualitas_gabah || 'biasa',
            avgPricePerKg: batchAvgPrice,
            totalWeightKg: Number(parseFloat(tonnageKg).toFixed(2)),
            remainingWeightKg: Number(parseFloat(tonnageKg).toFixed(2)),
            totalSacks: 0,
            remainingSacks: 0,
            notes: command.notes || `Transfer langsung dari Batch`,
            createdBy: command.userId
        });

        // Update batch remaining_kg
        const newRemaining = Math.max(0, remainingKg - tonnageKg);
        await batchesModel.update(command.batchId, { remaining_kg: newRemaining });

        // Record the transaction
        await inventoryTransactionsModel.create({
            inventoryItemId: item.id,
            transactionType: 'IN',
            weightKg: item.total_weight_kg,
            sackCount: item.total_sacks,
            referenceType: 'batch',
            referenceId: command.batchId,
            notes: command.notes || 'Transfer langsung dari Batch',
            createdBy: command.userId
        });

        return this.getItemById(item.id);
    }

    /**
     * Get all inventory items with FIFO ordering
     */
    async getAllItems(filters = {}, user) {
        const items = await inventoryItemsModel.findAll(filters, user);
        const total = await inventoryItemsModel.count(filters, user);

        return {
            items,
            total,
            page: filters.page || 1,
            totalPages: Math.ceil(total / (filters.limit || 20))
        };
    }

    /**
     * Get available items for FIFO selection
     */
    async getAvailableItemsFIFO(limit = 50) {
        return inventoryItemsModel.findAvailableFIFO(limit);
    }

    /**
     * Get item by ID with sacks
     */
    async getItemById(id, user) {
        const item = await inventoryItemsModel.findById(id, user);
        if (!item) throw new NotFoundError('Item inventory tidak ditemukan');

        // Get sacks
        item.sacks = await inventorySacksModel.getByInventoryItemId(id);

        // Get transactions
        item.transactions = await inventoryTransactionsModel.getByInventoryItemId(id);

        return item;
    }

    /**
     * Update item info (area, tanda, notes)
     */
    async updateItem(command) {
        await this.getItemById(command.id);

        const updated = await inventoryItemsModel.update(command.id, {
            area: command.area,
            tanda: command.tanda,
            notes: command.notes,
            kualitas: command.kualitas
        });

        return this.getItemById(command.id);
    }

    /**
     * Add sacks to inventory item
     */
    async addSacks(command) {
        const item = await this.getItemById(command.itemId);

        if (item.status === 'DEPLETED') {
            throw new BusinessRuleError('Tidak bisa menambah karung ke item yang sudah habis');
        }

        // Get current max sack number
        const existingSacks = await inventorySacksModel.getByInventoryItemId(itemId);
        const maxNumber = existingSacks.length > 0
            ? Math.max(...existingSacks.map(s => s.sack_number))
            : 0;

        // Add new sacks with incremented numbers
        for (let i = 0; i < command.sacks.length; i++) {
            await inventorySacksModel.create({
                inventoryItemId: command.itemId,
                sackNumber: maxNumber + i + 1,
                weightKg: command.sacks[i].weightKg
            });
        }

        // Update totals
        await inventoryItemsModel.updateWeightsFromSacks(command.itemId);

        // Create transaction
        const totalAddedWeight = command.sacks.reduce((sum, s) => sum + parseFloat(s.weightKg), 0);
        await inventoryTransactionsModel.create({
            inventoryItemId: command.itemId,
            transactionType: 'IN',
            weightKg: totalAddedWeight,
            sackCount: command.sacks.length,
            notes: 'Tambah karung',
            createdBy: command.userId
        });

        return this.getItemById(command.itemId);
    }

    /**
     * Take sacks from inventory (for process/sale)
     * FIFO: should select from oldest items first
     */
    async takeSacks(command) {
        const item = await this.getItemById(command.itemId);

        if (item.status === 'DEPLETED') {
            throw new BusinessRuleError('Item ini sudah habis');
        }

        // Validate sacks belong to this item and are available
        const availableSacks = await inventorySacksModel.getAvailableSacks(command.itemId);
        const availableIds = availableSacks.map(s => s.id);

        for (const sackId of command.sackIds) {
            if (!availableIds.includes(sackId)) {
                throw new BusinessRuleError('Karung tidak tersedia atau sudah diambil');
            }
        }

        // Mark sacks as taken
        const takenSacks = await inventorySacksModel.markAsTaken(command.sackIds, command.takenFor, command.referenceId);

        // Update totals
        await inventoryItemsModel.updateWeightsFromSacks(command.itemId);

        // Create transaction
        const totalWeight = takenSacks.reduce((sum, s) => sum + parseFloat(s.weight_kg), 0);
        await inventoryTransactionsModel.create({
            inventoryItemId: command.itemId,
            transactionType: 'OUT',
            weightKg: totalWeight,
            sackCount: command.sackIds.length,
            referenceType: command.takenFor,
            referenceId: command.referenceId,
            notes: `Pengambilan untuk ${command.takenFor}`,
            createdBy: command.userId
        });

        return this.getItemById(command.itemId);
    }

    /**
     * Take stock strictly by weight (for items without sacks like Gabah/Dedak/Menir)
     */
    async takeWeight(command) {
        const item = await this.getItemById(command.itemId);

        if (item.status === 'DEPLETED') {
            throw new BusinessRuleError('Item ini sudah habis');
        }

        const remaining = parseFloat(item.remaining_weight_kg);
        const toTake = parseFloat(command.weightKg);

        if (toTake > remaining) {
            throw new BusinessRuleError(`Jumlah melebihi stok tersedia. Maksimal: ${remaining} kg`);
        }

        // Calculate new remaining weight
        const newRemaining = remaining - toTake;
        const newStatus = newRemaining <= 0 ? 'DEPLETED' : item.status;

        // Update item weight and status
        await inventoryItemsModel.update(command.itemId, {
            remainingWeightKg: newRemaining,
            status: newStatus
        });

        // Create transaction OUT
        await inventoryTransactionsModel.create({
            inventoryItemId: command.itemId,
            transactionType: 'OUT',
            weightKg: toTake,
            sackCount: 0,
            referenceType: command.takenFor,
            referenceId: command.referenceId,
            notes: `Pengambilan ${toTake} kg untuk ${command.takenFor}`,
            createdBy: command.userId
        });

        return this.getItemById(command.itemId);
    }

    /**
     * Get available Gabah Titipan Basah items (for drying batch picker)
     */
    async getAvailableTitipanBasah() {
        return inventoryItemsModel.findAll({ isTitipanBasah: true });
    }

    /**
     * Delete inventory item
     */
    async deleteItem(id) {
        const item = await this.getItemById(id);

        // Check if any sacks have been taken
        const takenSacks = item.sacks?.filter(s => s.is_taken) || [];
        if (takenSacks.length > 0) {
            throw new BusinessRuleError('Tidak bisa menghapus item yang sudah ada karung diambil');
        }

        await inventoryItemsModel.delete(id);
        return { success: true };
    }

    /**
     * Get inventory statistics
     */
    async getStats() {
        const [available, reserved, depleted] = await Promise.all([
            inventoryItemsModel.count({ status: 'AVAILABLE' }),
            inventoryItemsModel.count({ status: 'RESERVED' }),
            inventoryItemsModel.count({ status: 'DEPLETED' })
        ]);

        const allItems = await inventoryItemsModel.findAll({ status: 'AVAILABLE' });
        const totalRemainingWeight = allItems.reduce((sum, item) => sum + parseFloat(item.remaining_weight_kg || 0), 0);
        const totalRemainingSacks = allItems.reduce((sum, item) => sum + parseInt(item.remaining_sacks || 0), 0);

        return {
            counts: { available, reserved, depleted },
            totalRemainingWeight,
            totalRemainingSacks
        };
    }

    /**
     * Return titipan gabah to penitip (changes status to PAYMENT_PROCESSING)
     */
    async returnTitipan(id, userId, feeAmount = 0, feeNotes = '') {
        const item = await this.getItemById(id);
        
        if (!item.is_titipan) {
            throw new BusinessRuleError('Item ini bukan titipan');
        }
        
        if (item.status !== 'AVAILABLE') {
            throw new BusinessRuleError('Item ini tidak tersedia untuk dikembalikan (status harus AVAILABLE)');
        }

        const oldStatus = item.status;
        const newStatus = 'PAYMENT_PROCESSING';

        const updated = await inventoryItemsModel.update(id, {
            status: newStatus
        });

        // If there's a fee, create a PENDING journal entry
        if (feeAmount > 0) {
            const financeModel = require('../models/finance.model');
            const db = require('../config/database');
            
            // Look up Jasa Titipan revenue account (e.g. 4-200 or 4-100)
            // Using 4-100 (Pendapatan Jasa Giling/Titip) as default
            const revRes = await db.query(`SELECT id FROM trx.finance_accounts WHERE account_code = '4-100' LIMIT 1`);
            
            if (revRes.rows[0]) {
                const titipanData = typeof item.titipan_data === 'string' ? JSON.parse(item.titipan_data) : (item.titipan_data || {});
                const owner = titipanData.pemilikNama || 'Unknown';
                
                await financeModel.createJournalEntry({
                    referenceType: 'TITIPAN_FEE',
                    referenceId: id,
                    description: feeNotes || `Biaya Jasa Titipan/Giling (${owner})`,
                    status: 'PENDING',
                    createdBy: userId,
                    lines: [
                        { accountId: null, debit: Number(feeAmount), credit: 0 },
                        { accountId: revRes.rows[0].id, debit: 0, credit: Number(feeAmount) }
                    ]
                });
            }
        }

        // Log transaction
        await logsService.log({
            userId,
            action: 'UPDATE',
            entityType: 'INVENTORY_ITEM',
            entityId: id,
            oldData: { status: oldStatus },
            newData: { status: newStatus }
        });

        return this.getItemById(id);
    }
}

module.exports = new InventoryService();
