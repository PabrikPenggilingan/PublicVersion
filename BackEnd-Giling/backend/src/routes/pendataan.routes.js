const express = require('express');
const router = express.Router();
const pendataanController = require('../controllers/pendataan.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
    createPendataanSchema,
    updatePendataanSchema,
    getAllPendataanSchema
} = require('../validators/pendataan.validator');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');


// All routes require authentication and admin role
router.use(verifyToken);
router.use(requireRole('admin', 'owner', 'operator'));

// Get all pendataan
router.get('/', validateRequest(getAllPendataanSchema, 'query'), pendataanController.getAll);

// Get pendataan by purchase ID (must be before :id to avoid conflict)
router.get('/by-purchase/:purchaseId', pendataanController.getByPurchaseId);

// Get pendataan by ID
router.get('/:id', pendataanController.getById);

// Create pendataan
router.post('/', logActivity(LOG_ACTIONS.CREATE, 'pendataan'), validateRequest(createPendataanSchema), pendataanController.create);

// Update pendataan
router.put('/:id', logActivity(LOG_ACTIONS.UPDATE, 'pendataan'), validateRequest(updatePendataanSchema), pendataanController.update);

// Delete pendataan
router.delete('/:id', logActivity(LOG_ACTIONS.DELETE, 'pendataan'), pendataanController.delete);

module.exports = router;
