const Joi = require('joi');

const createLogisticsSchema = Joi.object({
    referenceType: Joi.string().valid('PURCHASE').required(),
    referenceId: Joi.string().uuid().required(),
    driverName: Joi.string().max(255).required(),
    crewNames: Joi.string().optional().allow('', null),
    origin: Joi.string().max(255).required(),
    destination: Joi.string().max(255).required(),
    durationHours: Joi.number().min(0).optional().allow(null),
    operationalCost: Joi.number().min(0).optional().allow(null),
    financeAccountId: Joi.string().uuid().optional().allow(null),
    status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional().default('PENDING'),
    notes: Joi.string().optional().allow('', null)
});

const updateLogisticsSchema = Joi.object({
    driverName: Joi.string().max(255).optional(),
    crewNames: Joi.string().optional().allow('', null),
    origin: Joi.string().max(255).optional(),
    destination: Joi.string().max(255).optional(),
    durationHours: Joi.number().min(0).optional().allow(null),
    operationalCost: Joi.number().min(0).optional().allow(null),
    status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
    notes: Joi.string().optional().allow('', null)
}).min(1);

const getLogisticsTasksSchema = Joi.object({
    referenceType: Joi.string().valid('PURCHASE', 'SALE').optional().allow('', null),
    status: Joi.string().valid('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional().allow('', null)
});

// Pengiriman penjualan (1 mobil, bisa banyak nota) — sales go through these, not createLogisticsSchema
const saleShipmentSchema = Joi.object({
    saleIds: Joi.array().items(Joi.string().uuid()).min(1).unique().required(),
    shipmentDate: Joi.date().iso().optional().allow(null, ''),
    driverName: Joi.string().trim().max(255).optional().allow('', null),
    crewNames: Joi.string().max(1000).optional().allow('', null),
    origin: Joi.string().max(255).optional().allow('', null),
    destination: Joi.string().max(255).optional().allow('', null),
    durationHours: Joi.number().min(0).optional().allow(null, ''),
    operationalCost: Joi.number().min(0).precision(2).optional().allow(null, ''),
    commissionRatePerKg: Joi.number().min(0).precision(2).optional().allow(null, ''),
    commissionAmount: Joi.number().min(0).precision(2).optional().allow(null, ''),
    commissionRecipient: Joi.string().max(255).optional().allow('', null),
    notes: Joi.string().max(2000).optional().allow('', null)
});

const shipmentIdParamSchema = Joi.object({
    id: Joi.string().uuid().required()
});

const availableSalesQuerySchema = Joi.object({
    excludeShipmentId: Joi.string().uuid().optional().allow('', null)
});

const getAvailableReferencesSchema = Joi.object({
    type: Joi.string().valid('PURCHASE', 'SALE').required()
});

module.exports = {
    createLogisticsSchema,
    updateLogisticsSchema,
    getLogisticsTasksSchema,
    getAvailableReferencesSchema,
    saleShipmentSchema,
    shipmentIdParamSchema,
    availableSalesQuerySchema
};
