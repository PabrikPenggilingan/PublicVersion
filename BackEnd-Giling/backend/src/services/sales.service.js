const { salesBerasModel, salesSimplifiedModel, processesModel } = require('../models');
const { NotFoundError, BusinessRuleError } = require('../utils/errors');
const SalesMapper = require('../mappers/sales.mapper');

class SalesService {
    // ====== BERAS (DETAILED) ======
    async createBerasSale(command) {
        // Check if process exists
        const process = await processesModel.findById(command.processId);
        if (!process) {
            throw new NotFoundError('Process not found');
        }

        const saleData = SalesMapper.toBerasPersistence(command);
        const sale = await salesBerasModel.create(saleData);
        return SalesMapper.toBerasResponse(sale);
    }

    async getBerasSaleById(id) {
        const sale = await salesBerasModel.findById(id);
        if (!sale) {
            throw new NotFoundError('Beras sale not found');
        }
        return SalesMapper.toBerasResponse(sale);
    }

    async updateBerasSale(command) {
        await this.getBerasSaleById(command.id);

        const updateData = SalesMapper.toBerasPersistence(command);
        // Remove process_id from updateData as it shouldn't be updated here
        delete updateData.process_id;
        
        // Remove undefined keys so we don't accidentally wipe existing values
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const updatedSale = await salesBerasModel.update(command.id, updateData);
        return SalesMapper.toBerasResponse(updatedSale);
    }

    async deleteBerasSale(id) {
        await this.getBerasSaleById(id);
        const deletedSale = await salesBerasModel.delete(id);
        return SalesMapper.toBerasResponse(deletedSale);
    }

    // ====== SIMPLIFIED (DEDAK, SEKAM, MENIR, BROKEN) ======
    async createSimplifiedSale(command) {
        // Validate type
        const validTypes = ['dedak', 'sekam', 'menir', 'broken'];
        if (!validTypes.includes(command.type)) {
            throw new BusinessRuleError(`Invalid sale type: ${command.type}. Must be one of: ${validTypes.join(', ')}`);
        }

        // Check if process exists
        const process = await processesModel.findById(command.processId);
        if (!process) {
            throw new NotFoundError('Process not found');
        }

        const saleData = SalesMapper.toSimplifiedPersistence(command);
        const sale = await salesSimplifiedModel.create(command.type, saleData);
        return SalesMapper.toSimplifiedResponse(sale);
    }

    async getSimplifiedSaleById(type, id) {
        const sale = await salesSimplifiedModel.findById(type, id);
        if (!sale) {
            throw new NotFoundError(`${type} sale not found`);
        }
        return SalesMapper.toSimplifiedResponse(sale);
    }

    async updateSimplifiedSale(command) {
        await this.getSimplifiedSaleById(command.type, command.id);

        const updateData = SalesMapper.toSimplifiedPersistence(command);
        delete updateData.process_id;
        
        Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

        const updatedSale = await salesSimplifiedModel.update(command.type, command.id, updateData);
        return SalesMapper.toSimplifiedResponse(updatedSale);
    }

    async deleteSimplifiedSale(type, id) {
        await this.getSimplifiedSaleById(type, id);
        const deletedSale = await salesSimplifiedModel.delete(type, id);
        return SalesMapper.toSimplifiedResponse(deletedSale);
    }

    // ====== GET ALL SALES BY PROCESS ======
    async getSalesByProcessId(processId) {
        // Check if process exists
        const process = await processesModel.findById(processId);
        if (!process) {
            throw new NotFoundError('Process not found');
        }

        const beras = await salesBerasModel.getByProcessId(processId);
        const simplified = await salesSimplifiedModel.getAllByProcessId(processId);

        return SalesMapper.toProcessSalesResponse({
            beras,
            ...simplified
        });
    }
}

module.exports = new SalesService();
