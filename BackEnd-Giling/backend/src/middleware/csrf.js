const crypto = require('crypto');

/**
 * Generate a non-predictable cryptographically secure CSRF token
 */
const generateCsrfToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Set anti-CSRF token cookie on response
 */
const setCsrfCookie = (res, token) => {
  res.cookie('csrf_token', token, {
    httpOnly: false, // Must be readable by client JS to send in X-CSRF-Token header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });
};

/**
 * Middleware to verify non-predictable CSRF token on state-altering requests
 * (POST, PUT, PATCH, DELETE) when request uses cookie authentication.
 */
const verifyCsrfToken = (req, res, next) => {
  const stateAlteringMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  // Skip GET, HEAD, OPTIONS
  if (!stateAlteringMethods.includes(req.method)) {
    return next();
  }

  // Bypass CSRF for public shareable forms which use linkCode auth instead of cookie sessions
  const bypassRoutes = ['/api/milling-forms', '/api/drying-forms', '/api/forms'];
  if (bypassRoutes.some(route => req.originalUrl.startsWith(route))) {
    return next();
  }

  // If request uses Bearer token header, CSRF via cookie isn't applicable
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // If cookie auth is used, verify X-CSRF-Token header against csrf_token cookie
  if (req.cookies && req.cookies.token) {
    const clientCsrfToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || (req.body && req.body._csrf);
    const serverCsrfToken = req.cookies.csrf_token;

    if (!clientCsrfToken || !serverCsrfToken || clientCsrfToken !== serverCsrfToken) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or missing CSRF token'
      });
    }
  }

  next();
};

module.exports = {
  generateCsrfToken,
  setCsrfCookie,
  verifyCsrfToken
};
