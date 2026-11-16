const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const ctrl = require('../controllers/salesV2.controller');
const {
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
} = require('../validators/salesV2.validator');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');
const { notaUpload } = require('../middleware/notaUpload');


const adminOnly = [verifyToken, requireRole('admin', 'owner', 'operator')];
const authenticated = [verifyToken];

// ─────────────────────────────────
// Customer Tiers
// ─────────────────────────────────
router.get   ('/tiers',        authenticated, ctrl.getTiers);
router.post  ('/tiers',        adminOnly,     validateRequest(createTierSchema), ctrl.createTier);

// ─────────────────────────────────
// Price List
// ─────────────────────────────────
router.get   ('/price-list',          authenticated, ctrl.getPriceLists);
router.get   ('/price-list/active',   authenticated, ctrl.getActivePrice);
router.post  ('/price-list',          adminOnly,     validateRequest(createPriceSchema), ctrl.createPrice);
router.delete('/price-list/:id', logActivity(LOG_ACTIONS.DELETE, 'salesV2'), adminOnly,     validateRequest(uuidParamSchema, 'params'), ctrl.deletePrice);

// ─────────────────────────────────
// Customers
// ─────────────────────────────────
router.get   ('/customers',     authenticated, ctrl.getCustomers);
router.get   ('/customers/:id', authenticated, validateRequest(uuidParamSchema, 'params'), ctrl.getCustomerById);
router.post  ('/customers',     authenticated, validateRequest(createCustomerSchema), ctrl.createCustomer);
router.put   ('/customers/:id', authenticated, validateRequest(uuidParamSchema, 'params'), validateRequest(updateCustomerSchema), ctrl.updateCustomer);
router.delete('/customers/:id', logActivity(LOG_ACTIONS.DELETE, 'salesV2'), adminOnly,     validateRequest(uuidParamSchema, 'params'), ctrl.deleteCustomer);

// ─────────────────────────────────
// Sales (Nota Penjualan)
// ─────────────────────────────────
router.get   ('/sales',                     authenticated, ctrl.getSales);
router.get   ('/sales/stats',               authenticated, ctrl.getSaleStats);
router.get   ('/sales/:id',                 authenticated, validateRequest(uuidParamSchema, 'params'), ctrl.getSaleById);
router.post  ('/sales',                     authenticated, validateRequest(createSaleSchema), ctrl.createSale);
router.put   ('/sales/:id/customer',        authenticated, validateRequest(uuidParamSchema, 'params'), validateRequest(updateSaleCustomerSchema), ctrl.updateSaleCustomer);
router.post  ('/sales/:id/confirm',         authenticated, validateRequest(uuidParamSchema, 'params'), ctrl.confirmSale);
router.put   ('/sales/:id/deduction',       authenticated, validateRequest(uuidParamSchema, 'params'), validateRequest(saleDeductionSchema), ctrl.setSaleDeduction);
router.post  ('/sales/:id/void',            authenticated, validateRequest(uuidParamSchema, 'params'), validateRequest(voidSaleSchema), ctrl.voidSale);
router.post  ('/sales/:id/close',           authenticated, validateRequest(uuidParamSchema, 'params'), ctrl.closeSale);

// Sale Items (add/remove while DRAFT)
router.post  ('/sales/:id/items',           authenticated, validateRequest(uuidParamSchema, 'params'), validateRequest(addSaleItemSchema), ctrl.addSaleItem);
router.delete('/sales/:id/items/:itemId', logActivity(LOG_ACTIONS.DELETE, 'salesV2'), authenticated, validateRequest(uuidTwoParamSchema, 'params'), ctrl.removeSaleItem);

// Deliveries
router.post  ('/sales/:id/deliveries',              authenticated, validateRequest(uuidParamSchema, 'params'), validateRequest(createDeliverySchema), ctrl.createDelivery);
router.delete('/sales/:id/deliveries/:deliveryId', logActivity(LOG_ACTIONS.DELETE, 'salesV2'), adminOnly,     validateRequest(uuidTwoParamSchema, 'params'), ctrl.deleteDelivery);

// Payments - supports optional file upload (bukti nota)
router.post  ('/sales/:id/payments',                authenticated, validateRequest(uuidParamSchema, 'params'), notaUpload.single('buktiNota'), ctrl.createPayment);
router.delete('/sales/:id/payments/:paymentId', logActivity(LOG_ACTIONS.DELETE, 'salesV2'), adminOnly,     validateRequest(uuidTwoParamSchema, 'params'), ctrl.deletePayment);

// Returns
router.post  ('/sales/:id/returns',                 authenticated, validateRequest(uuidParamSchema, 'params'), validateRequest(createReturnSchema), ctrl.createReturn);
router.delete('/sales/:id/returns/:returnId', logActivity(LOG_ACTIONS.DELETE, 'salesV2'), adminOnly,     validateRequest(uuidTwoParamSchema, 'params'), ctrl.deleteReturn);

module.exports = router;
