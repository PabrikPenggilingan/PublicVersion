const Joi = require('joi');

// Common Parameters
const uuidParamSchema = Joi.object({
  id: Joi.string().uuid().required()
});

const uuidTwoParamSchema = Joi.object({
  id: Joi.string().uuid().required(),
  itemId: Joi.string().uuid(),
  deliveryId: Joi.string().uuid(),
  paymentId: Joi.string().uuid()
}).unknown(true);

// Customers
const createCustomerSchema = Joi.object({
  name: Joi.string().max(255).required(),
  phone: Joi.string().max(50).allow(null, ''),
  address: Joi.string().allow(null, ''),
  tierId: Joi.string().uuid().allow(null, ''),
  notes: Joi.string().allow(null, '')
});

const updateCustomerSchema = Joi.object({
  name: Joi.string().max(255).allow(null, ''),
  phone: Joi.string().max(50).allow(null, ''),
  address: Joi.string().allow(null, ''),
  tierId: Joi.string().uuid().allow(null, ''),
  notes: Joi.string().allow(null, ''),
  isActive: Joi.boolean()
});

// Tiers & Prices
const createTierSchema = Joi.object({
  name: Joi.string().max(100).required(),
  sortOrder: Joi.number().integer().min(0).allow(null)
});

const createPriceSchema = Joi.object({
  tierId: Joi.string().uuid().required(),
  categoryId: Joi.string().max(100).required(),
  pricePerKg: Joi.number().positive().precision(2).allow(null, 0),
  pricePerSack: Joi.number().positive().precision(2).allow(null, 0)
}).or('pricePerKg', 'pricePerSack');

// Sales
const createSaleSchema = Joi.object({
  customerId: Joi.string().uuid().allow(null, '').optional(),
  saleDate: Joi.date().iso().required(),
  dueDate: Joi.date().iso().allow(null, ''),
  notes: Joi.string().allow(null, ''),
  items: Joi.array().items(
    Joi.object({
      inventoryItemId: Joi.string().uuid().required(),
      qtyOrdered: Joi.number().positive().precision(2).required(),
      unitPrice: Joi.number().min(0).precision(2).required()
    })
  ).allow(null)
});

const updateSaleCustomerSchema = Joi.object({
  customerId: Joi.string().uuid().required()
});

const addSaleItemSchema = Joi.object({
  inventoryItemId: Joi.string().uuid().required(),
  qtyOrdered: Joi.number().positive().precision(2).required(),
  unitPrice: Joi.number().min(0).precision(2).required()
});

const saleDeductionSchema = Joi.object({
  amount: Joi.number().min(0).precision(2).required(),
  note: Joi.string().max(255).allow(null, '')
});

const voidSaleSchema = Joi.object({
  voidReason: Joi.string().required()
});

// Deliveries
const createDeliverySchema = Joi.object({
  deliveryDate: Joi.date().iso().required(),
  notes: Joi.string().allow(null, ''),
  items: Joi.array().items(
    Joi.object({
      saleItemId: Joi.string().uuid().required(),
      qtyDelivered: Joi.number().positive().precision(2).required()
    })
  ).min(1).required()
});

// Payments
const createPaymentSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required(),
  paymentDate: Joi.date().iso().required(),
  paymentMethod: Joi.string().max(50).allow(null, ''),
  referenceNo: Joi.string().max(100).allow(null, ''),
  notes: Joi.string().allow(null, '')
});

// Returns
const createReturnSchema = Joi.object({
  reason: Joi.string().required(),
  returnType: Joi.string().valid('FULL_REFUND', 'PARTIAL_REFUND', 'PRICE_REDUCTION').allow(null, ''),
  items: Joi.array().items(
    Joi.object({
      saleItemId: Joi.string().uuid().required(),
      qtyReturned: Joi.number().positive().precision(2).required()
    })
  ).allow(null),
  biayaTambahan: Joi.number().min(0).precision(2).allow(null, 0)
});

module.exports = {
  uuidParamSchema,
  uuidTwoParamSchema,
  createCustomerSchema,
  updateCustomerSchema,
  createTierSchema,
  createPriceSchema,
  createSaleSchema,
  updateSaleCustomerSchema,
  addSaleItemSchema,
  voidSaleSchema,
  saleDeductionSchema,
  createDeliverySchema,
  createPaymentSchema,
  createReturnSchema
};
