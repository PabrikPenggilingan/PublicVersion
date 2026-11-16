const financeModel = require('../models/finance.model');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const { OPEX_CATEGORIES } = require('../utils/accounting.map');
const db = require('../config/database');
const { ValidationError, AuthorizationError } = require('../utils/errors');
const requestContext = require('../config/context');

/**
 * Build a SQL snippet + params array to restrict queries to the current user.
 * Only 'admin' role sees all data. Everyone else (including 'owner') is scoped
 * to their own records.
 *
 * @param {string} alias      - Table alias (e.g. 's', 'p', 'je')
 * @param {number} startIdx   - The next $n parameter index to use
 * @returns {{ sql: string, params: any[], nextIdx: number }}
 */
function buildUserFilter(alias, startIdx, columnName = 'created_by') {
    const store = requestContext.getStore();
    const user = store?.user;
    if (!user) {
        throw new Error("STRICT TENANCY ENFORCEMENT: User context is required for finance queries.");
    }
    const role = (user.role || '').toLowerCase();
    // Only 'super_admin' sees all data. Every other role is scoped to their own records.
    // This enforces strict tenancy where even admins are isolated to their own tenant data.
    if (role === 'super_admin') {
        return {
            sql: '',
            params: [],
            nextIdx: startIdx
        };
    }
    return {
        sql: ` AND ${alias}.${columnName} = ANY($${startIdx}::uuid[]) `,
        params: [tenantIds(user)],
        nextIdx: startIdx + 1
    };
}

