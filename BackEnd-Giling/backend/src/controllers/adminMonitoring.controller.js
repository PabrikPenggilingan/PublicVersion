const adminMonitoringService = require('../services/adminMonitoring.service');
const cache = require('../services/adminMonitoring.cache');
const { asyncHandler } = require('../utils/helpers');
const { NotFoundError } = require('../utils/errors');

/**
 * GET /api/admin/overview
 * Returns a high-level summary of all monitoring domains.
 */
const getOverview = asyncHandler(async (req, res) => {
  const data = await adminMonitoringService.getOverview();
  res.json({ success: true, data });
});

/**
 * GET /api/admin/users
 * Returns stats for all users (transaction counts, upload counts, storage usage, last active).
 */
const getUsers = asyncHandler(async (req, res) => {
  const data = await adminMonitoringService.getUserStats();
  res.json({ success: true, data });
});

/**
 * GET /api/admin/users/:id
 * Returns detailed stats + weekly activity trend for a single user.
 */
const getUserDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await adminMonitoringService.getUserDetail(id);
  if (!data) throw new NotFoundError('User not found');
  res.json({ success: true, data });
});

/**
 * GET /api/admin/database
 * Returns PostgreSQL database stats: table sizes, row counts, connections, growth trend.
 */
const getDatabaseStats = asyncHandler(async (req, res) => {
  const data = await adminMonitoringService.getDatabaseStats();
  res.json({ success: true, data });
});

/**
 * GET /api/admin/storage
 * Returns Supabase storage bucket stats (or DB-side estimates if service_role not configured).
 */
const getStorageStats = asyncHandler(async (req, res) => {
  const data = await adminMonitoringService.getStorageStats();
  res.json({ success: true, data });
});

/**
 * GET /api/admin/computing
 * Returns GCP Cloud Run metrics for the last N minutes (default: 60 minutes).
 * Query param: ?window=30 (minutes)
 */
const getComputingMetrics = asyncHandler(async (req, res) => {
  const windowMinutes = Math.min(parseInt(req.query.window) || 60, 1440); // max 24h
  const requestedService = req.query.service ? String(req.query.service).trim() : null;
  const data = await adminMonitoringService.getComputingMetrics(windowMinutes, requestedService);
  res.json({ success: true, data });
});

/**
 * POST /api/admin/cache/invalidate
 * Manually clears the in-memory monitoring cache (useful after config changes).
 */
const invalidateCache = asyncHandler(async (req, res) => {
  const { key } = req.body; // optional: specific key to invalidate
  cache.invalidate(key || undefined);
  res.json({ success: true, message: key ? `Cache key '${key}' invalidated.` : 'Full cache cleared.' });
});

module.exports = {
  getOverview,
  getUsers,
  getUserDetail,
  getDatabaseStats,
  getStorageStats,
  getComputingMetrics,
  invalidateCache,
};
