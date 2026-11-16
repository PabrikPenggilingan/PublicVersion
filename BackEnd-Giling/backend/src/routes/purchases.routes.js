const express = require('express');
const router = express.Router();
const purchasesController = require('../controllers/purchases.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { logActivity } = require('../middleware/logActivity');
const {
  createPurchaseSchema,
  updatePurchaseSchema,
  purchaseIdSchema
} = require('../validators/purchase.validator');
const { batchIdParamSchema } = require('../validators/batch.validator');
const { USER_ROLES, LOG_ACTIONS } = require('../utils/constants');
const compressImageMiddleware = require('../middleware/compressImage.middleware');

// Configure multer for local file storage (mirroring forms.routes.js)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/purchases';
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

// All routes require authentication
router.use(verifyToken);

// GET /api/purchases - List all purchases (with filters)
router.get(
  '/purchases',
  purchasesController.getAllPurchases
);

// GET /api/batches/:batchId/purchases - List purchases for a batch
router.get(
  '/batches/:batchId/purchases',
  validateRequest(batchIdParamSchema, 'params'),
  purchasesController.getPurchasesByBatchId
);

// POST /api/batches/:batchId/purchases - Create purchase (admin, operator)
router.post(
  '/batches/:batchId/purchases',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(batchIdParamSchema, 'params'),
  validateRequest(createPurchaseSchema),
  logActivity(LOG_ACTIONS.CREATE, 'purchase'),
  purchasesController.createPurchase
);

// GET /api/purchases/:id - Get purchase by ID
router.get(
  '/purchases/:id',
  validateRequest(purchaseIdSchema, 'params'),
  purchasesController.getPurchaseById
);

// POST /api/purchases/:id/photos - Upload photo for a purchase (admin, operator)
router.post(
  '/purchases/:id/photos',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(purchaseIdSchema, 'params'),
  upload.single('file'),
  compressImageMiddleware,
  logActivity(LOG_ACTIONS.CREATE, 'purchase_photo'),
  purchasesController.uploadPhoto
);

// PUT /api/purchases/:id - Update purchase (admin, operator)
router.put(
  '/purchases/:id',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(purchaseIdSchema, 'params'),
  validateRequest(updatePurchaseSchema),
  logActivity(LOG_ACTIONS.UPDATE, 'purchase'),
  purchasesController.updatePurchase
);

// DELETE /api/purchases/:id - Delete purchase (admin only)
router.delete(
  '/purchases/:id',
  requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
  validateRequest(purchaseIdSchema, 'params'),
  logActivity(LOG_ACTIONS.DELETE, 'purchase'),
  purchasesController.deletePurchase
);

module.exports = router;
