const Joi = require('joi');

const createPendataanSchema = Joi.object({
    purchaseId: Joi.string().uuid().required(),
    jenisGabah: Joi.string().max(100).optional().allow('', null),
    varietas: Joi.string().max(100).optional().allow('', null),
    kondisiGabah: Joi.string().max(100).optional().allow('', null),
    kadarAir: Joi.number().min(0).max(100).optional().allow(null),
    kadarHampa: Joi.number().min(0).max(100).optional().allow(null),
    butirRusak: Joi.number().min(0).max(100).optional().allow(null),
    bendaAsing: Joi.number().min(0).max(100).optional().allow(null),
    notes: Joi.string().optional().allow('', null)
});

const updatePendataanSchema = Joi.object({
    jenisGabah: Joi.string().max(100).optional().allow('', null),
    varietas: Joi.string().max(100).optional().allow('', null),
    kondisiGabah: Joi.string().max(100).optional().allow('', null),
    kadarAir: Joi.number().min(0).max(100).optional().allow(null),
    kadarHampa: Joi.number().min(0).max(100).optional().allow(null),
    butirRusak: Joi.number().min(0).max(100).optional().allow(null),
    bendaAsing: Joi.number().min(0).max(100).optional().allow(null),
    notes: Joi.string().optional().allow('', null)
}).min(1);

const getAllPendataanSchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional().default(50),
    offset: Joi.number().integer().min(0).optional().default(0)
});

module.exports = {
    createPendataanSchema,
    updatePendataanSchema,
    getAllPendataanSchema
};
