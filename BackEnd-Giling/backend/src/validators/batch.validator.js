const Joi = require('joi');
const { BATCH_STATUS } = require('../utils/constants');

const createBatchSchema = Joi.object({
  batchDate: Joi.date()
    .iso()
    .required()
    .messages({
      'date.format': 'Batch date must be in ISO format (YYYY-MM-DD)',
      'any.required': 'Batch date is required'
    }),
  status: Joi.string()
    .valid(...Object.values(BATCH_STATUS))
    .default(BATCH_STATUS.OPEN),
  jenisGabah: Joi.string()
    .required()
    .messages({
      'any.required': 'Jenis gabah is required'
    })
});

const updateBatchSchema = Joi.object({
  batchDate: Joi.date()
    .iso()
    .messages({
      'date.format': 'Batch date must be in ISO format (YYYY-MM-DD)'
    }),
  status: Joi.string()
    .valid(...Object.values(BATCH_STATUS)),
  is_active: Joi.boolean(),
  jenisGabah: Joi.string()
}).min(1);

const batchIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid batch ID format',
      'any.required': 'Batch ID is required'
    })
});

// For routes that use :batchId param
const batchIdParamSchema = Joi.object({
  batchId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid batch ID format',
      'any.required': 'Batch ID is required'
    })
});

module.exports = {
  createBatchSchema,
  updateBatchSchema,
  batchIdSchema,
  batchIdParamSchema
};

