const express = require('express');
const router = express.Router();
const multer = require('multer');
const filesController = require('../controllers/files.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { logActivity } = require('../middleware/logActivity');
const { validateRequest } = require('../middleware/validateRequest');
const { USER_ROLES, LOG_ACTIONS } = require('../utils/constants');
const { uploadFileSchema } = require('../validators/files.validator');
const compressImageMiddleware = require('../middleware/compressImage.middleware');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow images and PDFs
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type (${file.mimetype}). Only images and PDF are allowed.`));
        }
    }
});

// All routes require authentication
router.use(verifyToken);

// POST /api/files - Upload file (admin, operator)
router.post(
    '/',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    upload.single('file'),
    compressImageMiddleware,
    validateRequest(uploadFileSchema),
    logActivity(LOG_ACTIONS.CREATE, 'file'),
    filesController.uploadFile
);

// GET /api/files/:id - Get file by ID
router.get(
    '/:id',
    filesController.getFileById
);

// DELETE /api/files/:id - Delete file (admin, operator)
router.delete(
    '/:id',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    logActivity(LOG_ACTIONS.DELETE, 'file'),
    filesController.deleteFile
);

// GET /api/files/purchase/:purchaseId - Get files by purchase
router.get(
    '/purchase/:purchaseId',
    filesController.getFilesByPurchase
);

// GET /api/files/process/:processId - Get files by process
router.get(
    '/process/:processId',
    filesController.getFilesByProcess
);

// GET /api/files/sale/:saleType/:saleId - Get files by sale
router.get(
    '/sale/:saleType/:saleId',
    filesController.getFilesBySale
);

module.exports = router;
