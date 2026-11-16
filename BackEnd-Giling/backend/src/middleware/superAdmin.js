const { AuthorizationError } = require('../utils/errors');

/**
 * Super Admin Guard Middleware
 *
 * Restricts access to platform-level monitoring endpoints (/api/admin/*).
 * The `is_super_admin` flag is set manually via DB only — no API endpoint changes it.
 *
 * Requires verifyToken to have already run (so req.user is populated).
 *
 * Usage:
 *   router.use(verifyToken);
 *   router.use(requireSuperAdmin);
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AuthorizationError('Authentication required'));
  }

  if (!req.user.is_super_admin) {
    return next(new AuthorizationError('Super admin access required'));
  }

  next();
};

module.exports = { requireSuperAdmin };
