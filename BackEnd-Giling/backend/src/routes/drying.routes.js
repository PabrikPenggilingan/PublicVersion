const express = require('express');
const router = express.Router();
const dryingController = require('../controllers/drying.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
    createDryingSchema,
    updateBatchesSchema,
    toggleActiveSchema,
    createLinkSchema,
    toggleLinkSchema,
    addCostSchema
} = require('../validators/drying.validator');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');


// All routes require authentication
router.use(verifyToken);

// Admin only routes
router.post('/', logActivity(LOG_ACTIONS.CREATE, 'drying'), requireRole('admin', 'owner', 'operator'), validateRequest(createDryingSchema), dryingController.createDrying);
router.get('/', requireRole('admin', 'owner', 'operator', 'viewer'), dryingController.getAllDrying);
router.get('/:id', requireRole('admin', 'owner', 'operator', 'viewer'), dryingController.getDryingById);
router.delete('/:id', logActivity(LOG_ACTIONS.DELETE, 'drying'), requireRole('admin', 'owner', 'operator'), dryingController.deleteDrying);

// Batch management
router.put('/:id/batches', logActivity(LOG_ACTIONS.UPDATE, 'drying'), requireRole('admin', 'owner', 'operator'), validateRequest(updateBatchesSchema), dryingController.updateBatches);

// Toggle active status
router.patch('/:id/active', requireRole('admin', 'owner', 'operator'), validateRequest(toggleActiveSchema), dryingController.toggleActive);

// Approval routes
router.post('/:id/approve', logActivity(LOG_ACTIONS.CREATE, 'drying'), requireRole('admin', 'owner', 'operator'), dryingController.approveDrying);
router.post('/:id/reject', logActivity(LOG_ACTIONS.CREATE, 'drying'), requireRole('admin', 'owner', 'operator'), dryingController.rejectDrying);

// Link management
router.get('/:id/links', requireRole('admin', 'owner', 'operator'), dryingController.getLinks);
router.post('/:id/links', logActivity(LOG_ACTIONS.CREATE, 'drying'), requireRole('admin', 'owner', 'operator'), validateRequest(createLinkSchema), dryingController.createLink);
router.patch('/:id/links/:linkId', requireRole('admin', 'owner', 'operator'), validateRequest(toggleLinkSchema), dryingController.toggleLink);
router.delete('/:id/links/:linkId', logActivity(LOG_ACTIONS.DELETE, 'drying'), requireRole('admin', 'owner', 'operator'), dryingController.deleteLink);

// Cost management
router.post('/:id/costs', logActivity(LOG_ACTIONS.CREATE, 'drying'), requireRole('admin', 'owner', 'operator'), validateRequest(addCostSchema), dryingController.addCost);
router.get('/:id/costs', requireRole('admin', 'owner', 'operator', 'viewer'), dryingController.getCosts);
router.delete('/:id/costs/:costId', logActivity(LOG_ACTIONS.DELETE, 'drying'), requireRole('admin', 'owner', 'operator'), dryingController.deleteCost);

module.exports = router;

