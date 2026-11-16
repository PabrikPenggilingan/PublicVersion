const Joi = require('joi');

const submitStartSchema = Joi.object({
    pic: Joi.string().min(2).max(100).required(),
    peopleInvolved: Joi.string().max(500).optional().allow('', null),
    sessionDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    sessionTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    tonnageKg: Joi.number().integer().min(1).required(),
    moistureContent: Joi.number().min(0).max(100).optional().allow('', null),
    batchId: Joi.string().uuid().optional().allow('', null)
});

const submitEndSchema = Joi.object({
    pic: Joi.string().min(2).max(100).required(),
    peopleInvolved: Joi.string().max(500).optional().allow('', null),
    sessionDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    sessionTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    tonnageKg: Joi.number().integer().min(1).required(),
    moistureContent: Joi.number().min(0).max(100).optional().allow('', null),
    wasteKg: Joi.number().min(0).optional().allow('', null),
    wasteReason: Joi.string().max(500).optional().allow('', null)
});

module.exports = {
    submitStartSchema,
    submitEndSchema
};
