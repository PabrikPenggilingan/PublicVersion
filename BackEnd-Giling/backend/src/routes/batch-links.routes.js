const express = require('express');
const router = express.Router();
const batchLinksController = require('../controllers/batch-links.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { createLinkSchema, toggleLinkSchema } = require('../validators/batch-links.validator');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');


// All routes require authentication and admin/operator role
router.use(verifyToken);
router.use(requireRole('admin', 'owner', 'operator'));

// Create new link for a batch
router.post('/batches/:id/links', logActivity(LOG_ACTIONS.CREATE, 'batch-links'), validateRequest(createLinkSchema), batchLinksController.createLink);

// Get all links for a batch
router.get('/batches/:id/links', batchLinksController.getLinksByBatch);

// Toggle link active/inactive
router.put('/batch-links/:linkId', logActivity(LOG_ACTIONS.UPDATE, 'batch-links'), validateRequest(toggleLinkSchema), batchLinksController.toggleLink);

// Delete a link
router.delete('/batch-links/:linkId', logActivity(LOG_ACTIONS.DELETE, 'batch-links'), batchLinksController.deleteLink);

module.exports = router;
