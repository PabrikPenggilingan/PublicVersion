const Joi = require('joi');

const createLinkSchema = Joi.object({
    formType: Joi.string().valid('PURCHASE', 'MILLING', 'DRYING').optional().default('PURCHASE'),
    expiresAt: Joi.date().iso().optional().allow(null)
});

const toggleLinkSchema = Joi.object({
    isActive: Joi.boolean().required()
});

module.exports = {
    createLinkSchema,
    toggleLinkSchema
};
