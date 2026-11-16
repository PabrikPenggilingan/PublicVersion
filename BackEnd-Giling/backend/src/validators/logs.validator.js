const Joi = require('joi');

const getAllLogsSchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(50),
    action: Joi.string().optional().allow('', null),
    entityType: Joi.string().optional().allow('', null),
    userId: Joi.string().uuid().optional().allow('', null)
});

const getLogsByEntitySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional().default(50),
    offset: Joi.number().integer().min(0).optional().default(0)
});

const getMyLogsSchema = Joi.object({
    limit: Joi.number().integer().min(1).max(100).optional().default(50),
    offset: Joi.number().integer().min(0).optional().default(0)
});

const getActivitySummarySchema = Joi.object({
    days: Joi.number().integer().min(1).max(365).optional().default(7)
});

module.exports = {
    getAllLogsSchema,
    getLogsByEntitySchema,
    getMyLogsSchema,
    getActivitySummarySchema
};
