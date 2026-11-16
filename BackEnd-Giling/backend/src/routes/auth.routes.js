const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { registerSchema, loginSchema } = require('../validators/auth.validator');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');
const { authLimiter } = require('../middleware/rateLimiter');


// Public routes (Rate limited to prevent brute-force attacks)
router.post('/register', authLimiter, logActivity(LOG_ACTIONS.CREATE, 'auth'), validateRequest(registerSchema), authController.register);
router.post('/login', authLimiter, logActivity(LOG_ACTIONS.CREATE, 'auth'), validateRequest(loginSchema), authController.login);

// Protected routes
router.get('/me', verifyToken, authController.getCurrentUser);
router.post('/logout', logActivity(LOG_ACTIONS.CREATE, 'auth'), verifyToken, authController.logout);

module.exports = router;
