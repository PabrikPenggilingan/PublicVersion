const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

// Bukti kas (BKK / BKM): several pending transactions approved as one cash movement.
// Each journal keeps its own expense/revenue account; the voucher only groups them.

// Same direction rule as financeModel.getPendingTransactions
const IN_TYPES = ['SALE', 'SALE_PAYMENT', 'TITIPAN_FEE', 'CAPITAL_IN'];

function currentUser() {
    const user = requestContext.getStore()?.user;
    if (!user) throw new Error('STRICT TENANCY ENFORCEMENT: User context is required for cash vouchers.');
    return { user, isAdminOnly: (user.role || '').toLowerCase() === 'super_admin' };
}

const VOUCHER_SELECT = `
    SELECT v.id, v.voucher_no, v.voucher_type, v.voucher_date, v.total_amount, v.notes,
           v.created_at, u.username AS created_by_name,
           COALESCE((
               SELECT json_agg(json_build_object(
                          'journal_id', i.journal_id,
                          'amount', i.amount,
                          'account_id', i.account_id,
                          'account_name', fa.name,
                          'category', j.reference_type,
                          'description', j.description,
                          'status', j.status,
                          'transaction_date', j.transaction_date
                      ) ORDER BY j.transaction_date, j.description)
               FROM trx.cash_voucher_items i
               JOIN trx.journal_entries j ON j.id = i.journal_id
               LEFT JOIN trx.finance_accounts fa ON fa.id = i.account_id
               WHERE i.voucher_id = v.id
           ), '[]'::json) AS items
    FROM trx.cash_vouchers v
    LEFT JOIN sys.users u ON u.id = v.created_by`;

const cashVoucherModel = {
    IN_TYPES,

    directionOf(referenceType) {
        return IN_TYPES.includes(referenceType) ? 'IN' : 'OUT';
    },

    /** Lock the journals and return them with their amount; enforces tenancy. */
    async lockJournals(journalIds, client) {
        const { user, isAdminOnly } = currentUser();
        const res = await client.query(
            `SELECT j.id, j.status, j.reference_type, j.description, j.created_by,
                    (SELECT COALESCE(SUM(jl.debit + jl.credit), 0)
                     FROM trx.journal_lines jl
                     LEFT JOIN trx.finance_accounts fa ON jl.account_id = fa.id
                     WHERE jl.journal_id = j.id AND (jl.account_id IS NULL OR fa.account_type IN ('CASH', 'BANK') OR fa.account_code LIKE '1-1%')) AS amount
             FROM trx.journal_entries j
             WHERE j.id = ANY($1::uuid[])
             FOR UPDATE OF j`,
            [journalIds]
        );
        return res.rows.filter(r => isAdminOnly || inTenant(r.created_by, user));
    },

    async nextVoucherNo(type, date, client) {
        const prefix = `${type === 'IN' ? 'BKM' : 'BKK'}/${date.slice(0, 4)}/${date.slice(5, 7)}/`;
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('trx.cash_vouchers.voucher_no'))`);
        const res = await client.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(voucher_no FROM '[0-9]+$') AS INTEGER)), 0) AS last
             FROM trx.cash_vouchers WHERE voucher_no LIKE $1`,
            [`${prefix}%`]
        );
        return prefix + String(Number(res.rows[0].last) + 1).padStart(3, '0');
    },

    async insert({ voucherNo, type, date, total, notes, createdBy, items }, client) {
        const res = await client.query(
            `INSERT INTO trx.cash_vouchers (voucher_no, voucher_type, voucher_date, total_amount, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [voucherNo, type, date, total, notes, createdBy]
        );
        const id = res.rows[0].id;
        for (const it of items) {
            await client.query(
                `INSERT INTO trx.cash_voucher_items (voucher_id, journal_id, account_id, amount) VALUES ($1, $2, $3, $4)`,
                [id, it.journalId, it.accountId, it.amount]
            );
        }
        return id;
    },

    async findAll({ limit = 50 } = {}) {
        const { user, isAdminOnly } = currentUser();
        const params = [Math.min(Number(limit) || 50, 200)];
        let where = '';
        if (!isAdminOnly) { params.push(tenantIds(user)); where = 'WHERE v.created_by = ANY($2::uuid[])'; }
        const res = await db.query(`${VOUCHER_SELECT} ${where} ORDER BY v.voucher_date DESC, v.voucher_no DESC LIMIT $1`, params);
        return res.rows;
    },

    async findById(id) {
        const { user, isAdminOnly } = currentUser();
        const params = [id];
        let where = 'WHERE v.id = $1';
        if (!isAdminOnly) { params.push(tenantIds(user)); where += ' AND v.created_by = ANY($2::uuid[])'; }
        const res = await db.query(`${VOUCHER_SELECT} ${where}`, params);
        return res.rows[0] || null;
    },

    /** voucher_no per journal id, for showing "dibayar lewat BKK/…" elsewhere */
    async findNumbersByJournalIds(journalIds) {
        const ids = (journalIds || []).filter(Boolean);
        if (!ids.length) return {};
        const res = await db.query(
            `SELECT i.journal_id, v.voucher_no, v.voucher_date, v.id AS voucher_id
             FROM trx.cash_voucher_items i JOIN trx.cash_vouchers v ON v.id = i.voucher_id
             WHERE i.journal_id = ANY($1::uuid[])`,
            [ids]
        );
        return Object.fromEntries(res.rows.map(r => [r.journal_id, r]));
    },
};

module.exports = cashVoucherModel;
