const {
    customerModel, priceListModel, saleModel,
    saleItemModel, saleDeliveryModel, salePaymentModel, saleReturnModel,
    inventoryItemsModel
} = require('../models');
const { NotFoundError, BusinessRuleError, ValidationError } = require('../utils/errors');
const { ownershipChecks } = require('../utils/authGuards');
const SalesV2Mapper = require('../mappers/salesV2.mapper');

// ════════════════════════════════════════
// CUSTOMER SERVICE
// ════════════════════════════════════════
class CustomerService {
    async getAll(filters) {
        return customerModel.findAll(filters);
    }

    async getById(id) {
        const customer = await customerModel.findById(id);
        if (!customer) throw new NotFoundError('Pelanggan tidak ditemukan');
        return customer;
    }

    async create(command) {
        if (!command.name?.trim()) throw new ValidationError('Nama pelanggan wajib diisi');
        const data = SalesV2Mapper.toCustomerPersistence(command);
        return customerModel.create(data);
    }

    async update(command) {
        await this.getById(command.id);
        const data = SalesV2Mapper.toCustomerPersistence(command);
        delete data.createdBy; // Do not overwrite createdBy on update
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
        return customerModel.update(command.id, data);
    }

    async deactivate(id) {
        await this.getById(id);
        return customerModel.delete(id);
    }
}

// ════════════════════════════════════════
// PRICE LIST SERVICE
// ════════════════════════════════════════
class PriceListService {
    async getAllTiers() {
        return priceListModel.getAllTiers();
    }

    async getAllPriceLists() {
        return priceListModel.findAll();
    }

    async getPricesByTier(tierId) {
        return priceListModel.getPricesByTier(tierId);
    }

    async getActivePrice(tierId, categoryId, date) {
        return priceListModel.getActivePrice(tierId, categoryId, date);
    }

    async createPrice(command) {
        if (!command.tierId) throw new ValidationError('Tier pelanggan wajib diisi');
        if (!command.categoryId) throw new ValidationError('Kategori produk wajib diisi');
        if (!command.pricePerKg && !command.pricePerSack)
            throw new ValidationError('Harga per Kg atau per Karung wajib diisi');
        const data = SalesV2Mapper.toPricePersistence(command);
        return priceListModel.create(data);
    }

    async deletePrice(id) {
        return priceListModel.delete(id);
    }

    async createTier(command) {
        if (!command.name?.trim()) throw new ValidationError('Nama tier wajib diisi');
        const data = SalesV2Mapper.toPriceTierPersistence(command);
        return priceListModel.createTier(data);
    }
}

// ════════════════════════════════════════
// SALE SERVICE
// ════════════════════════════════════════
class SaleService {
    async getAll(filters) {
        return saleModel.findAll(filters);
    }

    async getById(id) {
        const sale = await saleModel.findById(id);
        if (!sale) throw new NotFoundError('Nota penjualan tidak ditemukan');
        return sale;
    }

    async getDetail(id) {
        const saleShipmentModel = require('../models/saleShipment.model');
        const sale = await saleModel.findById(id);
        if (!sale) throw new NotFoundError('Nota penjualan tidak ditemukan');

        const items = await saleModel.getItems(id);
        const deliveries = await saleModel.getDeliveries(id);
        const payments = await saleModel.getPayments(id);
        const returns = await saleModel.getReturns(id);
        // The truck this nota rides on (may carry other nota too)
        const shipment = await saleShipmentModel.findBySaleId(id);

        // Arus uang: status + bukti kas (BKK) of transport, komisi and potongan for this nota
        const journalIds = {
            transport: shipment?.finance_transaction_id || null,
            commission: shipment?.commission_transaction_id || null,
            deduction: sale.deduction_journal_id || null,
        };
        const ids = Object.values(journalIds).filter(Boolean);
        const cash_flow = {};
        if (ids.length) {
            const db = require('../config/database');
            const res = await db.query(
                `SELECT j.id, j.status, v.voucher_no, v.voucher_date
                 FROM trx.journal_entries j
                 LEFT JOIN trx.cash_voucher_items i ON i.journal_id = j.id
                 LEFT JOIN trx.cash_vouchers v ON v.id = i.voucher_id
                 WHERE j.id = ANY($1::uuid[])`,
                [ids]
            );
            const byId = Object.fromEntries(res.rows.map(r => [r.id, r]));
            for (const [key, jid] of Object.entries(journalIds)) {
                if (jid && byId[jid]) cash_flow[key] = {
                    status: byId[jid].status, voucher_no: byId[jid].voucher_no, voucher_date: byId[jid].voucher_date,
                };
            }
        }

        return { ...sale, items, deliveries, payments, returns, shipment, cash_flow };
    }

