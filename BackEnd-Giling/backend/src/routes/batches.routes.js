const express = require('express');
const router = express.Router();
const batchesController = require('../controllers/batches.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { logActivity } = require('../middleware/logActivity');
const {
  createBatchSchema,
  updateBatchSchema,
  batchIdSchema
} = require('../validators/batch.validator');
const { USER_ROLES, LOG_ACTIONS } = require('../utils/constants');
const { notaUpload } = require('../middleware/notaUpload');

// All routes require authentication
router.use(verifyToken);

// GET /api/batches - List all batches
router.get('/', batchesController.getAllBatches);

// GET /api/batches/margins/reports - Get all margin reports
router.get('/margins/reports', batchesController.getAllBatchMarginReports);

// GET /api/batches/:id - Get batch by ID
router.get('/:id', validateRequest(batchIdSchema, 'params'), batchesController.getBatchById);

// GET /api/batches/:id/completion - Get batch completion photos
router.get('/:id/completion', validateRequest(batchIdSchema, 'params'), batchesController.getBatchCompletion);

// GET /api/batches/:id/margin-report - Get managerial margin report
router.get('/:id/margin-report', validateRequest(batchIdSchema, 'params'), batchesController.getBatchMarginReport);

// GET /api/batches/:id/debt - Get batch purchase debt (total, paid, remaining, history)
router.get('/:id/debt', validateRequest(batchIdSchema, 'params'), batchesController.getBatchDebt);

// POST /api/batches/:id/payments - Record a debt installment (creates PENDING finance request)
router.post(
  '/:id/payments',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(batchIdSchema, 'params'),
  notaUpload.single('buktiNota'),
  logActivity(LOG_ACTIONS.CREATE, 'batch_payment'),
  batchesController.createBatchPayment
);

// POST /api/batches - Create new batch (admin, operator)
router.post(
  '/',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(createBatchSchema),
  logActivity(LOG_ACTIONS.CREATE, 'batch'),
  batchesController.createBatch
);

// PUT /api/batches/:id - Update batch (admin, operator)
router.put(
  '/:id',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(batchIdSchema, 'params'),
  validateRequest(updateBatchSchema),
  logActivity(LOG_ACTIONS.UPDATE, 'batch'),
  batchesController.updateBatch
);

// DELETE /api/batches/:id - Delete batch (admin only)
router.delete(
  '/:id',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(batchIdSchema, 'params'),
  logActivity(LOG_ACTIONS.DELETE, 'batch'),
  batchesController.deleteBatch
);

module.exports = router;
