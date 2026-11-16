const Joi = require('joi');
const { PROCESS_STATUS } = require('../utils/constants');

const createProcessSchema = Joi.object({
  inventoryItemId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Pilih item gabah dari inventory terlebih dahulu',
      'string.uuid': 'ID Inventory tidak valid'
    }),
  gabahReservedKg: Joi.number()
    .positive()
    .required()
    .messages({
      'any.required': 'Jumlah gabah yang akan digiling harus diisi',
      'number.positive': 'Jumlah gabah harus lebih dari 0'
    }),
  processDate: Joi.date()
    .iso()
    .required()
    .messages({
      'any.required': 'Tanggal proses harus diisi'
    }),
  notes: Joi.string()
    .allow(null, '')
});

const updateProcessSchema = Joi.object({
  processDate: Joi.date().iso(),
  endDate: Joi.date().iso().allow(null),
  status: Joi.string().valid(...Object.values(PROCESS_STATUS)),
  notes: Joi.string().allow(null, '')
}).min(1);

const attachBatchSchema = Joi.object({
  batchId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Batch ID is required'
    }),
  qtyUsedKg: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.positive': 'Quantity used must be positive',
      'any.required': 'Quantity used is required'
    })
});

module.exports = {
  createProcessSchema,
  updateProcessSchema,
  attachBatchSchema
};
