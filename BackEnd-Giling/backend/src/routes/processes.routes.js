const express = require('express');
const router = express.Router();
const processesController = require('../controllers/processes.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { logActivity } = require('../middleware/logActivity');
const {
    createProcessSchema,
    updateProcessSchema,
    attachBatchSchema
} = require('../validators/process.validator');
const { USER_ROLES, LOG_ACTIONS } = require('../utils/constants');

// UUID validation schema
const Joi = require('joi');
const processIdSchema = Joi.object({ id: Joi.string().uuid().required() });
const batchIdParamSchema = Joi.object({
    id: Joi.string().uuid().required(),
    batchId: Joi.string().uuid().required()
});
const costIdParamSchema = Joi.object({
    id: Joi.string().uuid().required(),
    costId: Joi.string().uuid().required()
});

// All routes require authentication
router.use(verifyToken);

// GET /api/processes - List all processes
router.get('/', processesController.getAllProcesses);

// GET /api/processes/:id - Get process by ID
router.get('/:id', validateRequest(processIdSchema, 'params'), processesController.getProcessById);

// GET /api/processes/:id/batches - Get attached batches
router.get('/:id/batches', validateRequest(processIdSchema, 'params'), processesController.getProcessBatches);

// POST /api/processes - Create new process (admin, operator)
router.post(
    '/',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(createProcessSchema),
    logActivity(LOG_ACTIONS.CREATE, 'process'),
    processesController.createProcess
);

// PUT /api/processes/:id - Update process (admin, operator)
router.put(
    '/:id',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    validateRequest(updateProcessSchema),
    logActivity(LOG_ACTIONS.UPDATE, 'process'),
    processesController.updateProcess
);

// DELETE /api/processes/:id - Delete process (admin only)
router.delete(
    '/:id',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    logActivity(LOG_ACTIONS.DELETE, 'process'),
    processesController.deleteProcess
);

// POST /api/processes/:id/batches - Attach batch to process (admin, operator)
router.post(
    '/:id/batches',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    validateRequest(attachBatchSchema),
    logActivity(LOG_ACTIONS.CREATE, 'process_batch'),
    processesController.attachBatch
);

// DELETE /api/processes/:id/batches/:batchId - Detach batch from process (admin, operator)
router.delete(
    '/:id/batches/:batchId',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(batchIdParamSchema, 'params'),
    logActivity(LOG_ACTIONS.DELETE, 'process_batch'),
    processesController.detachBatch
);

// POST /api/processes/:id/complete
router.post(
    '/:id/complete',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    logActivity(LOG_ACTIONS.UPDATE, 'process_complete'),
    processesController.completeProcess
);

// POST /api/processes/:id/cancel
router.post(
    '/:id/cancel',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    logActivity(LOG_ACTIONS.UPDATE, 'process_cancel'),
    processesController.cancelProcess
);

// GET /api/processes/:id/costs
router.get(
    '/:id/costs',
    validateRequest(processIdSchema, 'params'),
    processesController.getProcessCosts
);

// POST /api/processes/:id/costs
router.post(
    '/:id/costs',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(processIdSchema, 'params'),
    processesController.addProcessCost
);

// DELETE /api/processes/:id/costs/:costId
router.delete(
    '/:id/costs/:costId',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(costIdParamSchema, 'params'),
    processesController.deleteProcessCost
);

// --- Milling Session Management ---
router.post('/:id/milling-link', requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR), processesController.generateMillingLink);
router.get('/:id/milling-summary', processesController.getMillingSummary);
router.post('/:id/finalize', requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR), processesController.finalizeProduction);

module.exports = router;
