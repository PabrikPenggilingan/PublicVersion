const express = require('express');
const router  = express.Router();

const controller             = require('../controllers/adminMonitoring.controller');
const { verifyToken }        = require('../middleware/auth');
const { requireSuperAdmin }  = require('../middleware/superAdmin');
const { superAdminLimiter }  = require('../middleware/rateLimiter');

// ─── All routes require: valid JWT + is_super_admin = true + rate limit ───────
router.use(verifyToken);
router.use(requireSuperAdmin);
router.use(superAdminLimiter);

// Overview — all domains at once
router.get('/overview', controller.getOverview);

// Per-user stats
router.get('/users',     controller.getUsers);
router.get('/users/:id', controller.getUserDetail);

// PostgreSQL database stats
router.get('/database', controller.getDatabaseStats);

// Supabase Storage stats
router.get('/storage', controller.getStorageStats);

// GCP Cloud Run computing metrics (?window=60 minutes)
router.get('/computing', controller.getComputingMetrics);

// Manual cache invalidation (body: { key: 'admin:storage' } or empty for full clear)
router.post('/cache/invalidate', controller.invalidateCache);

module.exports = router;
