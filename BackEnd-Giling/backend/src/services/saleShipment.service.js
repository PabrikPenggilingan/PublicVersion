const db = require('../config/database');
const financeModel = require('../models/finance.model');
const saleShipmentModel = require('../models/saleShipment.model');
const { NotFoundError, ValidationError, BusinessRuleError } = require('../utils/errors');
const { round2, getJournal, deleteJournal, syncExpenseJournal } = require('../utils/journalSync');

// Pengiriman penjualan (1 mobil = 1 pengiriman, bisa banyak nota).
// The nota stay the official invoices (customer pays them in full); this records what the
// factory pays for the trip:
//   - transport  → PENDING journal LOGISTICS   : Dr 5-200 Beban Logistik / Cr Kas (on approval)
//   - komisi calo → PENDING journal CALO_PAYOUT : Dr 5-500 Beban Komisi Calo / Cr Kas (on approval)
// Komisi = tarif/kg × total kg in the truck, unless the user typed a total.

function parseAmount(raw, label) {
    if (raw === undefined || raw === null || raw === '') return 0;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) throw new ValidationError(`${label} tidak boleh negatif`);
    return round2(value);
}

function normalizeInput(input) {
    const saleIds = [...new Set((input.saleIds || []).filter(Boolean))];
    if (saleIds.length === 0) throw new ValidationError('Pilih minimal 1 nota untuk pengiriman ini');

    const driverName = (input.driverName || '').trim() || null;

    const durationHours = input.durationHours === undefined || input.durationHours === null || input.durationHours === ''
        ? null : parseAmount(input.durationHours, 'Durasi');

    return {
        saleIds,
        shipmentDate: input.shipmentDate || new Date().toISOString().slice(0, 10),
        driverName,
        crewNames: (input.crewNames || '').trim() || null,
        origin: (input.origin || '').trim() || null,
        destination: (input.destination || '').trim() || null,
        durationHours,
        operationalCost: parseAmount(input.operationalCost, 'Biaya transport'),
        commissionRatePerKg: parseAmount(input.commissionRatePerKg, 'Tarif komisi'),
        commissionAmountInput: input.commissionAmount === undefined || input.commissionAmount === null || input.commissionAmount === ''
            ? null : parseAmount(input.commissionAmount, 'Total komisi'),
        commissionRecipient: (input.commissionRecipient || '').trim() || null,
        notes: (input.notes || '').trim() || null,
    };
}

async function loadSales(saleIds, shipmentId, client) {
    const sales = await saleShipmentModel.getSalesWithWeight(saleIds, client);
    if (sales.length !== saleIds.length) throw new NotFoundError('Sebagian nota tidak ditemukan');

    const voided = sales.filter(s => s.status === 'VOID');
    if (voided.length) throw new BusinessRuleError(`Nota ${voided.map(s => s.sale_no).join(', ')} sudah dibatalkan (VOID)`);

    const links = await saleShipmentModel.findSaleShipmentIds(saleIds, client);
    const taken = links.filter(l => l.logistics_task_id !== shipmentId);
    if (taken.length) {
        const nos = sales.filter(s => taken.some(t => t.sale_id === s.id)).map(s => s.sale_no);
        throw new BusinessRuleError(`Nota ${nos.join(', ')} sudah masuk pengiriman lain`);
    }

    // Keep the user's order, oldest nota first is the "main" reference
    sales.sort((a, b) => new Date(a.sale_date) - new Date(b.sale_date) || String(a.sale_no).localeCompare(String(b.sale_no)));
    return sales;
}

const saleShipmentService = {
    async getAll() {
        return saleShipmentModel.findAll();
    },

    async getById(id) {
        const shipment = await saleShipmentModel.findById(id);
        if (!shipment) throw new NotFoundError('Pengiriman tidak ditemukan');
        return shipment;
    },

    async getAvailableSales(excludeShipmentId) {
        return saleShipmentModel.getAvailableSales(excludeShipmentId);
    },

    async save(id, input, userId) {
        const data = normalizeInput(input);

        const [expId, komisiId] = await Promise.all([
            financeModel.getRequiredAccountId('5-200'),
            financeModel.getRequiredAccountId('5-500'),
        ]);

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            let existing = null;
            if (id) {
                existing = await saleShipmentModel.findById(id, client);
                if (!existing) throw new NotFoundError('Pengiriman tidak ditemukan');
            }

            const sales = await loadSales(data.saleIds, id || null, client);
            const totalKg = sales.reduce((sum, s) => sum + Number(s.total_kg || 0), 0);
            const commissionAmount = data.commissionAmountInput !== null
                ? data.commissionAmountInput
                : Math.round(data.commissionRatePerKg * totalKg);

            const row = {
                ...data,
                referenceId: sales[0].id,
                commissionAmount,
                createdBy: userId,
            };

            const shipment = existing
                ? await saleShipmentModel.update(id, row, client)
                : await saleShipmentModel.insert(row, client);

            await saleShipmentModel.replaceSales(shipment.id, sales.map(s => s.id), client);

            const saleNos = sales.map(s => s.sale_no).join(', ');
            const kgText = totalKg.toLocaleString('id-ID');

            const transportJournalId = await syncExpenseJournal({
                currentId: existing?.finance_transaction_id,
                amount: data.operationalCost,
                label: 'Biaya transport',
                build: () => ({
                    referenceType: 'LOGISTICS',
                    referenceId: shipment.id,
                    description: `Biaya Transport Penjualan${data.driverName ? `: ${data.driverName}` : ''} (${kgText} kg, nota ${saleNos})`,
                    status: 'PENDING',
                    createdBy: userId,
                    lines: [
                        { accountId: expId, debit: data.operationalCost, credit: 0 },
                        { accountId: null, debit: 0, credit: data.operationalCost },
                    ],
                }),
            }, client);

            const commissionJournalId = await syncExpenseJournal({
                currentId: existing?.commission_transaction_id,
                amount: commissionAmount,
                label: 'Komisi calo',
                build: () => ({
                    referenceType: 'CALO_PAYOUT',
                    referenceId: shipment.id,
                    description: `Komisi Calo${data.commissionRecipient ? ` ${data.commissionRecipient}` : ''}: ${kgText} kg` +
                        (data.commissionRatePerKg > 0 ? ` × Rp ${data.commissionRatePerKg.toLocaleString('id-ID')}/kg` : '') +
                        ` (nota ${saleNos})`,
                    status: 'PENDING',
                    createdBy: userId,
                    lines: [
                        { accountId: komisiId, debit: commissionAmount, credit: 0 },
                        { accountId: null, debit: 0, credit: commissionAmount },
                    ],
                }),
            }, client);

            await saleShipmentModel.setJournalIds(shipment.id, { transportJournalId, commissionJournalId }, client);

            await client.query('COMMIT');
            return saleShipmentModel.findById(shipment.id);
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },

    async delete(id) {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');
            const existing = await saleShipmentModel.findById(id, client);
            if (!existing) throw new NotFoundError('Pengiriman tidak ditemukan');

            for (const journalId of [existing.finance_transaction_id, existing.commission_transaction_id]) {
                const journal = await getJournal(journalId, client);
                if (journal?.status === 'APPROVED') {
                    throw new BusinessRuleError('Biaya pengiriman ini sudah disetujui Keuangan, pengiriman tidak bisa dihapus');
                }
                if (journal?.status === 'PENDING') await deleteJournal(journal.id, client);
            }

            await saleShipmentModel.delete(id, client);
            await client.query('COMMIT');
            return { id };
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    },
};

module.exports = saleShipmentService;