const financeService = {
    async getDashboard(user) {
        const role = (user.role || '').toLowerCase();
        if (role !== 'admin' && role !== 'owner' && user.privilege_level !== 'TIER_B') {
            throw new AuthorizationError('Access denied: TIER_B or admin/owner role required for finance features');
        }

        const accounts = await financeModel.getAccounts();

        // Derive per-user SQL filters — purchases uses 'filled_by' not 'created_by'
        const apFilter = buildUserFilter('p', 1, 'filled_by');
        const arFilter = buildUserFilter('s', 1);
        const pendingFilter = buildUserFilter('je', 1);

        // Get AP (Hutang ke Petani)
        const apResult = await db.query(
            `SELECT COALESCE(SUM(p.total_harga - p.paid_amount), 0) as total_ap
             FROM trx.purchases p
             WHERE p.payment_status != 'PAID' ${apFilter.sql}`,
            apFilter.params
        );

        // Get AR (Piutang dari Pelanggan)
        const arResult = await db.query(
            `SELECT COALESCE(SUM(GREATEST(s.outstanding, 0)), 0) as total_ar
             FROM trx.sales s
             WHERE s.payment_status != 'PAID' AND s.status NOT IN ('VOID', 'DRAFT') ${arFilter.sql}`,
            arFilter.params
        );

        // Get Pending Approvals count for notification badge
        const pendingResult = await db.query(
            `SELECT COUNT(*) as count FROM trx.journal_entries je
             WHERE je.status = 'PENDING' ${pendingFilter.sql}`,
            pendingFilter.params
        );

        const liquidAccounts = accounts.filter(acc => 
            ['CASH', 'BANK'].includes((acc.account_type || '').toUpperCase()) ||
            (acc.account_code && (acc.account_code.startsWith('1-1') || acc.account_code.startsWith('11')))
        );
        const totalCashLiquidity = liquidAccounts.reduce(
            (sum, acc) => sum + parseFloat(acc.committed_balance ?? acc.balance ?? 0),
            0
        );

        return {
            accounts,
            liquidAccounts,
            totalCashLiquidity,
            totalAP: parseFloat(apResult.rows[0].total_ap || 0),
            totalAR: parseFloat(arResult.rows[0].total_ar || 0),
            pendingApprovals: parseInt(pendingResult.rows[0].count || 0)
        };
    },

    async recordOverhead(data, userId) {
        return financeModel.createOverhead({ ...data, createdBy: userId });
    },

    async recordPurchasePayment(data, userId) {
        return financeModel.createPurchasePayment({ ...data, createdBy: userId });
    },



    async getPendingApprovals() {
        return financeModel.getPendingTransactions();
    },

    async approveTransaction(transactionId, accountId, userId) {
        if (!transactionId) throw new ValidationError('ID transaksi wajib diisi');
        if (!accountId) throw new ValidationError('ID rekening tujuan wajib diisi');
        return financeModel.approveTransaction(transactionId, accountId, userId);
    },

    /**
     * Bukti kas: approve several PENDING transactions as one cash movement (BKK/BKM).
     * All-or-nothing; every journal keeps its own accounts, each item its own cash account.
     */
    async payBatch({ items, voucherDate, notes }, userId) {
        const cashVoucherModel = require('../models/cashVoucher.model');
        const { BusinessRuleError } = require('../utils/errors');
        if (!items?.length) throw new ValidationError('Pilih minimal 1 transaksi');
        const date = voucherDate ? new Date(voucherDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const ids = items.map(i => i.journalId);
            const journals = await cashVoucherModel.lockJournals(ids, client);
            if (journals.length !== ids.length) throw new ValidationError('Sebagian transaksi tidak ditemukan');
            const done = journals.filter(j => j.status !== 'PENDING');
            if (done.length) throw new BusinessRuleError(`${done.length} transaksi sudah diproses sebelumnya, muat ulang halaman`);

            const nonCash = journals.filter(j => j.reference_type === 'TRANSFER' || !(Number(j.amount) > 0));
            if (nonCash.length) throw new BusinessRuleError(`${nonCash.map(j => j.description).join(', ')} tidak memindahkan uang kas, setujui terpisah`);

            const directions = new Set(journals.map(j => cashVoucherModel.directionOf(j.reference_type)));
            if (directions.size > 1) throw new BusinessRuleError('Kas masuk dan kas keluar tidak bisa digabung dalam satu bukti kas');
            const type = [...directions][0];

            const byId = Object.fromEntries(journals.map(j => [j.id, j]));
            let total = 0;
            const voucherItems = [];
            for (const it of items) {
                await financeModel._approveWithClient(client, it.journalId, it.accountId);
                const amount = Number(byId[it.journalId].amount) || 0;
                total += amount;
                voucherItems.push({ journalId: it.journalId, accountId: it.accountId, amount });
            }

            const voucherNo = await cashVoucherModel.nextVoucherNo(type, date, client);
            const id = await cashVoucherModel.insert({
                voucherNo, type, date, total: Math.round(total * 100) / 100,
                notes: (notes || '').trim() || null, createdBy: userId, items: voucherItems,
            }, client);
            await client.query('COMMIT');
            return cashVoucherModel.findById(id);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async getVouchers(query = {}) {
        return require('../models/cashVoucher.model').findAll({ limit: query.limit });
    },

    async getVoucherById(id) {
        const v = await require('../models/cashVoucher.model').findById(id);
        if (!v) { const { NotFoundError } = require('../utils/errors'); throw new NotFoundError('Bukti kas tidak ditemukan'); }
        return v;
    },

    async rejectTransaction(transactionId, userId) {
        if (!transactionId) throw new ValidationError('ID transaksi wajib diisi');
        return financeModel.rejectTransaction(transactionId, userId);
    },

    /**
     * Get financial report for a date range.
     * @param {string} startDate - ISO date string (e.g., '2026-07-01').
     * @param {string} endDate   - ISO date string (e.g., '2026-07-31').
     */
    async getReport(startDate, endDate) {
        const start = startDate;
        const end = endDate;

        // ─── PER-USER FILTERS ─────────────────────────────────────────
        // admin sees all data; everyone else (including owner) sees only their own.
        const salesF   = buildUserFilter('s',  3); // $1,$2 = dates
        const opexF    = buildUserFilter('oe', 3);
        const procF    = buildUserFilter('p',  3); // via JOIN trx.processes p
        const dryingF  = buildUserFilter('dp', 3); // via JOIN trx.drying_processes dp
        const logF     = buildUserFilter('lt', 3);
        const purchF   = buildUserFilter('pur', 3, 'filled_by');
        const ledgerF  = buildUserFilter('je', 3);

        // ─── INCOME STATEMENT ─────────────────────────────────────────
        // 1. Revenue: All CONFIRMED/DELIVERED/PAID sales in the period
        const salesResult = await db.query(
            `SELECT
                COALESCE(SUM(s.total_amount), 0) as revenue,
                COALESCE(COUNT(*), 0) as sale_count
             FROM trx.sales s
             WHERE DATE(s.sale_date) BETWEEN $1 AND $2
               AND s.status NOT IN ('VOID', 'DRAFT')
               ${salesF.sql}`,
            [start, end, ...salesF.params]
        );

        // Revenue Breakdown by Core (BERAS) vs Secondary (DEDAK, MENIR, SEKAM)
        const revenueSplitResult = await db.query(
            `SELECT
                CASE 
                    WHEN si.category_code = 'BERAS' THEN 'CORE'
                    ELSE 'SECONDARY'
                END as revenue_type,
                COALESCE(SUM(si.unit_price * si.qty_ordered), 0) as gross_amount
             FROM trx.sale_items si
             JOIN trx.sales s ON s.id = si.sale_id
             WHERE DATE(s.sale_date) BETWEEN $1 AND $2
               AND s.status NOT IN ('VOID', 'DRAFT')
               ${salesF.sql}
             GROUP BY 
                CASE 
                    WHEN si.category_code = 'BERAS' THEN 'CORE'
                    ELSE 'SECONDARY'
                END`,
            [start, end, ...salesF.params]
        );

        const returnSplitResult = await db.query(
            `SELECT
                CASE 
                    WHEN si.category_code = 'BERAS' THEN 'CORE'
                    WHEN si.category_code IS NULL THEN 'UNALLOCATED'
                    ELSE 'SECONDARY'
                END as revenue_type,
                COALESCE(SUM(sr.amount_adjusted), 0) as return_amount
             FROM trx.sale_returns sr
             JOIN trx.sales s ON s.id = sr.sale_id
             LEFT JOIN trx.sale_items si ON si.id = sr.sale_item_id
             WHERE DATE(s.sale_date) BETWEEN $1 AND $2
               AND s.status NOT IN ('VOID', 'DRAFT')
               ${salesF.sql}
             GROUP BY 
                CASE 
                    WHEN si.category_code = 'BERAS' THEN 'CORE'
                    WHEN si.category_code IS NULL THEN 'UNALLOCATED'
                    ELSE 'SECONDARY'
                END`,
            [start, end, ...salesF.params]
        );

        let coreGross = 0;
        let secondaryGross = 0;
        for (const row of revenueSplitResult.rows) {
            if (row.revenue_type === 'CORE') coreGross = parseFloat(row.gross_amount);
            if (row.revenue_type === 'SECONDARY') secondaryGross = parseFloat(row.gross_amount);
        }

        let coreReturn = 0;
        let secondaryReturn = 0;
        for (const row of returnSplitResult.rows) {
            if (row.revenue_type === 'CORE' || row.revenue_type === 'UNALLOCATED') {
                coreReturn += parseFloat(row.return_amount);
            }
            if (row.revenue_type === 'SECONDARY') {
                secondaryReturn += parseFloat(row.return_amount);
            }
        }

        const coreRevenue = coreGross - coreReturn;
        const secondaryRevenue = secondaryGross - secondaryReturn;

        // 2. COGS (HPP): Value of goods sold in the period
        const cogsResult = await db.query(
            `SELECT
                COALESCE(SUM(si.qty_ordered * COALESCE(si.hpp_per_unit, 0)), 0) as total_hpp
             FROM trx.sale_items si
             JOIN trx.sales s ON si.sale_id = s.id
             WHERE DATE(s.sale_date) BETWEEN $1 AND $2
               AND s.status NOT IN ('VOID', 'DRAFT')
               ${salesF.sql}`,
            [start, end, ...salesF.params]
        );

        // 3. OPEX Breakdown — from overhead_expenses table (approved journals only or legacy without journal)
        const opexDirectResult = await db.query(
            `SELECT
                oe.category,
                COALESCE(SUM(oe.amount), 0) as total
             FROM trx.overhead_expenses oe
             LEFT JOIN trx.journal_entries je ON je.reference_type = 'OVERHEAD' AND je.reference_id = oe.id
             WHERE DATE(oe.expense_date) BETWEEN $1 AND $2
               AND (je.status = 'APPROVED' OR je.id IS NULL)
               ${opexF.sql}
             GROUP BY oe.category`,
            [start, end, ...opexF.params]
        );

        // Process costs (join to processes to get created_by)
        const legacyProcessCost = await db.query(
            `SELECT COALESCE(SUM(pc.amount), 0) as total
             FROM trx.process_costs pc
             JOIN trx.processes p ON pc.process_id = p.id
             LEFT JOIN trx.journal_entries je ON je.id = pc.finance_transaction_id
             WHERE DATE(pc.created_at) BETWEEN $1 AND $2
               AND COALESCE(je.status, '') <> 'REJECTED'
               ${procF.sql}`,
            [start, end, ...procF.params]
        );

        // Drying costs (join to drying_processes to get created_by)
        const legacyDryingCost = await db.query(
            `SELECT COALESCE(SUM(dc.amount), 0) as total
             FROM trx.drying_costs dc
             JOIN trx.drying_processes dp ON dc.drying_id = dp.id
             LEFT JOIN trx.journal_entries je ON je.id = dc.finance_transaction_id
             WHERE DATE(dc.created_at) BETWEEN $1 AND $2
               AND COALESCE(je.status, '') <> 'REJECTED'
               ${dryingF.sql}`,
            [start, end, ...dryingF.params]
        );

        // Logistics costs
        const logisticsCostResult = await db.query(
            `SELECT COALESCE(SUM(lt.operational_cost) FILTER (WHERE COALESCE(tj.status, '') <> 'REJECTED' AND lt.reference_type = 'SALE'), 0) as total,
                    COALESCE(SUM(lt.operational_cost) FILTER (WHERE COALESCE(tj.status, '') <> 'REJECTED' AND lt.reference_type <> 'SALE'), 0) as purchase_transport,
                    COALESCE(SUM(lt.commission_amount) FILTER (WHERE COALESCE(cj.status, '') <> 'REJECTED'), 0) as commission_total
             FROM trx.logistics_tasks lt
             LEFT JOIN trx.journal_entries tj ON tj.id = lt.finance_transaction_id
             LEFT JOIN trx.journal_entries cj ON cj.id = lt.commission_transaction_id
             WHERE COALESCE(lt.shipment_date, DATE(lt.created_at)) BETWEEN $1 AND $2
               ${logF.sql}`,
            [start, end, ...logF.params]
        );

        // Potongan customer (kuli bongkar, dll) on confirmed nota
        const deductionResult = await db.query(
            `SELECT COALESCE(SUM(s.customer_deduction), 0) as total
             FROM trx.sales s
             WHERE DATE(s.sale_date) BETWEEN $1 AND $2
               AND s.status NOT IN ('VOID', 'DRAFT')
               ${salesF.sql}`,
            [start, end, ...salesF.params]
        );

        // Map OPEX breakdown into object
        const opexByCategory = {};
        for (const row of opexDirectResult.rows) {
            opexByCategory[row.category] = parseFloat(row.total);
        }
        const processTotal = parseFloat(legacyProcessCost.rows[0].total) || 0;
        const dryingTotal = parseFloat(legacyDryingCost.rows[0].total) || 0;
        const logisticsTotal = parseFloat(logisticsCostResult.rows[0].total) || 0;
        // Biaya produksi (transport beli gabah, jemur, giling) sudah masuk HPP/kg stok
        // (gabah → gabah kering → beras), jadi sudah terhitung di HPP saat beras terjual.
        // Tidak dikurangkan lagi sebagai OPEX; hanya ditampilkan sebagai info.
        const purchaseTransportTotal = parseFloat(logisticsCostResult.rows[0].purchase_transport) || 0;
        const productionCosts = {
            PURCHASE_TRANSPORT: purchaseTransportTotal,
            DRYING_COST: dryingTotal,
            PROCESS_COST: processTotal,
        };
        // OPEX logistik = biaya pengiriman penjualan saja
        if (logisticsTotal > 0) opexByCategory['LOGISTICS'] = (opexByCategory['LOGISTICS'] || 0) + logisticsTotal;
        // Komisi calo penjualan, recorded per pengiriman
        const commissionTotal = parseFloat(logisticsCostResult.rows[0].commission_total) || 0;
        if (commissionTotal > 0) opexByCategory['CALO_PAYOUT'] = (opexByCategory['CALO_PAYOUT'] || 0) + commissionTotal;
        const deductionTotal = parseFloat(deductionResult.rows[0].total) || 0;
        if (deductionTotal > 0) opexByCategory['SALE_DEDUCTION'] = (opexByCategory['SALE_DEDUCTION'] || 0) + deductionTotal;

        const totalOpex = Object.values(opexByCategory).reduce((sum, v) => sum + v, 0);

        // 4. Procurement (Pembelian Gabah - for reference only, not P&L)
        const purchaseResult = await db.query(
            `SELECT
                COALESCE(SUM(pur.total_harga), 0) as total_purchase,
                COALESCE(COUNT(*), 0) as purchase_count
             FROM trx.purchases pur
             WHERE DATE(pur.tanggal_belanja) BETWEEN $1 AND $2
               ${purchF.sql}`,
            [start, end, ...purchF.params]
        );

        // 5. Detailed Overhead List
        const overheads = await financeModel.getOverheads({ startDate: start, endDate: end });

        // ─── LEDGER (APPROVED transactions only) ──────────────────────
        const ledgerResult = await db.query(
            `SELECT
                je.id,
                je.transaction_date,
                fa.id as account_id,
                fa.name as account_name,
                je.description,
                CASE WHEN jl.debit > 0 THEN 'IN' ELSE 'OUT' END as transaction_type,
                CASE WHEN jl.debit > 0 THEN jl.debit ELSE jl.credit END as amount,
                je.reference_type as category,
                je.status,
                je.reference_type as source_module,
                u.username as created_by_name
             FROM trx.journal_entries je
             JOIN trx.journal_lines jl ON je.id = jl.journal_id
             JOIN trx.finance_accounts fa ON jl.account_id = fa.id
             LEFT JOIN sys.users u ON je.created_by = u.id
             WHERE DATE(je.transaction_date) BETWEEN $1 AND $2
               AND je.status = 'APPROVED'
               AND (fa.account_category = 'ASSET' OR fa.account_type IN ('CASH', 'BANK'))
               ${ledgerF.sql}
             ORDER BY je.transaction_date ASC`,
            [start, end, ...ledgerF.params]
        );

        // Pendapatan jasa titipan/giling (TITIPAN_FEE) — not a nota, so it was missing from Laba Rugi
        const titipanF = buildUserFilter('je', 3);
        const titipanResult = await db.query(
            `SELECT COALESCE(SUM(jl.credit), 0) as total, COUNT(DISTINCT je.id) as cnt
             FROM trx.journal_entries je
             JOIN trx.journal_lines jl ON jl.journal_id = je.id AND jl.credit > 0
             WHERE je.reference_type = 'TITIPAN_FEE'
               AND je.status <> 'REJECTED'
               AND DATE(je.transaction_date) BETWEEN $1 AND $2
               ${titipanF.sql}`,
            [start, end, ...titipanF.params]
        );
        const serviceRevenue = parseFloat(titipanResult.rows[0].total) || 0;

        // ─── CALCULATIONS ─────────────────────────────────────────────
        const salesRevenue = parseFloat(salesResult.rows[0].revenue);
        const revenue = salesRevenue + serviceRevenue;
        const hpp = parseFloat(cogsResult.rows[0].total_hpp);
        const grossProfit = revenue - hpp;
        const operatingProfit = grossProfit - totalOpex;
        const procurement = parseFloat(purchaseResult.rows[0].total_purchase);

        const grossMarginPct = revenue > 0 ? ((grossProfit / revenue) * 100) : 0;
        const operatingMarginPct = revenue > 0 ? ((operatingProfit / revenue) * 100) : 0;
        const operatingRatioPct = revenue > 0 ? ((totalOpex / revenue) * 100) : 0;

        return {
            startDate: start,
            endDate: end,
            summary: {
                revenue,
                revenueBreakdown: { core: coreRevenue, secondary: secondaryRevenue, service: serviceRevenue },
                salesRevenue,
                serviceRevenue,
                hpp,
                grossProfit,
                opex: totalOpex,
                opexBreakdown: opexByCategory,
                // Info: biaya produksi periode ini, sudah termasuk di HPP/kg (bukan pengurang laba lagi)
                productionCosts,
                productionCostsTotal: Object.values(productionCosts).reduce((sum, v) => sum + v, 0),
                operatingProfit,
                procurement,
                saleCount: parseInt(salesResult.rows[0].sale_count),
                purchaseCount: parseInt(purchaseResult.rows[0].purchase_count),
                grossMarginPct,
                operatingMarginPct,
                operatingRatioPct
            },
            overheads,
            ledger: ledgerResult.rows,
            procurement: {
                total: procurement,
                count: parseInt(purchaseResult.rows[0].purchase_count)
            }
        };
    },

    // Keep getDailyReport as alias for backward compatibility
    async getDailyReport(date) {
        return this.getReport(date, date);
    },

    async getBalanceSheet(asOfDate) {
        // Derive per-user SQL filters (strict multi-tenancy, admin included)
        // purchases uses 'filled_by'; inventory_items aliased as 'i' in query below
        const jeFilter = buildUserFilter('je', 1);
        const invFilter = buildUserFilter('i', 1);
        const arFilter = buildUserFilter('s', 1);
        const apFilter = buildUserFilter('p', 1, 'filled_by');

        // If no asOfDate is provided, calculate the CURRENT LIVE BALANCE (Ultra Fast)
        if (!asOfDate || asOfDate === new Date().toISOString().split('T')[0]) {
            // 1. Current Cash
            const cashResult = await db.query(
                `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as total_cash 
                 FROM trx.journal_lines jl
                 JOIN trx.journal_entries je ON jl.journal_id = je.id
                 JOIN trx.finance_accounts fa ON jl.account_id = fa.id
                 WHERE je.status = 'APPROVED' 
                   AND (fa.account_type IN ('CASH', 'BANK') OR fa.account_code LIKE '1-1%')
                   ${jeFilter.sql}`,
                jeFilter.params
            );
            const totalCash = parseFloat(cashResult.rows[0].total_cash);

            // 2. Current Inventory Value (alias 'i' matches invFilter)
            const inventoryResult = await db.query(
                `SELECT COALESCE(SUM(i.remaining_weight_kg * i.avg_price_per_kg), 0) as total_inventory
                 FROM trx.inventory_items i
                 WHERE i.remaining_weight_kg > 0 AND i.status != 'DEPLETED'
                   ${invFilter.sql}`,
                invFilter.params
            );
            const totalInventory = parseFloat(inventoryResult.rows[0].total_inventory);

            // 3. Current AR (Sales - Payments) 
            const arResult = await db.query(
                `SELECT COALESCE(SUM(GREATEST(s.outstanding, 0)), 0) as total_ar 
                 FROM trx.sales s
                 WHERE s.status NOT IN ('VOID', 'DRAFT') AND s.payment_status != 'PAID'
                   ${arFilter.sql}`,
                arFilter.params
            );
            const totalAR = parseFloat(arResult.rows[0].total_ar);

            // 4. Current AP (Purchases - Payments)
            const apResult = await db.query(
                `SELECT COALESCE(SUM(p.total_harga - p.paid_amount), 0) as total_ap 
                 FROM trx.purchases p
                 WHERE p.payment_status != 'PAID'
                   ${apFilter.sql}`,
                apFilter.params
            );
            const totalAP = parseFloat(apResult.rows[0].total_ap);

            const totalAssets = totalCash + totalInventory + totalAR;
            const totalLiabilities = totalAP;
            const equity = totalAssets - totalLiabilities;

            return {
                asOfDate: new Date().toISOString().split('T')[0],
                assets: {
                    cash: totalCash,
                    receivable: totalAR,
                    inventory: totalInventory,
                    totalCurrent: totalAssets,
                    totalFixed: 0,
                    total: totalAssets
                },
                liabilities: {
                    payable: totalAP,
                    total: totalLiabilities
                },
                equity,
                totalLiabilitiesAndEquity: totalLiabilities + equity,
                balanceCheck: 0
            };
        }

        const asOf = asOfDate;

        const histJeF = buildUserFilter('je', 2);
        const histInvF = buildUserFilter('i', 2);
        const histSalesF = buildUserFilter('s', 2);
        const histSalePayF = buildUserFilter('sp', 2);
        const histPurchF = buildUserFilter('p', 2, 'filled_by');
        const histPurchPayF = buildUserFilter('pp', 2);

        // 1. Total Cash (Historical)
        const cashResult = await db.query(
            `SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as total_cash 
             FROM trx.journal_lines jl
             JOIN trx.journal_entries je ON jl.journal_id = je.id
             JOIN trx.finance_accounts fa ON jl.account_id = fa.id
             WHERE je.status = 'APPROVED' 
               AND (fa.account_type IN ('CASH', 'BANK') OR fa.account_code LIKE '1-1%')
               AND DATE(je.transaction_date) <= $1
               ${histJeF.sql}`,
            [asOf, ...histJeF.params]
        );
        const totalCash = parseFloat(cashResult.rows[0].total_cash);

        // 2. Total Inventory Value (Historical weight * Current Avg Price)
        const inventoryResult = await db.query(
            `SELECT COALESCE(SUM(historical_weight * avg_price), 0) as total_inventory
             FROM (
                 SELECT 
                     i.id,
                     COALESCE(i.avg_price_per_kg, 0) as avg_price,
                     COALESCE(SUM(CASE WHEN t.transaction_type = 'IN' THEN t.weight_kg ELSE -t.weight_kg END), 0) as historical_weight
                 FROM trx.inventory_items i
                 LEFT JOIN trx.inventory_transactions t ON t.inventory_item_id = i.id AND DATE(t.created_at) <= $1
                 WHERE 1=1 ${histInvF.sql}
                 GROUP BY i.id, i.avg_price_per_kg
             ) sub`,
            [asOf, ...histInvF.params]
        );
        const totalInventory = parseFloat(inventoryResult.rows[0].total_inventory);

        // 3. Total Accounts Receivable/AR — two separate queries to avoid param index collision
        const arSalesResult = await db.query(
            `SELECT COALESCE(SUM(s.total_amount - COALESCE(s.customer_deduction, 0)), 0) as total
             FROM trx.sales s
             WHERE DATE(s.sale_date) <= $1
               AND s.status NOT IN ('VOID', 'DRAFT')
               ${histSalesF.sql}`,
            [asOf, ...histSalesF.params]
        );
        const arPayResult = await db.query(
            `SELECT COALESCE(SUM(sp.amount), 0) as total
             FROM trx.sale_payments sp
             WHERE DATE(sp.payment_date) <= $1
               ${histSalePayF.sql}`,
            [asOf, ...histSalePayF.params]
        );
        const totalAR = parseFloat(arSalesResult.rows[0].total) - parseFloat(arPayResult.rows[0].total);

        // 4. Total Accounts Payable/AP — two separate queries to avoid param index collision
        // purchases uses 'filled_by' (histPurchF), purchase_payments uses 'created_by' (histPurchPayF)
        const apPurchResult = await db.query(
            `SELECT COALESCE(SUM(p.total_harga), 0) as total
             FROM trx.purchases p
             WHERE DATE(p.tanggal_belanja) <= $1
               ${histPurchF.sql}`,
            [asOf, ...histPurchF.params]
        );
        const apPayResult = await db.query(
            `SELECT COALESCE(SUM(pp.amount), 0) as total
             FROM trx.purchase_payments pp
             WHERE DATE(pp.payment_date) <= $1
               ${histPurchPayF.sql}`,
            [asOf, ...histPurchPayF.params]
        );
        const totalAP = parseFloat(apPurchResult.rows[0].total) - parseFloat(apPayResult.rows[0].total);

        const totalCurrentAssets = totalCash + totalInventory + totalAR;
        const totalAssets = totalCurrentAssets;     // No fixed assets tracked yet
        const totalLiabilities = totalAP;
        const equity = totalAssets - totalLiabilities;

        // Balance check: Assets = Liabilities + Equity → selisih ideal = 0
        const balanceCheck = totalAssets - (totalLiabilities + equity);

        return {
            asOfDate: asOf,
            assets: {
                cash: totalCash,
                receivable: totalAR,
                inventory: totalInventory,
                totalCurrent: totalCurrentAssets,
                totalFixed: 0,
                total: totalAssets
            },
            liabilities: {
                payable: totalAP,
                total: totalLiabilities
            },
            equity,
            totalLiabilitiesAndEquity: totalLiabilities + equity,
            balanceCheck   // Should always be 0
        };
    },

    async getTransactionDetail(id) {
        if (!id) throw new ValidationError('ID transaksi wajib diisi');

        const jeResult = await db.query(
            `SELECT
                je.id,
                je.reference_type,
                je.reference_id,
                je.description,
                je.status,
                je.transaction_date,
                je.created_at,
                u.username as created_by_name,
                json_agg(
                    json_build_object(
                        'account_id', jl.account_id,
                        'account_name', fa.name,
                        'account_code', fa.account_code,
                        'account_category', fa.account_category,
                        'debit', jl.debit,
                        'credit', jl.credit
                    ) ORDER BY jl.debit DESC
                ) as lines
             FROM trx.journal_entries je
             JOIN trx.journal_lines jl ON jl.journal_id = je.id
             LEFT JOIN trx.finance_accounts fa ON fa.id = jl.account_id
             LEFT JOIN sys.users u ON u.id = je.created_by
             WHERE je.id = $1
             GROUP BY je.id, u.username`,
            [id]
        );

        if (jeResult.rows.length === 0) {
            const { NotFoundError } = require('../utils/errors');
            throw new NotFoundError('Transaksi tidak ditemukan');
        }

        const je = jeResult.rows[0];
        let relatedData = null;

        // Fetch related operational details based on reference_type
        if (je.reference_type === 'SALE' && je.reference_id) {
            const r = await db.query(
                `SELECT s.sale_no, s.total_amount, s.paid_amount, c.name as customer_name
                 FROM trx.sales s
                 LEFT JOIN trx.customers c ON s.customer_id = c.id
                 WHERE s.id = $1`,
                [je.reference_id]
            );
            if (r.rows.length > 0) relatedData = r.rows[0];
        } else if (je.reference_type === 'SALE_RETURN' && je.reference_id) {
            const r = await db.query(
                `SELECT s.sale_no, c.name as customer_name
                 FROM trx.sales s
                 LEFT JOIN trx.customers c ON s.customer_id = c.id
                 WHERE s.id = $1`,
                [je.reference_id]
            );
            if (r.rows.length > 0) relatedData = { ...r.rows[0], type: 'SALE_RETURN' };
        } else if (je.reference_type === 'PURCHASE' && je.reference_id) {
            const r = await db.query(
                `SELECT pp.*, p.tanggal_belanja, p.total_harga, p.nama as petani_name
                 FROM trx.purchase_payments pp
                 JOIN trx.purchases p ON pp.purchase_id = p.id
                 WHERE pp.id = $1`,
                [je.reference_id]
            );
            if (r.rows.length > 0) relatedData = r.rows[0];
        } else if (je.reference_type === 'MILLING' && je.reference_id) {
            const r = await db.query(
                `SELECT pc.*, p.process_no, p.status as process_status
                 FROM trx.process_costs pc
                 JOIN trx.processes p ON pc.process_id = p.id
                 WHERE pc.finance_transaction_id = $1`,
                [je.id]
            );
            if (r.rows.length > 0) relatedData = r.rows[0];
        } else if (je.reference_type === 'DRYING_COST' && je.reference_id) {
            const r = await db.query(
                `SELECT dc.*, dp.name as drying_name, dp.status as drying_status
                 FROM trx.drying_costs dc
                 JOIN trx.drying_processes dp ON dc.drying_id = dp.id
                 WHERE dc.finance_transaction_id = $1`,
                [je.id]
            );
            if (r.rows.length > 0) relatedData = r.rows[0];
        } else if (je.reference_type === 'LOGISTICS' && je.reference_id) {
            const r = await db.query(
                `SELECT lt.* FROM trx.logistics_tasks lt WHERE lt.finance_transaction_id = $1`,
                [je.id]
            );
            if (r.rows.length > 0) relatedData = r.rows[0];
        } else if (je.reference_type === 'CALO_PAYOUT' && je.reference_id) {
            const r = await db.query(
                `SELECT lt.* FROM trx.logistics_tasks lt WHERE lt.commission_transaction_id = $1`,
                [je.id]
            );
            if (r.rows.length > 0) relatedData = r.rows[0];
        } else if (je.reference_type === 'OVERHEAD' && je.reference_id) {
            const r = await db.query(
                `SELECT oe.* FROM trx.overhead_expenses oe WHERE oe.id = $1`,
                [je.reference_id]
            );
            if (r.rows.length > 0) relatedData = r.rows[0];
        }

        return { transaction: je, relatedData };
    },

    async transferFunds(data, userId) {
        const { fromAccountId, toAccountId, amount, description } = data;
        if (!fromAccountId || !toAccountId) throw new ValidationError('Rekening asal dan tujuan wajib diisi');
        if (fromAccountId === toAccountId) throw new ValidationError('Rekening asal dan tujuan tidak boleh sama');
        if (!amount || parseFloat(amount) <= 0) throw new ValidationError('Jumlah transfer harus lebih dari 0');

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const [fromRes, toRes] = await Promise.all([
                client.query('SELECT id, name FROM trx.finance_accounts WHERE id = $1 AND is_active = true', [fromAccountId]),
                client.query('SELECT id, name FROM trx.finance_accounts WHERE id = $1 AND is_active = true', [toAccountId])
            ]);
            if (!fromRes.rows[0]) throw new Error('Rekening asal tidak ditemukan atau tidak aktif');
            if (!toRes.rows[0]) throw new Error('Rekening tujuan tidak ditemukan atau tidak aktif');

            const fromAccount = fromRes.rows[0];
            const toAccount = toRes.rows[0];
            const amt = parseFloat(amount);

            // Double-entry: DR toAccount (cash in), CR fromAccount (cash out)
            await financeModel.createJournalEntry({
                referenceType: 'TRANSFER',
                referenceId: null,
                description: description || `Transfer: ${fromAccount.name} → ${toAccount.name}`,
                status: 'APPROVED',
                createdBy: userId,
                lines: [
                    { accountId: toAccountId,   debit: amt, credit: 0 },
                    { accountId: fromAccountId, debit: 0,   credit: amt }
                ]
            }, client);

            await client.query('COMMIT');
            return {
                success: true,
                amount: amt,
                from: fromAccount.name,
                to: toAccount.name
            };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async createManualTransaction(data, userId) {
        const { accountId, transactionType, amount, category, description } = data;
        if (!accountId) throw new ValidationError('Rekening wajib diisi');
        if (!transactionType || !['IN', 'OUT'].includes(transactionType)) throw new ValidationError('Tipe transaksi tidak valid');
        if (!amount || parseFloat(amount) <= 0) throw new ValidationError('Jumlah transaksi harus lebih dari 0');
        if (!category) throw new ValidationError('Kategori wajib diisi');

        const amt = parseFloat(amount);

        // The chosen cash/bank account is one side; the other side is the account the
        // category stands for. (Previously the other side was left open and got a cash
        // account on approval, so the entry moved money from cash to cash and changed nothing.)
        const MANUAL = {
            CAPITAL_IN:  { type: 'IN',  code: '3-100', label: 'Setoran Modal Pemilik' },
            CAPITAL_OUT: { type: 'OUT', code: '3-100', label: 'Penarikan Modal / Prive' },
            OVERHEAD:    { type: 'OUT', code: '5-600', label: 'Biaya Operasional' },
        };
        const rule = MANUAL[category];
        if (!rule) throw new ValidationError('Kategori transaksi manual tidak dikenal');
        if (rule.type !== transactionType) {
            throw new ValidationError(`${rule.label} harus bertipe ${rule.type === 'IN' ? 'Kas Masuk' : 'Kas Keluar'}`);
        }

        // Operasional goes through overhead so it also shows in Laba Rugi → Overhead
        if (category === 'OVERHEAD') {
            return financeModel.createOverhead({
                expenseDate: new Date(),
                category: 'Operasional',
                description: description || 'Transaksi manual kas keluar',
                amount: amt,
                frequency: 'ONE_TIME',
                paymentMethod: 'CASH',
                financeAccountId: accountId,
                createdBy: userId,
            });
        }

        const counterId = await financeModel.getRequiredAccountId(rule.code);
        const lines = transactionType === 'IN'
            ? [
                { accountId,            debit: amt, credit: 0 },   // Kas/Bank bertambah
                { accountId: counterId, debit: 0,   credit: amt }, // Modal
              ]
            : [
                { accountId: counterId, debit: amt, credit: 0 },   // Modal berkurang
                { accountId,            debit: 0,   credit: amt }, // Kas/Bank berkurang
              ];

        return financeModel.createJournalEntry({
            referenceType: category,
            referenceId: null,
            description: description || rule.label,
            status: 'PENDING',
            createdBy: userId,
            lines
        });
    },

    async getRecentActivity(limit = 10) {
        return financeModel.getRecentActivity(limit);
    },
};

module.exports = financeService;
