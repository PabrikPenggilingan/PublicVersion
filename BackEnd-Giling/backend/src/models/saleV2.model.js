const db = require('../config/database');

const saleItemModel = {
    async createBulk(saleId, items) {
        // items: [{inventoryItemId, itemName, categoryCode, unitType, hppPerUnit, unitPrice, qtyOrdered}]
        const results = [];
        for (const item of items) {
            const result = await db.query(
                `INSERT INTO trx.sale_items
                   (sale_id, inventory_item_id, item_name, category_code,
                    unit_type, hpp_per_unit, unit_price, qty_ordered)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [saleId, item.inventoryItemId || null, item.itemName,
                 item.categoryCode, item.unitType || 'KG',
                 item.hppPerUnit || null, item.unitPrice, item.qtyOrdered]
            );
            results.push(result.rows[0]);
        }
        return results;
    },

    async delete(id) {
        const result = await db.query(
            `DELETE FROM trx.sale_items WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
};

const saleDeliveryModel = {
    async create(saleId, deliveryData, deliveryItems, createdBy) {
        // deliveryData: { deliveryDate, notes }
        // deliveryItems: [{ saleItemId, qtyDelivered }]
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Create delivery header
            const deliveryResult = await client.query(
                `INSERT INTO trx.sale_deliveries (sale_id, delivery_date, notes, created_by)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [saleId, deliveryData.deliveryDate || new Date(),
                 deliveryData.notes || null, createdBy]
            );
            const delivery = deliveryResult.rows[0];

            // Create delivery items (triggers handle stock deduction + qty_delivered update)
            for (const item of deliveryItems) {
                await client.query(
                    `INSERT INTO trx.sale_delivery_items (delivery_id, sale_item_id, qty_delivered)
                     VALUES ($1, $2, $3)`,
                    [delivery.id, item.saleItemId, item.qtyDelivered]
                );
            }

            await client.query('COMMIT');
            return delivery;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async delete(deliveryId) {
        // Deleting delivery header cascades to items; triggers restore inventory
        const result = await db.query(
            `DELETE FROM trx.sale_deliveries WHERE id = $1 RETURNING *`,
            [deliveryId]
        );
        return result.rows[0];
    }
};

const salePaymentModel = {
    async create(saleId, data, createdBy, { createJournal = true } = {}) {
        const financeModel = require('../models/finance.model');
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // 1. Insert the payment record (real-time: sale status updates instantly)
            const result = await client.query(
                `INSERT INTO trx.sale_payments
                   (sale_id, payment_date, amount, method, reference_no, notes, bukti_nota_path, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [saleId, data.paymentDate || new Date(), data.amount,
                 data.method || 'CASH', data.referenceNo || null,
                 data.notes || null, data.buktiNotaPath || null, createdBy]
            );
            const payment = result.rows[0];

            // 2. Create PENDING finance transaction — Finance Manager picks account & approves later
            if (createJournal) {
                const arId = await financeModel.getRequiredAccountId('1-200', client);

                await financeModel.createJournalEntry({
                    referenceType: 'SALE_PAYMENT',
                    referenceId: saleId,
                    description: `Penerimaan Pembayaran Nota Penjualan (${data.referenceNo || saleId})`,
                    status: 'PENDING',
                    createdBy,
                    lines: [
                        { accountId: null, debit: Number(data.amount), credit: 0 }, // Pending Cash
                        { accountId: arId, debit: 0, credit: Number(data.amount) } // Credit AR (Piutang)
                    ]
                }, client);
            }

            await client.query('COMMIT');
            return payment;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async delete(paymentId) {
        const result = await db.query(
            `DELETE FROM trx.sale_payments WHERE id = $1 RETURNING *`,
            [paymentId]
        );
        return result.rows[0];
    }
};

const saleReturnModel = {
    async create(saleId, data, createdBy) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO trx.sale_returns
                   (sale_id, return_date, return_type, reason,
                    qty_returned, amount_adjusted, restocked, sale_item_id, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [saleId, data.returnDate || new Date(), data.returnType,
                 data.reason, data.qtyReturned || 0, data.amountAdjusted,
                 data.restocked || false, data.saleItemId || null, createdBy]
            );
            const retur = result.rows[0];

            let physicalReturnQty = 0;
            
            // Deduct qty_ordered from sale_items to accurately reflect the new effective order size
            if (data.saleItemId && data.qtyReturned > 0) {
                // Fetch current qty_delivered to compute actual physical return
                const itemRes = await client.query(
                    `SELECT qty_ordered, qty_delivered FROM trx.sale_items WHERE id = $1`,
                    [data.saleItemId]
                );
                
                if (itemRes.rows.length > 0) {
                    const currentDelivered = parseFloat(itemRes.rows[0].qty_delivered) || 0;
                    physicalReturnQty = Math.min(data.qtyReturned, currentDelivered);
                    
                    await client.query(
                        `UPDATE trx.sale_items
                         SET qty_ordered = GREATEST(0, qty_ordered - $1),
                             qty_delivered = GREATEST(0, qty_delivered - $2)
                         WHERE id = $3`,
                        [data.qtyReturned, physicalReturnQty, data.saleItemId]
                    );
                }
            }

            // If restocked, add back inventory weight BUT ONLY for the portion that was actually physically delivered
            if (data.restocked && data.inventoryItemId && physicalReturnQty > 0) {
                await client.query(
                    `UPDATE trx.inventory_items
                     SET remaining_weight_kg = remaining_weight_kg + $2
                     WHERE id = $1`,
                    [data.inventoryItemId, physicalReturnQty]
                );
                // Log restock transaction
                await client.query(
                    `INSERT INTO trx.inventory_transactions
                       (inventory_item_id, transaction_type, weight_kg, reference_id, reference_type, notes)
                     VALUES ($1, 'IN', $2, $3, 'RETURN', 'Retur penjualan — barang kembali ke gudang')`,
                    [data.inventoryItemId, physicalReturnQty, saleId]
                );
            }

            await client.query('COMMIT');
            return retur;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async delete(returnId, saleId) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                `SELECT * FROM trx.sale_returns WHERE id = $1 AND sale_id = $2`,
                [returnId, saleId]
            );
            
            if (result.rows.length === 0) {
                throw new Error('Data retur tidak ditemukan');
            }
            const retur = result.rows[0];

            let physicalReturnQty = 0;

            // Restore qty_ordered and qty_delivered in sale_items
            if (retur.sale_item_id && retur.qty_returned > 0) {
                // To restore physical inventory properly we need to calculate what the physical return was
                // If it was returned BEFORE delivery, physical return was 0.
                // We'll approximate: if retur was restocked, we must have added physicalReturnQty to inventory.
                // But we don't store physicalReturnQty. However, we can just do a best-effort, or we can assume
                // that a deleted return just adds back qty_ordered. 
                // A safer way is to check the inventory_transactions table for the exact amount restocked.
                const txnRes = await client.query(
                    `SELECT weight_kg FROM trx.inventory_transactions 
                     WHERE reference_id = $1 AND transaction_type = 'IN' AND reference_type = 'RETURN' 
                     AND inventory_item_id = (SELECT inventory_item_id FROM trx.sale_items WHERE id = $2)
                     ORDER BY created_at DESC LIMIT 1`,
                    [saleId, retur.sale_item_id]
                );
                physicalReturnQty = txnRes.rows.length > 0 ? parseFloat(txnRes.rows[0].weight_kg) : 0;
                
                await client.query(
                    `UPDATE trx.sale_items
                     SET qty_ordered = qty_ordered + $2,
                         qty_delivered = qty_delivered + $3
                     WHERE id = $1`,
                    [retur.sale_item_id, retur.qty_returned, physicalReturnQty]
                );
            }

            // If restocked, we need to subtract the inventory weight back
            if (retur.restocked && physicalReturnQty > 0) {
                // To find inventory_item_id, we need to join sale_items
                const itemResult = await client.query(
                    `SELECT inventory_item_id FROM trx.sale_items WHERE id = $1`,
                    [retur.sale_item_id]
                );
                
                if (itemResult.rows.length > 0 && itemResult.rows[0].inventory_item_id) {
                    const inventoryItemId = itemResult.rows[0].inventory_item_id;
                    
                    await client.query(
                        `UPDATE trx.inventory_items
                         SET remaining_weight_kg = remaining_weight_kg - $2
                         WHERE id = $1`,
                        [inventoryItemId, physicalReturnQty]
                    );
                    
                    // Log out transaction
                    await client.query(
                        `INSERT INTO trx.inventory_transactions
                           (inventory_item_id, transaction_type, weight_kg, reference_id, reference_type, notes)
                         VALUES ($1, 'OUT', $2, $3, 'RETURN_CANCEL', 'Pembatalan retur penjualan — barang ditarik kembali')`,
                        [inventoryItemId, physicalReturnQty, saleId]
                    );
                }
            }

            await client.query(
                `DELETE FROM trx.sale_returns WHERE id = $1`,
                [returnId]
            );

            await client.query('COMMIT');
            return retur;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};

module.exports = { saleItemModel, saleDeliveryModel, salePaymentModel, saleReturnModel };
