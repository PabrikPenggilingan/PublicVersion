/**
 * Inventory Routes - Admin only
 */

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
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
} = require('../validators/inventory.validator');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');
router.use(verifyToken);

// Statistics
router.get('/stats', requireRole('admin', 'owner', 'operator', 'viewer'), inventoryController.getStats);

// Available items for FIFO selection
router.get('/available', requireRole('admin', 'owner', 'operator'), inventoryController.getAvailableItems);

// Master data: Item categories from mst schema
router.get('/categories', requireRole('admin', 'owner', 'operator', 'viewer'), inventoryController.getCategories);
router.get('/category-stats', requireRole('admin', 'owner', 'operator', 'viewer'), inventoryController.getCategoryStats);

// Gabah Titipan Basah items for drying batch picker
router.get('/titipan-basah', requireRole('admin', 'owner', 'operator'), inventoryController.getAvailableTitipanBasah);

// CRUD operations
router.get('/', requireRole('admin', 'owner', 'operator', 'viewer'), inventoryController.getAllItems);
router.post('/', logActivity(LOG_ACTIONS.CREATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(createItemSchema), inventoryController.createItem);
router.get('/:id', requireRole('admin', 'owner', 'operator', 'viewer'), validateRequest(inventoryIdSchema, 'params'), inventoryController.getItemById);
router.put('/:id', logActivity(LOG_ACTIONS.UPDATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(inventoryIdSchema, 'params'), validateRequest(updateItemSchema), inventoryController.updateItem);
router.delete('/:id', logActivity(LOG_ACTIONS.DELETE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(inventoryIdSchema, 'params'), inventoryController.deleteItem);

// Create from drying
router.post('/from-drying/:dryingId', logActivity(LOG_ACTIONS.CREATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(dryingIdParamSchema, 'params'), validateRequest(createFromDryingSchema), inventoryController.createFromDrying);

// Create from batch
router.post('/from-batch/:batchId', logActivity(LOG_ACTIONS.CREATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(batchIdParamSchema, 'params'), validateRequest(createFromBatchSchema), inventoryController.createFromBatch);

// Sack / Weight management
router.post('/:id/sacks', logActivity(LOG_ACTIONS.CREATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(inventoryIdSchema, 'params'), validateRequest(addSacksSchema), inventoryController.addSacks);
router.post('/:id/take', logActivity(LOG_ACTIONS.CREATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(inventoryIdSchema, 'params'), validateRequest(takeSacksSchema), inventoryController.takeSacks);
router.post('/:id/take-weight', logActivity(LOG_ACTIONS.CREATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(inventoryIdSchema, 'params'), validateRequest(takeWeightSchema), inventoryController.takeWeight);
router.post('/:id/return-to-penitip', logActivity(LOG_ACTIONS.CREATE, 'inventory'), requireRole('admin', 'owner', 'operator'), validateRequest(inventoryIdSchema, 'params'), validateRequest(returnTitipanSchema), inventoryController.returnToPenitip);

module.exports = router;
