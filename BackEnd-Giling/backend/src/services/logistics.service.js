const logisticsModel = require('../models/logistics.model');
const financeModel = require('../models/finance.model');
const db = require('../config/database');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');

const logisticsService = {
    async createLogisticsTask(command) {
        let financeTransactionId = null;

        // Jika ada biaya operasional, otomatis buat transaksi pengeluaran dari Kas
        if (command.operationalCost && parseFloat(command.operationalCost) > 0) {
            const expId = await financeModel.getRequiredAccountId('5-200');

            const financeTx = await financeModel.createJournalEntry({
                referenceType: 'LOGISTICS',
                referenceId: command.referenceId,
                description: `Biaya Logistik: ${command.driverName || 'Sopir'} (${command.vehiclePlate || 'Kendaraan'})`,
                status: 'PENDING',
                createdBy: command.userId,
                lines: [
                    { accountId: expId, debit: Number(command.operationalCost), credit: 0 },
                    { accountId: null, debit: 0, credit: Number(command.operationalCost) }
                ]
            });

            financeTransactionId = financeTx.id;
        }

        // Buat task logistik
        return logisticsModel.create({
            referenceType: command.referenceType,
            referenceId: command.referenceId,
            driverName: command.driverName,
            vehiclePlate: command.vehiclePlate,
            status: command.status,
            operationalCost: command.operationalCost,
            departureTime: command.departureTime,
            arrivalTime: command.arrivalTime,
            notes: command.notes,
            financeTransactionId,
            createdBy: command.userId
        });
    },

    async updateLogisticsTask(command) {
        const existing = await logisticsModel.findById(command.id);
        if (!existing) throw new NotFoundError('Data logistik tidak ditemukan');

        // Jika mengubah biaya operasional, untuk tahap awal/sederhana kita tidak me-revert finance transaction
        // asumsikan biaya bersifat final atau dikelola secara terpisah oleh admin finance jika ada revisi
        // (Bisa ditambahkan logika void finance_transaction jika diperlukan di masa depan)

        return logisticsModel.update(command.id, command.data);
    },

    async getLogisticsTaskById(id) {
        const task = await logisticsModel.findById(id);
        if (!task) throw new NotFoundError('Data logistik tidak ditemukan');
        return task;
    },

    async getAllLogisticsTasks(filters) {
        return logisticsModel.findAll(filters);
    },

    async getAvailableReferences(type) {
        return logisticsModel.getAvailableReferences(type);
    }
};

module.exports = logisticsService;
