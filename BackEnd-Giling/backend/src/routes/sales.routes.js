const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { logActivity } = require('../middleware/logActivity');
const {
    createBerasSchema,
    updateBerasSchema,
    createSimplifiedSaleSchema,
    updateSimplifiedSaleSchema
} = require('../validators/sales.validator');
const { USER_ROLES, LOG_ACTIONS } = require('../utils/constants');

// UUID validation schemas
const Joi = require('joi');
const processIdSchema = Joi.object({
    processId: Joi.string().uuid().required()
});

const saleIdSchema = Joi.object({
    type: Joi.string().valid('beras', 'dedak', 'sekam', 'menir', 'broken').required(),
    id: Joi.string().uuid().required()
});

// All routes require authentication
router.use(verifyToken);

// GET /api/processes/:processId/sales - Get all sales for a process
router.get(
    '/processes/:processId/sales',
    validateRequest(processIdSchema, 'params'),
    salesController.getSalesByProcessId
);

// POST /api/processes/:processId/sales/beras - Create beras sale (admin, operator)
router.post(
    '/processes/:processId/sales/beras',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    validateRequest(createBerasSchema),
    logActivity(LOG_ACTIONS.CREATE, 'sales_beras'),
    salesController.createBerasSale
);

// POST /api/processes/:processId/sales/dedak - Create dedak sale (admin, operator)
router.post(
    '/processes/:processId/sales/dedak',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    validateRequest(createSimplifiedSaleSchema),
    logActivity(LOG_ACTIONS.CREATE, 'sales_dedak'),
    salesController.createSimplifiedSale
);

// POST /api/processes/:processId/sales/sekam - Create sekam sale (admin, operator)
router.post(
    '/processes/:processId/sales/sekam',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    validateRequest(createSimplifiedSaleSchema),
    logActivity(LOG_ACTIONS.CREATE, 'sales_sekam'),
    salesController.createSimplifiedSale
);

// POST /api/processes/:processId/sales/menir - Create menir sale (admin, operator)
router.post(
    '/processes/:processId/sales/menir',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    validateRequest(createSimplifiedSaleSchema),
    logActivity(LOG_ACTIONS.CREATE, 'sales_menir'),
    salesController.createSimplifiedSale
);

// POST /api/processes/:processId/sales/broken - Create broken sale (admin, operator)
router.post(
    '/processes/:processId/sales/broken',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    validateRequest(createSimplifiedSaleSchema),
    logActivity(LOG_ACTIONS.CREATE, 'sales_broken'),
    salesController.createSimplifiedSale
);

// PUT /api/sales/:type/:id - Update any sale (admin, operator)
router.put(
    '/sales/:type/:id',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(saleIdSchema, 'params'),
    logActivity(LOG_ACTIONS.UPDATE, 'sales'),
    salesController.updateSale
);

// DELETE /api/sales/:type/:id - Delete any sale (admin only)
router.delete(
    '/sales/:type/:id',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(saleIdSchema, 'params'),
    logActivity(LOG_ACTIONS.DELETE, 'sales'),
    salesController.deleteSale
);

module.exports = router;
