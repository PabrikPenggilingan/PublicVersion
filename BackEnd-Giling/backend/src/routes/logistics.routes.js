const express = require('express');
const router = express.Router();
const logisticsController = require('../controllers/logistics.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { USER_ROLES } = require('../utils/constants');
const {
    createLogisticsSchema,
    updateLogisticsSchema,
    getLogisticsTasksSchema,
    getAvailableReferencesSchema,
    saleShipmentSchema,
    shipmentIdParamSchema,
    availableSalesQuerySchema
} = require('../validators/logistics.validator');
const shipmentController = require('../controllers/saleShipment.controller');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');


// All routes require authentication
router.use(verifyToken);

// GET /api/logistics/references - Get available purchases/sales without logistics attached
router.get('/references', validateRequest(getAvailableReferencesSchema, 'query'), logisticsController.getAvailableReferences);

// ── Pengiriman penjualan (1 mobil, bisa banyak nota) ──
const canWrite = requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR);
router.get('/shipments', shipmentController.getShipments);
router.get('/shipments/available-sales', validateRequest(availableSalesQuerySchema, 'query'), shipmentController.getAvailableSales);
router.get('/shipments/:id', validateRequest(shipmentIdParamSchema, 'params'), shipmentController.getShipmentById);
router.post('/shipments', canWrite, validateRequest(saleShipmentSchema), logActivity(LOG_ACTIONS.CREATE, 'logistics'), shipmentController.createShipment);
router.put('/shipments/:id', canWrite, validateRequest(shipmentIdParamSchema, 'params'), validateRequest(saleShipmentSchema), logActivity(LOG_ACTIONS.UPDATE, 'logistics'), shipmentController.updateShipment);
router.delete('/shipments/:id', canWrite, validateRequest(shipmentIdParamSchema, 'params'), logActivity(LOG_ACTIONS.DELETE, 'logistics'), shipmentController.deleteShipment);

// GET /api/logistics
router.get('/', validateRequest(getLogisticsTasksSchema, 'query'), logisticsController.getLogisticsTasks);

// GET /api/logistics/:id
router.get('/:id', logisticsController.getLogisticsTaskById);

// POST /api/logistics
router.post(
    '/',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(createLogisticsSchema),
    logisticsController.createLogisticsTask
);

// PUT /api/logistics/:id
router.put(
    '/:id',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(updateLogisticsSchema),
    logisticsController.updateLogisticsTask
);

module.exports = router;
