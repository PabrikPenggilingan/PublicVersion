const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logs.controller');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { USER_ROLES } = require('../utils/constants');
const {
    getAllLogsSchema,
    getLogsByEntitySchema,
    getMyLogsSchema,
    getActivitySummarySchema
} = require('../validators/logs.validator');

// All routes require authentication
router.use(verifyToken);

// GET /api/logs/me - Get logs for current user
router.get(
    '/me',
    validateRequest(getMyLogsSchema, 'query'),
    logsController.getMyLogs
);

// GET /api/logs/summary - Get activity summary (admin only)
router.get(
    '/summary',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(getActivitySummarySchema, 'query'),
    logsController.getActivitySummary
);

// GET /api/logs/:entityType/:entityId - Get logs by entity
router.get(
    '/:entityType/:entityId',
    validateRequest(getLogsByEntitySchema, 'query'),
    logsController.getLogsByEntity
);

// GET /api/logs - Get all logs with filters (admin only)
router.get(
    '/',
    requireRole(USER_ROLES.ADMIN, 'owner', USER_ROLES.OPERATOR),
    validateRequest(getAllLogsSchema, 'query'),
    logsController.getAllLogs
);

module.exports = router;
