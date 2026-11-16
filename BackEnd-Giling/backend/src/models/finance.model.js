const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const { ValidationError, NotFoundError } = require('../utils/errors');
const requestContext = require('../config/context');

const financeModel = {
    // ─── Finance Accounts (Master Data) ──────────────────────────────────
    async getAccounts(filters = {}) {
        const store = requestContext.getStore();
        const user = store?.user;
        const isAdminOnly = user && (user.role || '').toLowerCase() === 'super_admin';

        // Build per-user filter for journal entries inside the CTEs.
        // Only 'super_admin' sees the full company picture; every other role is isolated.
        const userFilterSql = (!isAdminOnly && user) ? `AND je.created_by = ANY($1::uuid[])` : '';
        const userFilterParams = (!isAdminOnly && user) ? [tenantIds(user)] : [];
        // Subsequent query params will start at the index after any user filter params.
        let paramIdx = userFilterParams.length + 1;

        // committed_balance: only APPROVED journals
        // pending_balance:   APPROVED + PENDING journals (projected)
        let query = `
            WITH committed AS (
                SELECT jl.account_id,
                    COALESCE(SUM(jl.debit), 0) as total_debit,
                    COALESCE(SUM(jl.credit), 0) as total_credit
                FROM trx.journal_lines jl
                JOIN trx.journal_entries je ON jl.journal_id = je.id
                WHERE je.status = 'APPROVED' ${userFilterSql}
                GROUP BY jl.account_id
            ),
            pending AS (
                SELECT jl.account_id,
                    COALESCE(SUM(jl.debit), 0) as total_debit,
                    COALESCE(SUM(jl.credit), 0) as total_credit
                FROM trx.journal_lines jl
                JOIN trx.journal_entries je ON jl.journal_id = je.id
                WHERE je.status IN ('APPROVED', 'PENDING') ${userFilterSql}
                GROUP BY jl.account_id
            )
            SELECT
                fa.*,
                CASE 
                    WHEN fa.account_category IN ('LIABILITY', 'EQUITY', 'REVENUE') 
                    THEN COALESCE(c.total_credit - c.total_debit, 0)
                    ELSE COALESCE(c.total_debit - c.total_credit, 0)
                END as balance,
                CASE 
                    WHEN fa.account_category IN ('LIABILITY', 'EQUITY', 'REVENUE') 
                    THEN COALESCE(c.total_credit - c.total_debit, 0)
                    ELSE COALESCE(c.total_debit - c.total_credit, 0)
                END as committed_balance,
                CASE 
                    WHEN fa.account_category IN ('LIABILITY', 'EQUITY', 'REVENUE') 
                    THEN COALESCE(p.total_credit - p.total_debit, 0)
                    ELSE COALESCE(p.total_debit - p.total_credit, 0)
                END as pending_balance,
                CASE 
                    WHEN fa.account_category IN ('LIABILITY', 'EQUITY', 'REVENUE') 
                    THEN COALESCE(c.total_credit - c.total_debit, 0)
                    ELSE COALESCE(c.total_debit - c.total_credit, 0)
                END as current_balance
            FROM trx.finance_accounts fa
            LEFT JOIN committed c ON fa.id = c.account_id
            LEFT JOIN pending   p ON fa.id = p.account_id
            WHERE fa.is_active = true
        `;

        const params = [...userFilterParams];

        if (filters.category) {
            query += ` AND fa.account_category = $${paramIdx++}`;
            params.push(filters.category.toUpperCase());
        }

        if (filters.type) {
            query += ` AND fa.account_type = $${paramIdx++}`;
            params.push(filters.type.toUpperCase());
        }

        if (filters.isActive !== undefined) {
            query += ` AND fa.is_active = $${paramIdx++}`;
            params.push(filters.isActive);
        }

        query += ' ORDER BY fa.account_category ASC, fa.account_code ASC, fa.name ASC';

        const result = await db.query(query, params);
        return result.rows;
    },


    /**
     * Get a required account ID by code — throws if not found.
     * Use this instead of silent-skip pattern to ensure CoA is always configured.
     */
    async getRequiredAccountId(code, client) {
        const executor = client || db;
        const result = await executor.query(
            `SELECT id FROM trx.finance_accounts WHERE account_code = $1 AND is_active = true LIMIT 1`,
            [code]
        );
        if (!result.rows[0]) {
            throw new Error(
                `[Finance] Akun CoA dengan kode '${code}' tidak ditemukan atau tidak aktif. ` +
                `Pastikan Chart of Accounts sudah dikonfigurasi di Finance → Rekening.`
            );
        }
        return result.rows[0].id;
    },

    /**
     * Recent activity for dashboard — returns last 10 journal entries (PENDING + APPROVED).
     */
    async getRecentActivity(limit = 10) {
        const store = requestContext.getStore();
        const user = store?.user;
        if (!user) throw new Error('User context required');
        const isAdminOnly = ['super_admin'].includes((user.role || '').toLowerCase());

        const params = [];
        let whereClause = '';
        if (!isAdminOnly) {
            whereClause = `AND je.created_by = ANY($1::uuid[])`;
            params.push(tenantIds(user));
        }
        params.push(limit);

        const result = await db.query(
            `SELECT
                je.id,
                je.transaction_date,
                je.description,
                je.status,
                je.reference_type,
                u.username as created_by_name,
                COALESCE(SUM(jl.debit), 0) as amount,
                CASE
                    WHEN je.reference_type IN ('SALE', 'SALE_PAYMENT', 'TITIPAN_FEE', 'CAPITAL_IN') THEN 'IN'
                    ELSE 'OUT'
                END as transaction_type
             FROM trx.journal_entries je
             JOIN trx.journal_lines jl ON jl.journal_id = je.id
             LEFT JOIN sys.users u ON u.id = je.created_by
             WHERE je.status IN ('PENDING', 'APPROVED') ${whereClause}
             GROUP BY je.id, u.username
             ORDER BY je.transaction_date DESC, je.created_at DESC
             LIMIT $${params.length}`,
            params
        );
        return result.rows;
    },

    async createAccount(data) {
        const store = requestContext.getStore();
        const user = store?.user;
        data = { ...data, account_category: data.account_category || this.categoryForType(data.account_type) };
        const result = await db.query(
            `INSERT INTO trx.finance_accounts (name, account_type, account_category, account_code, description, is_active, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [data.name, data.account_type, data.account_category, data.account_code, data.description, data.is_active ?? true, user?.id]
        );
        return result.rows[0];
    },

    // Default category for an account type (CASH/BANK → ASSET, …)
    categoryForType(type) {
        const t = String(type || '').toUpperCase();
        if (['CASH', 'BANK', 'RECEIVABLE', 'INVENTORY'].includes(t)) return 'ASSET';
        if (['ACCOUNTS_PAYABLE', 'LIABILITY'].includes(t)) return 'LIABILITY';
        if (['CAPITAL', 'EQUITY'].includes(t)) return 'EQUITY';
        if (t.endsWith('REVENUE')) return 'REVENUE';
        if (['COGS', 'OPEX', 'EXPENSE'].includes(t)) return 'EXPENSE';
        return null;
    },

    async updateAccount(id, data) {
        const result = await db.query(
            `UPDATE trx.finance_accounts 
             SET name = COALESCE($1, name),
                 account_type = COALESCE($2, account_type),
                 account_category = COALESCE($3, account_category),
                 account_code = COALESCE($4, account_code),
                 description = COALESCE($5, description),
                 is_active = COALESCE($6, is_active),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $7 RETURNING *`,
            [data.name, data.account_type, data.account_category, data.account_code, data.description, data.is_active, id]
        );
        return result.rows[0];
    },

    async updateAccountBalance(accountId, amount, type, client) {
        // type: 'IN' or 'OUT'
        const operator = type === 'IN' ? '+' : '-';
        const executor = client || db;
        const result = await executor.query(
            `UPDATE trx.finance_accounts SET balance = balance ${operator} $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
            [accountId, amount]
        );
        return result.rows[0];
    },

    // ─── Double-Entry Journals (Transactions) ─────────────────────────────
    
    /**
     * Create a double-entry journal (Header + Lines).
     * @param {object} data
     * @param {string} data.referenceType - e.g., 'SALE', 'PURCHASE', 'OVERHEAD'
     * @param {string} data.referenceId - UUID
     * @param {string} data.description 
     * @param {string} data.status - 'PENDING', 'APPROVED'
     * @param {string} data.createdBy
     * @param {Array} data.lines - Array of { accountId, debit, credit }
     */
    async createJournalEntry(data, client) {
        const executor = client || db;
        const status = data.status || 'APPROVED';

        // 1. Insert Header
        const journalResult = await executor.query(
            `INSERT INTO trx.journal_entries 
             (reference_type, reference_id, description, status, created_by)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [data.referenceType, data.referenceId || null, data.description, status, data.createdBy]
        );
        const journalId = journalResult.rows[0].id;

        // 2. Validate Lines (Debit == Credit)
        let totalDebit = 0;
        let totalCredit = 0;
        for (const line of data.lines) {
            totalDebit += (line.debit || 0);
            totalCredit += (line.credit || 0);
        }
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Jurnal tidak balance: Debit (${totalDebit}) != Kredit (${totalCredit})`);
        }

        // 3. Insert Lines
        for (const line of data.lines) {
            await executor.query(
                `INSERT INTO trx.journal_lines (journal_id, account_id, debit, credit)
                 VALUES ($1, $2, $3, $4)`,
                [journalId, line.accountId || null, line.debit || 0, line.credit || 0]
            );

            // 4. Update balances if APPROVED
            if (status === 'APPROVED' && line.accountId) {
                const accRes = await executor.query('SELECT account_category FROM trx.finance_accounts WHERE id = $1', [line.accountId]);
                const category = accRes.rows[0]?.account_category || 'ASSET';
                
                let balanceChange = 0;
                if (['ASSET', 'EXPENSE'].includes(category)) {
                    balanceChange = (line.debit || 0) - (line.credit || 0);
                } else {
                    balanceChange = (line.credit || 0) - (line.debit || 0);
                }

                if (balanceChange !== 0) {
                    await executor.query(
                        `UPDATE trx.finance_accounts SET balance = balance + $1 WHERE id = $2`,
                        [balanceChange, line.accountId]
                    );
                }
            }
        }

        return { id: journalId, status };
    },

    // ─── Pending & Approvals ──────────────────────────────────────────────

    // Approve one PENDING journal inside the caller's transaction: assign the cash/bank
    // account to its open line and post the balances. Used by single approve and by
    // payBatch (bukti kas: bayar/terima sekaligus).
    // Approvals/rejections only touch journals of the current user's pabrik
    _assertJournalInTenant(je) {
        const user = requestContext.getStore()?.user;
        const isSuper = user && (user.is_super_admin || (user.role || '').toLowerCase() === 'super_admin');
        if (user && !isSuper && !inTenant(je.created_by, user)) {
            throw new NotFoundError('Jurnal tidak ditemukan atau sudah diproses.');
        }
    },

    async _approveWithClient(client, journalId, cashAccountId) {
        const txResult = await client.query(
            `SELECT * FROM trx.journal_entries WHERE id = $1 AND status = 'PENDING'`,
            [journalId]
        );
        if (txResult.rows.length === 0) {
            throw new NotFoundError('Jurnal tidak ditemukan atau sudah diproses.');
        }
        this._assertJournalInTenant(txResult.rows[0]);

        // Update Journal Header
        await client.query(
            `UPDATE trx.journal_entries
             SET status = 'APPROVED', updated_at = NOW()
             WHERE id = $1`,
            [journalId]
        );

        // Assign cashAccountId to the Cash/Bank line of the journal
        if (cashAccountId) {
            // 1. Check if there is any line with account_id IS NULL
            const nullLineRes = await client.query(
                `SELECT id, debit, credit FROM trx.journal_lines WHERE journal_id = $1 AND account_id IS NULL`,
                [journalId]
            );
            
            if (nullLineRes.rows.length > 0) {
                await client.query(
                    `UPDATE trx.journal_lines SET account_id = $1 WHERE journal_id = $2 AND account_id IS NULL`,
                    [cashAccountId, journalId]
                );
            } else {
                // 2. If no NULL line, look strictly for existing Cash/Bank line to confirm/switch to cashAccountId
                // NEVER match 1-2% (Receivables) or 1-3% (Inventory) even though category is ASSET
                const assetLineRes = await client.query(
                    `SELECT jl.id FROM trx.journal_lines jl
                     JOIN trx.finance_accounts fa ON jl.account_id = fa.id
                     WHERE jl.journal_id = $1 AND (fa.account_type IN ('CASH', 'BANK') OR fa.account_code LIKE '1-1%')
                     LIMIT 1`,
                    [journalId]
                );
                if (assetLineRes.rows.length > 0) {
                    await client.query(
                        `UPDATE trx.journal_lines SET account_id = $1 WHERE id = $2`,
                        [cashAccountId, assetLineRes.rows[0].id]
                    );
                }
            }
        }

        // Update the balances for all lines in this journal
        const linesRes = await client.query(`SELECT * FROM trx.journal_lines WHERE journal_id = $1`, [journalId]);
        for (const line of linesRes.rows) {
            if (!line.account_id) continue;
            
            const accRes = await client.query('SELECT account_category FROM trx.finance_accounts WHERE id = $1', [line.account_id]);
            const category = accRes.rows[0]?.account_category || 'ASSET';
            
            let balanceChange = 0;
            if (['ASSET', 'EXPENSE'].includes(category)) {
                balanceChange = Number(line.debit) - Number(line.credit);
            } else {
                balanceChange = Number(line.credit) - Number(line.debit);
            }

            if (balanceChange !== 0) {
                await client.query(
                    `UPDATE trx.finance_accounts SET balance = balance + $1 WHERE id = $2`,
                    [balanceChange, line.account_id]
                );
            }
        }
        return { id: journalId, status: 'APPROVED' };
    },

    async approveTransaction(journalId, cashAccountId, approvedByUserId) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const result = await this._approveWithClient(client, journalId, cashAccountId);
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async rejectTransaction(journalId, rejectedByUserId) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const txResult = await client.query(
                `SELECT * FROM trx.journal_entries WHERE id = $1 AND status = 'PENDING'`,
                [journalId]
            );
            if (txResult.rows.length === 0) {
                throw new NotFoundError('Jurnal tidak ditemukan atau sudah diproses.');
            }
            const je = txResult.rows[0];
            this._assertJournalInTenant(je);

            // Revert related operational records if applicable
            if (je.reference_type === 'PURCHASE_PAYMENT' && je.reference_id) {
                const payRes = await client.query('SELECT * FROM trx.purchase_payments WHERE id = $1', [je.reference_id]);
                if (payRes.rows.length > 0) {
                    const pay = payRes.rows[0];
                    await client.query(
                        `UPDATE trx.purchases
                         SET paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - $1),
                             payment_status = CASE 
                                 WHEN GREATEST(0, COALESCE(paid_amount, 0) - $1) >= total_harga THEN 'PAID'
                                 WHEN GREATEST(0, COALESCE(paid_amount, 0) - $1) > 0 THEN 'PARTIAL'
                                 ELSE 'UNPAID'
                             END
                         WHERE id = $2`,
                        [pay.amount, pay.purchase_id]
                    );
                    await client.query('DELETE FROM trx.purchase_payments WHERE id = $1', [pay.id]);
                }
            } else if (je.reference_type === 'BATCH_PAYMENT' && je.reference_id) {
                // Removes the installment + its FIFO allocations and restores the batch debt
                const batchPaymentModel = require('./batchPayment.model');
                await batchPaymentModel.deleteWithClient(client, je.reference_id);
            } else if (je.reference_type === 'SALE_PAYMENT' && je.reference_id) {
                const lineRes = await client.query('SELECT debit FROM trx.journal_lines WHERE journal_id = $1 AND debit > 0 LIMIT 1', [journalId]);
                const amount = lineRes.rows[0]?.debit;
                if (amount) {
                    const spRes = await client.query(
                        `SELECT id FROM trx.sale_payments WHERE sale_id = $1 AND amount = $2 ORDER BY created_at DESC LIMIT 1`,
                        [je.reference_id, amount]
                    );
                    if (spRes.rows.length > 0) {
                        // trg_sync_sale_paid_amount will automatically recalculate sale paid_amount
                        await client.query('DELETE FROM trx.sale_payments WHERE id = $1', [spRes.rows[0].id]);
                    }
                }
            } else if (je.reference_type === 'OVERHEAD' && je.reference_id) {
                await client.query('DELETE FROM trx.overhead_expenses WHERE id = $1', [je.reference_id]);
            } else if (je.reference_type === 'SALE' && je.reference_id) {
                const saleRes = await client.query(`SELECT status FROM trx.sales WHERE id = $1 FOR UPDATE`, [je.reference_id]);
                const sale = saleRes.rows[0];
                if (sale && sale.status === 'COMPLETED') {
                    throw new ValidationError('Nota sudah selesai dikirim. Batalkan (VOID) dari halaman nota, bukan ditolak di sini.');
                }
                if (sale && sale.status === 'CONFIRMED') {
                    await client.query(`UPDATE trx.sales SET status = 'DRAFT' WHERE id = $1`, [je.reference_id]);
                    // Its pending potongan request is posted again on the next confirm
                    const ded = await client.query(
                        `SELECT s.deduction_journal_id FROM trx.sales s
                         JOIN trx.journal_entries j ON j.id = s.deduction_journal_id AND j.status = 'PENDING'
                         WHERE s.id = $1`, [je.reference_id]);
                    if (ded.rows[0]) {
                        await client.query(`UPDATE trx.sales SET deduction_journal_id = NULL WHERE id = $1`, [je.reference_id]);
                        await client.query(`DELETE FROM trx.journal_lines WHERE journal_id = $1`, [ded.rows[0].deduction_journal_id]);
                        await client.query(`DELETE FROM trx.journal_entries WHERE id = $1`, [ded.rows[0].deduction_journal_id]);
                    }
                }
            } else if (je.reference_type === 'SALE_DEDUCTION' && je.reference_id) {
                // Rejected potongan → the customer still owes it
                await client.query(
                    `UPDATE trx.sales SET customer_deduction = 0, deduction_journal_id = NULL
                     WHERE id = $1 AND deduction_journal_id = $2`,
                    [je.reference_id, journalId]
                );
            }

            await client.query(
                `UPDATE trx.journal_entries
                 SET status = 'REJECTED', updated_at = NOW()
                 WHERE id = $1`,
                [journalId]
            );

            await client.query('COMMIT');
            return { id: journalId, status: 'REJECTED' };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    /**
     * Replaces getPendingTransactions from finance_transactions.
     * The frontend expects an array of transactions with:
     * id, transaction_date, amount, category, description, created_by_name, transaction_type, pending_account_id
     */
    async getPendingTransactions() {
        const store = requestContext.getStore();
        const user = store?.user;
        if (!user) throw new Error("STRICT TENANCY ENFORCEMENT: User context is required for pending transactions.");
        const isAdminOnly = ['super_admin'].includes((user.role || '').toLowerCase());
        const whereClause = isAdminOnly
            ? `WHERE j.status = 'PENDING'`
            : `WHERE j.status = 'PENDING' AND j.created_by = ANY(${tenantSql(user)})`;

        const result = await db.query(
            `SELECT 
                j.id, 
                j.transaction_date, 
                j.reference_type as category, 
                j.description, 
                u.username as created_by_name,
                (SELECT COALESCE(SUM(debit), 0) FROM trx.journal_lines WHERE journal_id = j.id) as amount,
                CASE 
                    WHEN j.reference_type IN ('SALE', 'SALE_PAYMENT', 'TITIPAN_FEE', 'CAPITAL_IN') THEN 'IN' 
                    ELSE 'OUT' 
                END as transaction_type,
                (
                    SELECT jl.account_id 
                    FROM trx.journal_lines jl 
                    JOIN trx.finance_accounts fa ON jl.account_id = fa.id 
                    WHERE jl.journal_id = j.id AND (fa.account_type IN ('CASH', 'BANK') OR fa.account_code LIKE '1-1%')
                    LIMIT 1
                ) as pending_account_id,
                -- Cash actually moved (open cash line or a cash/bank line); 0 for non-cash entries like potongan customer
                (
                    SELECT COALESCE(SUM(jl.debit + jl.credit), 0)
                    FROM trx.journal_lines jl
                    LEFT JOIN trx.finance_accounts fa ON jl.account_id = fa.id
                    WHERE jl.journal_id = j.id AND (jl.account_id IS NULL OR fa.account_type IN ('CASH', 'BANK') OR fa.account_code LIKE '1-1%')
                ) as cash_amount
             FROM trx.journal_entries j
             LEFT JOIN sys.users u ON j.created_by = u.id
             ${whereClause}
             ORDER BY j.transaction_date DESC`
        );
        return result.rows;
    },

    // ─── Overhead Expenses ────────────────────────────────────────────────
    async createOverhead(data) {
        const result = await db.query(
            `INSERT INTO trx.overhead_expenses
             (expense_date, category, description, amount, frequency, payment_method, finance_account_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [data.expenseDate, data.category, data.description, data.amount, data.frequency, data.paymentMethod, data.financeAccountId, data.createdBy]
        );

        // Fetch Overhead Expense Account (5-600)
        const expenseAccountId = await this.getRequiredAccountId('5-600');

        // Record Journal (Pending)
        await this.createJournalEntry({
            referenceType: 'OVERHEAD',
            referenceId: result.rows[0].id,
            description: `Overhead: ${data.category} — ${data.description || ''}`,
            status: 'PENDING',
            createdBy: data.createdBy,
            lines: [
                { accountId: expenseAccountId, debit: data.amount, credit: 0 },
                { accountId: data.financeAccountId || null, debit: 0, credit: data.amount }
            ]
        });

        return result.rows[0];
    },

    async getOverheads(filters = {}) {
        let query = 'SELECT * FROM trx.overhead_expenses WHERE 1=1';
        const params = [];
        let paramIdx = 1;

        if (filters.startDate && filters.endDate) {
            query += ` AND expense_date BETWEEN $${paramIdx++} AND $${paramIdx++}`;
            params.push(filters.startDate, filters.endDate);
        }
        if (filters.category) {
            query += ` AND category = $${paramIdx++}`;
            params.push(filters.category);
        }

        const store = requestContext.getStore();
        const user = store?.user;
        const isAdminOnly = user && (user.role || '').toLowerCase() === 'super_admin';
        if (user && !isAdminOnly) {
            query += ` AND created_by = ANY($${paramIdx++}::uuid[])`;
            params.push(tenantIds(user));
        }

        query += ' ORDER BY expense_date DESC';
        const result = await db.query(query, params);
        return result.rows;
    },

    // ─── Purchase Payments (Debt Management) ─────────────────────────────
    async createPurchasePayment(data) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const result = await client.query(
                `INSERT INTO trx.purchase_payments
                 (purchase_id, payment_date, amount, payment_method, reference_no, notes, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [data.purchaseId, data.paymentDate || new Date(), data.amount, data.paymentMethod || 'CASH', data.referenceNo, data.notes, data.createdBy]
            );

            // Update purchase paid amount and status
            await client.query(
                `UPDATE trx.purchases 
                 SET paid_amount = COALESCE(paid_amount, 0) + $1,
                     payment_status = CASE 
                         WHEN COALESCE(paid_amount, 0) + $1 >= total_harga THEN 'PAID'
                         ELSE 'PARTIAL'
                     END
                 WHERE id = $2`,
                [data.amount, data.purchaseId]
            );

            // Get AP account for purchases
            const apId = await this.getRequiredAccountId('2-100', client);

            // Record Journal (Pending) - Debit AP, Credit Cash
            await this.createJournalEntry({
                referenceType: 'PURCHASE_PAYMENT',
                referenceId: result.rows[0].id,
                description: `Pembayaran Hutang Pembelian Gabah (${data.referenceNo || ''})`,
                status: 'PENDING',
                createdBy: data.createdBy,
                lines: [
                    { accountId: apId, debit: data.amount, credit: 0 },
                    { accountId: data.financeAccountId || null, debit: 0, credit: data.amount }
                ]
            }, client);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
};

module.exports = financeModel;

