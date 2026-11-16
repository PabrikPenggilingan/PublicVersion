const express = require('express');
const router = express.Router();
const dryingFormsController = require('../controllers/drying-forms.controller');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateRequest } = require('../middleware/validateRequest');
const { submitStartSchema, submitEndSchema } = require('../validators/drying-forms.validator');
const { logActivity } = require('../middleware/logActivity');
const { optionalAuth } = require('../middleware/auth');
const { LOG_ACTIONS } = require('../utils/constants');


// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/drying');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `drying-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Public routes (no auth required for shareable forms)
router.get('/:linkCode', dryingFormsController.getFormInfo);
router.post('/:linkCode/start', optionalAuth, logActivity(LOG_ACTIONS.CREATE, 'drying-forms'), upload.array('photos', 3), validateRequest(submitStartSchema), dryingFormsController.submitStart);
router.post('/:linkCode/end', optionalAuth, logActivity(LOG_ACTIONS.CREATE, 'drying-forms'), upload.array('photos', 3), validateRequest(submitEndSchema), dryingFormsController.submitEnd);
router.get('/:linkCode/summary', dryingFormsController.getSummary);

module.exports = router;
