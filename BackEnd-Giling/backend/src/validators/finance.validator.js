const Joi = require('joi');

const createOverheadSchema = Joi.object({
  expenseDate: Joi.date().iso().required(),
  category: Joi.string().max(100).required(),
  description: Joi.string().max(255).allow(null, ''),
  amount: Joi.number().positive().precision(2).required(),
  frequency: Joi.string().valid('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME').allow(null, ''),
  paymentMethod: Joi.string().max(50).allow(null, ''),
  financeAccountId: Joi.string().uuid().required()
});

const recordPurchasePaymentSchema = Joi.object({
  purchaseId: Joi.string().uuid().required(),
  paymentDate: Joi.date().iso().required(),
  amount: Joi.number().positive().precision(2).required(),
  paymentMethod: Joi.string().max(50).allow(null, ''),
  referenceNo: Joi.string().max(100).allow(null, ''),
  notes: Joi.string().allow(null, ''),
  financeAccountId: Joi.string().uuid().allow(null, '')
});

const recordCaloPayoutSchema = Joi.object({
  caloName: Joi.string().max(255).required(),
  purchaseId: Joi.string().uuid().allow(null, ''),
  amount: Joi.number().positive().precision(2).required(),
  payoutDate: Joi.date().iso().required(),
  notes: Joi.string().allow(null, ''),
  financeAccountId: Joi.string().uuid().allow(null, '')
});

// Bukti kas: bayar / terima beberapa transaksi tertunda sekaligus
const payBatchSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    journalId: Joi.string().uuid().required(),
    accountId: Joi.string().uuid().required()
  })).min(1).max(100).unique('journalId').required(),
  voucherDate: Joi.date().iso().optional().allow(null, ''),
  notes: Joi.string().max(500).optional().allow(null, '')
});

module.exports = {
  payBatchSchema,
  createOverheadSchema,
  recordPurchasePaymentSchema,
  recordCaloPayoutSchema
};
