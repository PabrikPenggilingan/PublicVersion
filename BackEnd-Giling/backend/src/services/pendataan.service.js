const { pendataanGabahModel, purchasesModel } = require('../models');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');

class PendataanService {
    async create(command) {
        // Check if purchase exists
        const purchase = await purchasesModel.findById(command.purchaseId);
        if (!purchase) {
            throw new NotFoundError('Batch Gabah (Purchase) tidak ditemukan');
        }

        // Check if pendataan already exists for this purchase
        const existing = await pendataanGabahModel.findByPurchaseId(command.purchaseId);
        if (existing) {
            throw new BusinessRuleError('Pendataan Gabah sudah ada untuk batch ini');
        }

        const pendataan = await pendataanGabahModel.create(command);
        return pendataan;
    }

    async getById(id) {
        const pendataan = await pendataanGabahModel.findById(id);
        if (!pendataan) {
            throw new NotFoundError('Pendataan Gabah tidak ditemukan');
        }
        return pendataan;
    }

    async getByPurchaseId(purchaseId) {
        const pendataan = await pendataanGabahModel.findByPurchaseId(purchaseId);
        return pendataan; // Can be null if not created yet
    }

    async getAll(limit = 50, offset = 0, filters = {}) {
        const pendataan = await pendataanGabahModel.getAll(filters, limit, offset);
        const total = await pendataanGabahModel.count(filters);
        return { data: pendataan, total };
    }

    async update(command) {
        await this.getById(command.id); // Verify exists
        const pendataan = await pendataanGabahModel.update(command.id, command.data);
        return pendataan;
    }

    async delete(id) {
        await this.getById(id); // Verify exists
        const deleted = await pendataanGabahModel.delete(id);
        return deleted;
    }
}

module.exports = new PendataanService();