    async create(command) {
        const data = SalesV2Mapper.toSalePersistence(command);
        
        // 1. Validate stock if items are provided upfront
        if (data.items?.length > 0) {
            for (const itemData of data.items) {
                if (itemData.inventoryItemId && itemData.qtyOrdered) {
                    const invItem = await inventoryItemsModel.findById(itemData.inventoryItemId);
                    if (!invItem) throw new ValidationError('Item inventory tidak ditemukan');
                    
                    const remaining = parseFloat(invItem.available_weight_kg ?? invItem.remaining_weight_kg ?? 0);
                    if (parseFloat(itemData.qtyOrdered) > remaining) {
                        throw new BusinessRuleError(`Kuantitas order (${itemData.qtyOrdered} Kg) melebihi stok yang tersedia (${remaining} Kg) untuk item ${invItem.product_category_code}`);
                    }
                }
            }
        }

        // 2. Create sale header
        const sale = await saleModel.create(data);

        // 3. Add items
        if (data.items?.length > 0) {
            const itemsWithHpp = await this._enrichItemsWithHpp(data.items);
            await saleItemModel.createBulk(sale.id, itemsWithHpp);
        }

        return saleModel.findById(sale.id);
    }

    async addItem(command) {
        const sale = await this.getById(command.saleId);
        if (!['DRAFT', 'CONFIRMED'].includes(sale.status))
            throw new BusinessRuleError(`Tidak bisa tambah item ke nota dengan status ${sale.status}`);

        // Validate stock
        if (command.inventoryItemId && command.qtyOrdered) {
            const invItem = await inventoryItemsModel.findById(command.inventoryItemId);
            if (!invItem) throw new ValidationError('Item inventory tidak ditemukan');
            
            const remaining = parseFloat(invItem.available_weight_kg ?? invItem.remaining_weight_kg ?? 0);
            if (parseFloat(command.qtyOrdered) > remaining) {
                throw new BusinessRuleError(`Kuantitas order (${command.qtyOrdered} Kg) melebihi stok yang tersedia (${remaining} Kg)`);
            }
        }

        const enriched = await this._enrichItemsWithHpp([command]);
        const items = await saleItemModel.createBulk(command.saleId, enriched);
        return items[0];
    }

    async removeItem(saleId, itemId) {
        const sale = await this.getById(saleId);
        if (sale.status !== 'DRAFT')
            throw new BusinessRuleError('Hanya bisa hapus item pada nota berstatus DRAFT');
        // Verify itemId belongs to this sale
        await ownershipChecks.saleItem(itemId, saleId, 'Item tidak ditemukan dalam nota ini');
        return saleItemModel.delete(itemId);
    }

    // Potongan customer (kuli bongkar, dll): the customer pays less than the nota and the
    // difference is our expense. Nota/revenue stay unchanged; the deduction settles receivable:
    //   Dr 5-700 Beban Kuli Bongkar & Potongan Penjualan / Cr 1-200 Piutang  (PENDING → Finance)
    // While DRAFT only the amount is stored; the journal is posted on confirm.
    _deductionJournal(sale, amount, note, userId, accounts) {
        return {
            referenceType: 'SALE_DEDUCTION',
            referenceId: sale.id,
            description: `Potongan Customer ${sale.sale_no || sale.id}: ${note || 'Kuli bongkar'}`,
            status: 'PENDING',
            createdBy: userId || sale.created_by || null,
            lines: [
                { accountId: accounts.expenseId, debit: amount, credit: 0 },
                { accountId: accounts.arId, debit: 0, credit: amount },
            ],
        };
    }

