const financeModel = require('../models/finance.model');
const { BusinessRuleError } = require('./errors');

// Keeps an editable cost (shipment transport, komisi calo, potongan customer) in step with
// its single journal entry. All helpers take a pg client so they run inside the caller's
// transaction.

const round2 = (n) => Math.round(n * 100) / 100;

async function getJournal(id, client) {
    if (!id) return null;
    const r = await client.query(`SELECT id, status FROM trx.journal_entries WHERE id = $1`, [id]);
    return r.rows[0] || null;
}

async function journalAmount(id, client) {
    const r = await client.query(`SELECT COALESCE(SUM(debit), 0) AS amount FROM trx.journal_lines WHERE journal_id = $1`, [id]);
    return round2(Number(r.rows[0].amount));
}

async function deleteJournal(id, client) {
    await client.query(`DELETE FROM trx.journal_lines WHERE journal_id = $1`, [id]);
    await client.query(`DELETE FROM trx.journal_entries WHERE id = $1`, [id]);
}

/**
 * Returns the journal id that now represents `amount`.
 * APPROVED journals are final (Finance already booked them); changing their amount is refused.
 * PENDING journals are replaced when the amount changes; REJECTED ones are re-requested.
 */
async function syncExpenseJournal({ currentId, amount, label, build }, client) {
    const current = await getJournal(currentId, client);

    if (current?.status === 'APPROVED') {
        const approvedAmount = await journalAmount(current.id, client);
        if (Math.abs(approvedAmount - amount) >= 0.01) {
            throw new BusinessRuleError(`${label} sudah disetujui Keuangan (Rp ${approvedAmount.toLocaleString('id-ID')}) dan tidak bisa diubah lagi`);
        }
        return current.id;
    }

    if (current?.status === 'PENDING') {
        const pendingAmount = await journalAmount(current.id, client);
        if (Math.abs(pendingAmount - amount) < 0.01) return current.id;
        await deleteJournal(current.id, client);
    }

    if (amount <= 0) return null;
    const created = await financeModel.createJournalEntry(build(), client);
    return created.id;
}

/**
 * Undo a journal when its source goes away (e.g. a voided nota):
 * PENDING → deleted, APPROVED → reversed with an APPROVED mirror entry.
 */
async function cancelJournal(id, { description, createdBy }, client) {
    const journal = await getJournal(id, client);
    if (!journal) return;
    if (journal.status === 'PENDING') {
        await deleteJournal(journal.id, client);
        return;
    }
    if (journal.status !== 'APPROVED') return;

    const lines = await client.query('SELECT account_id, debit, credit FROM trx.journal_lines WHERE journal_id = $1', [journal.id]);
    await financeModel.createJournalEntry({
        referenceType: 'VOID',
        referenceId: journal.id,
        description,
        status: 'APPROVED',
        createdBy,
        lines: lines.rows.map(l => ({ accountId: l.account_id, debit: Number(l.credit), credit: Number(l.debit) })),
    }, client);
}

module.exports = { round2, getJournal, journalAmount, deleteJournal, syncExpenseJournal, cancelJournal };
