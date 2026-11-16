const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { verifyToken, requireRole } = require('../middleware/auth');

router.get('/lock-date', verifyToken, settingsController.getFinancialLockDate);
// Only Admin should be able to update the lock date
router.put('/lock-date', verifyToken, requireRole('admin', 'owner', 'TIER_B'), settingsController.updateFinancialLockDate);

module.exports = router;