    async setDeduction(saleId, { amount, note }, userId) {
        const db = require('../config/database');
        const financeModel = require('../models/finance.model');
        const { round2, syncExpenseJournal } = require('../utils/journalSync');

        const value = amount === undefined || amount === null || amount === '' ? 0 : Number(amount);
        if (!Number.isFinite(value) || value < 0) throw new ValidationError('Potongan tidak boleh negatif');
        const deduction = round2(value);
        const cleanNote = (note || '').trim() || null;

        const accounts = deduction > 0 ? {
            expenseId: await financeModel.getRequiredAccountId('5-700'),
            arId: await financeModel.getRequiredAccountId('1-200'),
        } : null;

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const res = await client.query(`SELECT * FROM trx.sales WHERE id = $1 FOR UPDATE`, [saleId]);
            const sale = res.rows[0];
            if (!sale) throw new NotFoundError('Nota penjualan tidak ditemukan');
            if (!['DRAFT', 'CONFIRMED'].includes(sale.status))
                throw new BusinessRuleError(`Potongan tidak bisa diubah pada nota berstatus ${sale.status}`);

            const maxDeduction = round2(Number(sale.total_amount) - Number(sale.paid_amount));
            if (deduction - maxDeduction > 0.009)
                throw new BusinessRuleError(`Potongan melebihi sisa tagihan (Rp ${Math.max(0, maxDeduction).toLocaleString('id-ID')})`);

            let journalId = sale.deduction_journal_id;
            if (sale.status !== 'DRAFT') {
                journalId = await syncExpenseJournal({
                    currentId: sale.deduction_journal_id,
                    amount: deduction,
                    label: 'Potongan customer',
                    build: () => this._deductionJournal(sale, deduction, cleanNote, userId, accounts),
                }, client);
            }

            await client.query(
                `UPDATE trx.sales SET customer_deduction = $2, deduction_note = $3, deduction_journal_id = $4 WHERE id = $1`,
                [saleId, deduction, cleanNote, journalId || null]
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
        return this.getDetail(saleId);
    }

    async confirm(saleId, userId) {
        const sale = await this.getById(saleId);
        if (sale.status !== 'DRAFT')
            throw new BusinessRuleError(`Nota sudah berstatus ${sale.status}, tidak bisa dikonfirmasi`);

        const items = await saleModel.getItems(saleId);
        if (!items.length)
            throw new BusinessRuleError('Tidak bisa konfirmasi nota tanpa item produk');

        // Resolve accounts before changing status so a missing account doesn't leave a confirmed sale without a journal
        const financeModel = require('../models/finance.model');
        const [arId, revId] = await Promise.all([
            financeModel.getRequiredAccountId('1-200'),
            financeModel.getRequiredAccountId('4-100')
        ]);

        const confirmedSale = await saleModel.confirm(saleId);

        // Final sale revenue → PENDING request to Finance. total_amount already reflects returns
        // and biaya tambahan recorded during DRAFT. Payments recorded during DRAFT have no journal
        // of their own; they are the cash part of this entry (cash account assigned on approval).
        const finalAmount = Number(confirmedSale.total_amount);
        const paidAmount = Math.min(Math.max(Number(confirmedSale.paid_amount) || 0, 0), finalAmount);
        const outstandingAmount = finalAmount - paidAmount;
        if (finalAmount > 0) {
            const lines = [];
            if (paidAmount > 0) lines.push({ accountId: null, debit: paidAmount, credit: 0 });       // Pending Cash
            if (outstandingAmount > 0) lines.push({ accountId: arId, debit: outstandingAmount, credit: 0 }); // Piutang
            lines.push({ accountId: revId, debit: 0, credit: finalAmount });                          // Pendapatan

            await financeModel.createJournalEntry({
                referenceType: 'SALE',
                referenceId: saleId,
                description: `Penjualan Beras ${sale.sale_no || saleId}`,
                status: 'PENDING',
                createdBy: userId || sale.created_by || null,
                lines
            });
        }

        // Potongan customer entered during DRAFT → its own PENDING request, after the revenue entry
        const deduction = Number(confirmedSale.customer_deduction) || 0;
        if (deduction > 0) {
            const expenseId = await financeModel.getRequiredAccountId('5-700');
            const je = await financeModel.createJournalEntry(
                this._deductionJournal(confirmedSale, deduction, confirmedSale.deduction_note, userId, { expenseId, arId })
            );
            await saleModel.setDeductionJournal(saleId, je.id);
        }

        // Transport & komisi calo are recorded per truck in Logistik → Pengiriman (saleShipment.service),
        // which can carry several nota; confirming a nota no longer posts them.
        
        return confirmedSale;
    }

    async voidSale(saleId, reason, userId) {
        await this.getById(saleId);
        if (!reason?.trim()) throw new ValidationError('Alasan pembatalan (void_reason) wajib diisi');
        
        const db = require('../config/database');
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const voided = await saleModel.void(saleId, reason, userId);

            // A voided nota no longer rides on its truck (shipment costs stay as recorded)
            const saleShipmentModel = require('../models/saleShipment.model');
            await saleShipmentModel.removeSale(saleId, client);

            // Potongan customer: drop the pending request or reverse the approved one
            if (voided?.deduction_journal_id) {
                const { cancelJournal } = require('../utils/journalSync');
                await cancelJournal(voided.deduction_journal_id, {
                    description: `Void: Potongan Customer ${voided.sale_no || saleId} (${reason})`,
                    createdBy: userId,
                }, client);
            }

            // Revert or delete journal entry for this sale
            const jeResult = await client.query(
                `SELECT je.id, je.status FROM trx.journal_entries je
                 WHERE je.reference_type = 'SALE' AND je.reference_id = $1 AND je.status IN ('PENDING', 'APPROVED')
                 ORDER BY je.created_at ASC LIMIT 1`,
                [saleId]
            );

            if (jeResult.rows[0]) {
                const je = jeResult.rows[0];
                if (je.status === 'APPROVED') {
                    const linesRes = await client.query(
                        'SELECT account_id, debit, credit FROM trx.journal_lines WHERE journal_id = $1',
                        [je.id]
                    );
                    const financeModel = require('../models/finance.model');
                    await financeModel.createJournalEntry({
                        referenceType: 'VOID',
                        referenceId: je.id,
                        description: `Void: Pembatalan Nota Penjualan ${saleId} (${reason})`,
                        status: 'APPROVED',
                        createdBy: userId,
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

            await client.query('COMMIT');
            return voided;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }

    async closeSale(saleId, userId) {
        const sale = await this.getDetail(saleId);
        if (sale.status === 'COMPLETED')
            throw new BusinessRuleError('Nota sudah ditutup');
        if (sale.status === 'VOID' || sale.status === 'DRAFT')
            throw new BusinessRuleError(`Tidak bisa tutup nota dengan status ${sale.status}`);
        
        // Ensure the sale is fully paid
        const outstanding = parseFloat(sale.outstanding || 0);
        if (outstanding > 0) {
            throw new BusinessRuleError(`Tidak bisa tutup nota, masih ada tagihan Rp ${outstanding.toLocaleString('id-ID')}`);
        }

        // Auto-deliver any remaining items
        const undeliveredItems = [];
        for (const item of sale.items) {
            const ordered = parseFloat(item.qty_ordered) || 0;
            const delivered = parseFloat(item.qty_delivered) || 0;
            if (delivered < ordered) {
                undeliveredItems.push({
                    saleItemId: item.id,
                    qtyDelivered: ordered - delivered
                });
            }
        }

        if (undeliveredItems.length > 0) {
            const { CreateDeliveryCommand } = require('../dtos/salesV2.dto');
            const deliveryCommand = new CreateDeliveryCommand(saleId, userId, {
                deliveryDate: new Date().toISOString(),
                notes: 'Auto-delivery from Tutup Nota',
                items: undeliveredItems
            });
            
            // Temporary workaround for DeliveryService instantiation
            // In a real refactor, use Dependency Injection or extract logic.
            const ds = new DeliveryService();
            await ds.create(deliveryCommand);
        }

        return saleModel.close(saleId);
    }

    async getSummaryStats() {
        return saleModel.getSummaryStats();
    }

    async updateCustomer(saleId, customerId) {
        const sale = await this.getById(saleId);
        if (sale.status !== 'DRAFT')
            throw new BusinessRuleError('Hanya bisa mengubah pelanggan pada nota berstatus DRAFT');
        // Verify customerId exists
        if (customerId) {
            const customer = await customerModel.findById(customerId);
            if (!customer) throw new NotFoundError('Pelanggan tidak ditemukan');
        }
        return saleModel.updateCustomer(saleId, customerId);
    }

    // Enrich items with HPP snapshot and metadata from inventory
    async _enrichItemsWithHpp(items) {
        const enriched = [];
        for (const item of items) {
            let hppPerUnit = item.hppPerUnit || null;
            let itemName = item.itemName || null;
            let categoryCode = item.categoryCode || null;
            let unitType = item.unitType || 'KG';

            if (item.inventoryItemId) {
                const invItem = await inventoryItemsModel.findById(item.inventoryItemId);
                if (invItem) {
                    if (!hppPerUnit) hppPerUnit = invItem.avg_price_per_kg || invItem.hpp_per_kg || null;
                    if (!itemName) {
                        itemName = invItem.category_name || invItem.product_category_code || 'Item';
                        if (invItem.jenis_gabah) itemName += ` - ${invItem.jenis_gabah}`;
                        if (invItem.kualitas) itemName += ` (${invItem.kualitas})`;
                    }
                    if (!categoryCode) categoryCode = invItem.product_category_code;
                }
            }
            enriched.push({ ...item, hppPerUnit, itemName, categoryCode, unitType });
        }
        return enriched;
    }
}

// ════════════════════════════════════════
// DELIVERY SERVICE
// ════════════════════════════════════════
class DeliveryService {
    async create(command) {
        const saleService = new SaleService();
        const sale = await saleService.getById(command.saleId);

        if (!['CONFIRMED', 'PARTIAL_DELIVERED'].includes(sale.status))
            throw new BusinessRuleError(`Tidak bisa catat pengambilan untuk nota berstatus ${sale.status}`);

        if (!command.items?.length)
            throw new ValidationError('Minimal satu item harus dicatat dalam pengambilan');

        // Validate qty per item
        const currentItems = await saleModel.getItems(command.saleId);
        for (const di of command.items) {
            const saleItem = currentItems.find(i => i.id === di.saleItemId);
            if (!saleItem) throw new ValidationError(`Item tidak ditemukan dalam nota ini`);

            const remaining = parseFloat(saleItem.qty_ordered) - parseFloat(saleItem.qty_delivered);
            if (parseFloat(di.qtyDelivered) > remaining)
                throw new BusinessRuleError(
                    `Qty pengambilan (${di.qtyDelivered}) melebihi sisa order (${remaining}) untuk item: ${saleItem.item_name}`
                );
        }

        const deliveryData = SalesV2Mapper.toDeliveryHeaderPersistence(command);
        return saleDeliveryModel.create(command.saleId, deliveryData, command.items, command.userId);
    }

    async delete(deliveryId, saleId) {
        // Verify deliveryId belongs to the given sale
        await ownershipChecks.saleDelivery(deliveryId, saleId, 'Data pengambilan tidak ditemukan untuk nota ini');
        const result = await saleDeliveryModel.delete(deliveryId);
        if (!result) throw new NotFoundError('Data pengambilan tidak ditemukan');
        return result;
    }
}

// ════════════════════════════════════════
// PAYMENT SERVICE
// ════════════════════════════════════════
class PaymentService {
    async create(command) {
        const saleService = new SaleService();
        const sale = await saleService.getById(command.saleId);

        if (sale.status === 'VOID')
            throw new BusinessRuleError('Tidak bisa tambah pembayaran ke nota yang sudah di-void');
        if (!command.amount || command.amount <= 0)
            throw new ValidationError('Jumlah pembayaran harus lebih dari 0');

        const data = SalesV2Mapper.toPaymentPersistence(command);
        // DRAFT payments get no journal — they are included in the SALE request sent on confirm.
        // Payments after confirm (e.g. paying off piutang) are new cash and get their own PENDING request.
        return salePaymentModel.create(command.saleId, data, command.userId, { createJournal: sale.status !== 'DRAFT' });
    }

    async delete(paymentId, saleId) {
        // Verify paymentId belongs to the given sale
        await ownershipChecks.salePayment(paymentId, saleId, 'Data pembayaran tidak ditemukan untuk nota ini');

        const db = require('../config/database');
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // 1. Fetch the payment record to make sure it exists
            const paymentResult = await client.query(
                "SELECT * FROM trx.sale_payments WHERE id = $1",
                [paymentId]
            );
            if (paymentResult.rows.length === 0) {
                throw new NotFoundError('Data pembayaran tidak ditemukan');
            }
            const payment = paymentResult.rows[0];

            // Payments recorded during DRAFT are part of the SALE journal sent on confirm — can't be removed afterwards
            const saleJeRes = await client.query(
                `SELECT created_at FROM trx.journal_entries
                 WHERE reference_type = 'SALE' AND reference_id = $1 AND status IN ('PENDING', 'APPROVED')
                 ORDER BY created_at ASC LIMIT 1`,
                [saleId]
            );
            if (saleJeRes.rows[0] && new Date(payment.created_at) <= new Date(saleJeRes.rows[0].created_at)) {
                throw new BusinessRuleError('Pembayaran ini sudah termasuk dalam pendapatan yang dikirim ke Keuangan saat konfirmasi nota, tidak bisa dihapus');
            }

            // 2. Find the corresponding journal entry (reference_type='SALE_PAYMENT', reference_id=saleId)
            //    Payment journal has: DR [null→Kas] / CR AR (1-200)
            //    We need to reverse the APPROVED one, or delete the PENDING one.
            const jeResult = await client.query(
                `SELECT je.id, je.status
                 FROM trx.journal_entries je
                 WHERE je.reference_type = 'SALE_PAYMENT'
                   AND je.reference_id = $1
                   AND je.status IN ('PENDING', 'APPROVED')
                 ORDER BY je.created_at DESC
                 LIMIT 1`,
                [saleId]
            );

            if (jeResult.rows.length > 0) {
                const je = jeResult.rows[0];
                if (je.status === 'APPROVED') {
                    // Reverse approved balances — get lines and reverse them
                    const linesRes = await client.query(
                        'SELECT account_id, debit, credit FROM trx.journal_lines WHERE journal_id = $1',
                        [je.id]
                    );
                    const financeModel = require('../models/finance.model');
                    await financeModel.createJournalEntry({
                        referenceType: 'VOID',
                        referenceId: je.id,
                        description: `Void: Hapus Pembayaran Nota ${saleId}`,
                        status: 'APPROVED',
                        createdBy: payment.created_by,
                        lines: linesRes.rows.map(l => ({
                            accountId: l.account_id,
                            debit: Number(l.credit),
                            credit: Number(l.debit)
                        }))
                    }, client);
                } else {
                    // PENDING → safe to delete directly
                    await client.query('DELETE FROM trx.journal_lines WHERE journal_id = $1', [je.id]);
                    await client.query('DELETE FROM trx.journal_entries WHERE id = $1', [je.id]);
                }
            }

            // 3. Delete the payment record (triggers will automatically sync the sale paid_amount)
            await client.query(
                "DELETE FROM trx.sale_payments WHERE id = $1",
                [paymentId]
            );

            await client.query('COMMIT');
            return payment;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}

// ════════════════════════════════════════
// RETURN SERVICE
// ════════════════════════════════════════
class ReturnService {
    async create(command) {
        const saleService = new SaleService();
        const sale = await saleService.getDetail(command.saleId);

        // Returns only during DRAFT — the final total is sent to Finance on confirm
        if (sale.status !== 'DRAFT')
            throw new BusinessRuleError(`Retur hanya bisa dicatat sebelum nota dikonfirmasi (status saat ini: ${sale.status})`);
        if (!command.reason?.trim())
            throw new ValidationError('Alasan retur wajib diisi');
            
        const items = command.items || [];
        const biayaTambahan = parseFloat(command.biayaTambahan) || 0;
        
        if (items.length === 0 && biayaTambahan === 0) {
            throw new ValidationError('Pilih minimal satu produk atau masukkan biaya tambahan');
        }

        const returnsCreated = [];

        // 1. Process items
        for (const item of items) {
            const saleItem = sale.items.find(i => i.id === item.saleItemId);
            if (!saleItem) throw new ValidationError('Item tidak ditemukan di nota ini');
            
            const qtyNum = parseFloat(item.qtyReturned) || 0;
            if (qtyNum <= 0) continue;
            
            // qty_ordered is already net of previous returns (each return deducts it),
            // and must stay > 0 (chk_qty_ordered_positive) — a full return means removing the item
            const currentQty = parseFloat(saleItem.qty_ordered);
            if (qtyNum >= currentQty) {
                 throw new ValidationError(`Retur untuk ${saleItem.item_name} (${qtyNum} Kg) harus kurang dari sisa pesanan (${currentQty} Kg). Untuk retur seluruhnya, hapus item dari nota.`);
            }
            const ret = await saleReturnModel.create(command.saleId, {
                returnType: command.returnType === 'FULL_REFUND' ? 'FULL_REFUND' : 'PARTIAL_REFUND',
                reason: command.reason,
                qtyReturned: qtyNum,
                amountAdjusted: 0, // MUST BE 0 in DB because the invoice total drops automatically when qty_ordered drops
                restocked: command.restocked !== undefined ? command.restocked : true,
                saleItemId: saleItem.id,
                inventoryItemId: saleItem.inventory_item_id
            }, command.userId);
            
            returnsCreated.push(ret);
        }

        // 2. Process biaya tambahan as a separate row if exists
        if (biayaTambahan > 0) {
            const ret = await saleReturnModel.create(command.saleId, {
                returnType: 'PRICE_REDUCTION',
                reason: 'Biaya Tambahan: ' + command.reason,
                qtyReturned: 0,
                amountAdjusted: biayaTambahan,
                restocked: false,
                saleItemId: null
            }, command.userId);
            returnsCreated.push(ret);
        }
        
        // If we got here but didn't create anything (e.g. qty was 0 for all)
        if (returnsCreated.length === 0) {
             throw new ValidationError('Total penyesuaian harus lebih dari 0');
        }

        // No journal here — the return already lowers sales.total_amount, which is what confirm() sends to Finance
        return returnsCreated;
    }

    async delete(returnId, saleId) {
        const sale = await new SaleService().getById(saleId);
        if (sale.status !== 'DRAFT')
            throw new BusinessRuleError(`Retur hanya bisa dihapus sebelum nota dikonfirmasi (status saat ini: ${sale.status})`);

        // We throw NotFoundError from our error classes if not found
        try {
            return await saleReturnModel.delete(returnId, saleId);
        } catch (err) {
            if (err.message === 'Data retur tidak ditemukan') {
                throw new NotFoundError(err.message);
            }
            throw err;
        }
    }
}

module.exports = {
    customerService: new CustomerService(),
    priceListService: new PriceListService(),
    saleService: new SaleService(),
    deliveryService: new DeliveryService(),
    paymentService: new PaymentService(),
    returnService: new ReturnService()
};
