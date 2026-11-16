const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const formsController = require('../controllers/forms.controller');
const { verifyToken } = require('../middleware/auth');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads';
        // Determine folder based on field name
        if (file.fieldname === 'photos') {
            uploadPath = 'uploads/purchases';
        } else if (file.fieldname === 'struk' || file.fieldname === 'lapangan') {
            uploadPath = 'uploads/completions';
        }
        
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    // Only allow images
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

// Get form info - requires auth to prevent link enumeration
router.get('/batch/:linkCode', verifyToken, formsController.getFormInfo);

// Submit purchase with 1-3 photos - requires auth
router.post(
    '/batch/:linkCode',
    verifyToken,
    upload.array('photos', 3), // Accept up to 3 photos
    formsController.submitPurchase
);

// Get summary/all entries for a batch - requires auth
router.get('/batch/:linkCode/summary', verifyToken, formsController.getBatchSummary);

// Submit batch completion (struk + lapangan photos) - requires auth
router.post(
    '/batch/:linkCode/complete',
    verifyToken,
    upload.fields([
        { name: 'struk', maxCount: 1 },
        { name: 'lapangan', maxCount: 1 }
    ]),
    formsController.completeBatch
);

// Get my submissions - requires auth
router.get('/my-submissions', verifyToken, formsController.getMySubmissions);

// Update purchase - requires auth
router.put('/batch/:linkCode/purchases/:purchaseId', logActivity(LOG_ACTIONS.UPDATE, 'forms'), verifyToken, formsController.updatePurchase);

// Delete purchase - requires auth
router.delete('/batch/:linkCode/purchases/:purchaseId', logActivity(LOG_ACTIONS.DELETE, 'forms'), verifyToken, formsController.deletePurchase);

module.exports = router;
