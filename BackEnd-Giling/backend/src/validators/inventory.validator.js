const Joi = require('joi');

const inventoryIdSchema = Joi.object({
  id: Joi.string().uuid().required()
});

const createItemSchema = Joi.object({
  sourceType: Joi.string().valid('titipan_basah', 'titipan_kering', 'batch', 'manual').required(),
  batchId: Joi.string().uuid().allow(null, ''),
  dryingId: Joi.string().uuid().allow(null, ''),
  area: Joi.string().max(255).allow(null, ''),
  tanda: Joi.string().max(255).allow(null, ''),
  kualitas: Joi.string().max(255).allow(null, ''),
  avgPricePerKg: Joi.number().min(0).precision(2).allow(null),
  weightKg: Joi.number().min(0).precision(2).allow(null),
  productCategoryCode: Joi.string().max(100).allow(null, ''),
  notes: Joi.string().allow(null, ''),
  titipanData: Joi.object({
    pemilikNama: Joi.string().max(255).allow(null, '')
  }).unknown(true).allow(null),
  sacks: Joi.array().items(
    Joi.object({
      weightKg: Joi.number().min(0).precision(2).required()
    })
  ).allow(null)
});

const updateItemSchema = Joi.object({
  area: Joi.string().max(255).allow(null, ''),
  tanda: Joi.string().max(255).allow(null, ''),
  kualitas: Joi.string().max(255).allow(null, ''),
  notes: Joi.string().allow(null, '')
});

const createFromDryingSchema = Joi.object({
  area: Joi.string().max(255).allow(null, ''),
  tanda: Joi.string().max(255).allow(null, ''),
  kualitas: Joi.string().max(255).allow(null, ''),
  notes: Joi.string().allow(null, '')
});

const createFromBatchSchema = Joi.object({
  tonnageKg: Joi.number().positive().precision(2).required(),
  area: Joi.string().max(255).allow(null, ''),
  tanda: Joi.string().max(255).allow(null, ''),
  notes: Joi.string().allow(null, '')
});

const addSacksSchema = Joi.object({
  sacks: Joi.array().items(
    Joi.object({
      weightKg: Joi.number().positive().precision(2).required()
    })
  ).min(1).required()
});

const takeSacksSchema = Joi.object({
  sackIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  takenFor: Joi.string().valid('process', 'sale').required(),
  referenceId: Joi.string().uuid().required()
});

const returnTitipanSchema = Joi.object({
  feeAmount: Joi.number().min(0).precision(2).optional().default(0),
  feeNotes: Joi.string().allow(null, '').optional()
});

const takeWeightSchema = Joi.object({
  weightKg: Joi.number().positive().precision(2).required(),
  takenFor: Joi.string().valid('process', 'sale').required(),
  referenceId: Joi.string().uuid().required()
});

const dryingIdParamSchema = Joi.object({
  dryingId: Joi.string().uuid().required()
});

const batchIdParamSchema = Joi.object({
  batchId: Joi.string().uuid().required()
});

module.exports = {
  inventoryIdSchema,
  createItemSchema,
  updateItemSchema,
  createFromDryingSchema,
  createFromBatchSchema,
  addSacksSchema,
  takeSacksSchema,
  takeWeightSchema,
  dryingIdParamSchema,
  batchIdParamSchema,
  returnTitipanSchema
};
