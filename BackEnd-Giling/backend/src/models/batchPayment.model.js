const db = require('../config/database');
const { BusinessRuleError, NotFoundError } = require('../utils/errors');

const round2 = (n) => Math.round(Number(n) * 100) / 100;

const getStatus = (totalOwed, totalPaid) => {
    if (totalPaid <= 0) return 'UNPAID';
    if (totalPaid + 0.01 >= totalOwed) return 'PAID';
    return 'PARTIAL';
};

const batchPaymentModel = {
    /**
     * Batch debt summary: purchases total vs. installments paid.
     * Includes legacy per-purchase payments (Debt Manager) that are not linked to a batch payment.
     */
    async getDebt(batchId, client) {
        const executor = client || db;

        const owedRes = await executor.query(
            `SELECT COALESCE(SUM(total_harga), 0) AS total_owed
             FROM trx.purchases
             WHERE batch_id = $1 AND COALESCE(payment_status, 'UNPAID') != 'VOID'`,
            [batchId]
        );

        const paymentsRes = await executor.query(
            `SELECT bp.id, bp.payment_date, bp.amount, bp.payment_method, bp.reference_no, bp.notes,
                    bp.bukti_nota_path, bp.created_at, u.username AS created_by_name,
                    je.status AS approval_status, 'BATCH' AS source
             FROM trx.batch_payments bp
             LEFT JOIN sys.users u ON bp.created_by = u.id
             LEFT JOIN trx.journal_entries je ON je.reference_type = 'BATCH_PAYMENT' AND je.reference_id = bp.id
             WHERE bp.batch_id = $1
             UNION ALL
             SELECT pp.id, pp.payment_date, pp.amount, pp.payment_method, pp.reference_no, pp.notes,
                    NULL AS bukti_nota_path, pp.created_at, u.username AS created_by_name,
                    je.status AS approval_status, 'PURCHASE' AS source
             FROM trx.purchase_payments pp
             JOIN trx.purchases p ON pp.purchase_id = p.id
             LEFT JOIN sys.users u ON pp.created_by = u.id
             LEFT JOIN trx.journal_entries je ON je.reference_type = 'PURCHASE_PAYMENT' AND je.reference_id = pp.id
             WHERE p.batch_id = $1 AND pp.batch_payment_id IS NULL
             ORDER BY payment_date DESC, created_at DESC`,
            [batchId]
        );

        const totalOwed = round2(owedRes.rows[0].total_owed);
        const totalPaid = round2(paymentsRes.rows.reduce((sum, p) => sum + Number(p.amount), 0));
        const remaining = round2(Math.max(0, totalOwed - totalPaid));

        return {
            batchId,
            totalOwed,
            totalPaid,
            remaining,
            status: getStatus(totalOwed, totalPaid),
            payments: paymentsRes.rows
        };
    },

    /**
     * Record one debt installment for a batch.
     * The amount is allocated FIFO into trx.purchase_payments (keeps purchases.paid_amount in sync)
     * and a PENDING journal is created — Finance Manager picks the cash account & approves later.
     */
    async create(batchId, data, createdBy) {
        const financeModel = require('./finance.model');
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Lock the batch row so concurrent payments can't overpay
            const batchRes = await client.query('SELECT id FROM trx.batches WHERE id = $1 FOR UPDATE', [batchId]);
            if (batchRes.rows.length === 0) throw new NotFoundError('Batch tidak ditemukan');

            const amount = round2(data.amount);
            if (!(amount > 0)) throw new BusinessRuleError('Jumlah pembayaran harus lebih dari 0');

            const debt = await this.getDebt(batchId, client);
            if (amount > debt.remaining + 0.001) {
                throw new BusinessRuleError(`Jumlah pembayaran melebihi sisa hutang (Rp ${debt.remaining.toLocaleString('id-ID')})`);
            }

            // 1. Insert the installment
            const result = await client.query(
                `INSERT INTO trx.batch_payments
                   (batch_id, payment_date, amount, payment_method, reference_no, notes, bukti_nota_path, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [batchId, data.paymentDate || new Date(), amount,
                 data.paymentMethod || 'CASH', data.referenceNo || null,
                 data.notes || null, data.buktiNotaPath || null, createdBy]
            );
            const payment = result.rows[0];

            // 2. Allocate FIFO across unpaid purchases of this batch
            const purchasesRes = await client.query(
                `SELECT id, total_harga, COALESCE(paid_amount, 0) AS paid_amount
                 FROM trx.purchases
                 WHERE batch_id = $1 AND COALESCE(payment_status, 'UNPAID') NOT IN ('PAID', 'VOID')
                 ORDER BY created_at ASC`,
                [batchId]
            );

            let left = amount;
            for (const p of purchasesRes.rows) {
                if (left <= 0) break;
                const open = round2(Number(p.total_harga) - Number(p.paid_amount));
                if (open <= 0) continue;
                const portion = round2(Math.min(open, left));

                await client.query(
                    `INSERT INTO trx.purchase_payments
                       (purchase_id, batch_payment_id, payment_date, amount, payment_method, reference_no, notes, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [p.id, payment.id, payment.payment_date, portion, payment.payment_method,
                     payment.reference_no, payment.notes, createdBy]
                );
                left = round2(left - portion);
            }
            await this.recalcPurchases(client, purchasesRes.rows.map(p => p.id));

            // 3. Create PENDING finance transaction — Debit AP (Hutang), Credit Cash (assigned on approval)
            const apId = await financeModel.getRequiredAccountId('2-100', client);
            await financeModel.createJournalEntry({
                referenceType: 'BATCH_PAYMENT',
                referenceId: payment.id,
                description: `Pembayaran Hutang Batch Pembelian Gabah (${data.referenceNo || payment.payment_method})`,
                status: 'PENDING',
                createdBy,
                lines: [
                    { accountId: apId, debit: amount, credit: 0 },
                    { accountId: null, debit: 0, credit: amount } // Pending Cash
                ]
            }, client);

            await client.query('COMMIT');
            return payment;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    /**
     * Remove an installment (e.g. when its journal is rejected) and restore purchase balances.
     * Must run inside the caller's transaction.
     */
    async deleteWithClient(client, batchPaymentId) {
        const allocRes = await client.query(
            'SELECT DISTINCT purchase_id FROM trx.purchase_payments WHERE batch_payment_id = $1',
            [batchPaymentId]
        );
        // Cascades to the purchase_payments allocations
        await client.query('DELETE FROM trx.batch_payments WHERE id = $1', [batchPaymentId]);
        await this.recalcPurchases(client, allocRes.rows.map(r => r.purchase_id));
    },

    // Recompute paid_amount / payment_status from the recorded purchase_payments
    async recalcPurchases(client, purchaseIds) {
        if (!purchaseIds || purchaseIds.length === 0) return;
        await client.query(
            `UPDATE trx.purchases p
             SET paid_amount = s.paid,
                 payment_status = CASE
                     WHEN s.paid >= p.total_harga THEN 'PAID'
                     WHEN s.paid > 0 THEN 'PARTIAL'
                     ELSE 'UNPAID'
                 END
             FROM (
                 SELECT pr.id, COALESCE(SUM(pp.amount), 0) AS paid
                 FROM trx.purchases pr
                 LEFT JOIN trx.purchase_payments pp ON pp.purchase_id = pr.id
                 WHERE pr.id = ANY($1::uuid[])
                 GROUP BY pr.id
             ) s
             WHERE p.id = s.id AND COALESCE(p.payment_status, 'UNPAID') != 'VOID'`,
            [purchaseIds]
        );
    }
};

module.exports = batchPaymentModel;
