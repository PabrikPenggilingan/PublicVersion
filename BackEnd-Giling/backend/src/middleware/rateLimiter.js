const rateLimit = require('express-rate-limit');
const config = require('../config/env');

/**
 * Global rate limiter for general API routes.
 * Limits each IP to 100 requests per 15-minute window.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req, res) => true, // Bypass in local dev
  message: {
    success: false,
    message: 'Terlalu banyak permintaan dari IP ini, silakan coba lagi setelah 15 menit.',
  },
});

/**
 * Strict rate limiter for sensitive authentication endpoints (login, register).
 * Limits each IP to 10 requests per 15-minute window to prevent brute-force attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => true, // Bypass in local dev
  message: {
    success: false,
    message: 'Terlalu banyak percobaan autentikasi dari IP ini. Silakan coba lagi setelah 15 menit.',
  },
});

/**
 * Super Admin rate limiter for monitoring endpoints.
 * Limits each IP to 10 requests per minute. These endpoints hit GCP API and Supabase,
 * so aggressive limiting prevents accidental over-billing and abuse.
 */
const superAdminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => config.nodeEnv === 'development',
  message: {
    success: false,
    message: 'Rate limit exceeded for admin monitoring endpoints. Max 10 requests per minute.',
  },
});

module.exports = {
  globalLimiter,
  authLimiter,
  superAdminLimiter,
};
