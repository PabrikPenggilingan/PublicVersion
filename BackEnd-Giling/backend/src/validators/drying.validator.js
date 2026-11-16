const Joi = require('joi');

const createDryingSchema = Joi.object({
    name: Joi.string().optional().allow('', null),
    notes: Joi.string().optional().allow('', null),
    batchIds: Joi.array().items(Joi.string().uuid()).optional().default([]),
    dryingType: Joi.string().valid('lantai_mandiri', 'oven_mandiri', 'lantai_vendor', 'oven_vendor').optional(),
    vendorName: Joi.string().optional().allow('', null),
    titipanInventoryId: Joi.string().uuid().optional().allow(null)
});

const updateBatchesSchema = Joi.object({
    batchIds: Joi.array().items(Joi.string().uuid()).required()
});

const toggleActiveSchema = Joi.object({
    isActive: Joi.boolean().required()
});

const createLinkSchema = Joi.object({
    expiresAt: Joi.date().iso().optional().allow(null)
});

const toggleLinkSchema = Joi.object({
    isActive: Joi.boolean().required()
});

const addCostSchema = Joi.object({
    costType: Joi.string().required(),
    description: Joi.string().optional().allow('', null),
    amount: Joi.number().positive().required()
});

module.exports = {
    createDryingSchema,
    updateBatchesSchema,
    toggleActiveSchema,
    createLinkSchema,
    toggleLinkSchema,
    addCostSchema
};
