const Joi = require('joi');
const { KUALITAS_GABAH, KONDISI_GABAH } = require('../utils/constants');

const createPurchaseSchema = Joi.object({
  nama: Joi.string()
    .max(255)
    .allow(null, '')
    .optional(),
  tanggalBelanja: Joi.date()
    .iso()
    .allow(null)
    .messages({
      'date.format': 'Purchase date must be in ISO format (YYYY-MM-DD)'
    }),
  calo: Joi.string()
    .max(255)
    .allow(null, '')
    .optional(),
  hargaPerKg: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.positive': 'Price per kg must be positive',
      'any.required': 'Price per kg is required'
    }),
  totalHarga: Joi.number()
    .positive()
    .precision(2)
    .allow(null)
    .messages({
      'number.positive': 'Total price must be positive'
    }),
  totalDibayar: Joi.number()
    .min(0)
    .precision(2)
    .allow(null)
    .messages({
      'number.min': 'Total dibayar tidak boleh negatif'
    }),
  lokasiBelanja: Joi.string()
    .max(255)
    .allow(null, '')
    .optional(),
  koordinat: Joi.string()
    .max(100)
    .allow(null)
    .pattern(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/)
    .messages({
      'string.pattern.base': 'Coordinates must be in format: lat,lng'
    }),
  beratGabahKg: Joi.number()
    .positive()
    .precision(2)
    .required()
    .messages({
      'number.positive': 'Weight must be positive',
      'any.required': 'Weight is required'
    }),
  jenisGabah: Joi.string()
    .max(100)
    .allow(null, '')
    .optional()
    .messages({
      'any.required': 'Rice type is required'
    }),
  kadarAir: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .allow(null)
    .messages({
      'number.min': 'Water content must be between 0 and 100',
      'number.max': 'Water content must be between 0 and 100'
    }),
  kadarHampa: Joi.number()
    .min(0)
    .max(100)
    .precision(2)
    .allow(null)
    .messages({
      'number.min': 'Empty grain percentage must be between 0 and 100',
      'number.max': 'Empty grain percentage must be between 0 and 100'
    }),
  kualitasGabah: Joi.string()
    .valid(...Object.values(KUALITAS_GABAH))
    .required()
    .messages({
      'any.required': 'Quality grade is required'
    }),
  kondisiGabah: Joi.string()
    .valid(...Object.values(KONDISI_GABAH))
    .default('kering'),
  adminNotes: Joi.string()
    .max(1000)
    .allow(null, '')
});

const updatePurchaseSchema = Joi.object({
  nama: Joi.string().max(255).allow(null, '').optional(),
  tanggalBelanja: Joi.date().iso().allow(null),
  calo: Joi.string().max(255).allow(null, '').optional(),
  hargaPerKg: Joi.number().positive().precision(2),
  totalHarga: Joi.number().positive().precision(2).allow(null),
  totalDibayar: Joi.number().min(0).precision(2).allow(null),
  lokasiBelanja: Joi.string().max(255).allow(null, '').optional(),
  koordinat: Joi.string().max(100).allow(null).pattern(/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/),
  beratGabahKg: Joi.number().positive().precision(2),
  jenisGabah: Joi.string().max(100).allow(null, ''),
  kadarAir: Joi.number().min(0).max(100).precision(2).allow(null),
  kadarHampa: Joi.number().min(0).max(100).precision(2).allow(null),
  kualitasGabah: Joi.string().valid(...Object.values(KUALITAS_GABAH)),
  kondisiGabah: Joi.string().valid(...Object.values(KONDISI_GABAH)),
  adminNotes: Joi.string().max(1000).allow(null, '')
}).min(1);

const purchaseIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid purchase ID format',
      'any.required': 'Purchase ID is required'
    })
});

module.exports = {
  createPurchaseSchema,
  updatePurchaseSchema,
  purchaseIdSchema
};
