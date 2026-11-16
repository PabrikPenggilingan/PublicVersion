const jwt = require('jsonwebtoken');
const config = require('../config/env');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { query } = require('../config/database');
const requestContext = require('../config/context');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      throw new AuthenticationError('No token provided');
    }
    
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Get user from database (Check both tables if needed, but here focus on sys.users)
    const result = await query(
      `SELECT u.id, u.username, u.role, u.privilege_level, u.accessible_modules, u.is_super_admin,
              u.owner_id, COALESCE(u.owner_id, u.id) AS tenant_owner_id,
              ARRAY(SELECT m.id FROM sys.users m WHERE COALESCE(m.owner_id, m.id) = COALESCE(u.owner_id, u.id)) AS tenant_user_ids
       FROM sys.users u WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('User not found');
    }

    req.user = result.rows[0];
    requestContext.run({ user: req.user }, () => {
      next();
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthenticationError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token expired'));
    } else {
      next(error);
    }
  }
};

// Check if user has required role
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
};

// Finance Center is for the owner/admin of the pabrik; operators and viewers are blocked
const requireFinanceAccess = (req, res, next) => {
  if (!req.user) return next(new AuthenticationError('Not authenticated'));
  const role = String(req.user.role || '').toLowerCase();
  if (['operator', 'viewer'].includes(role)) {
    return next(new AuthorizationError('Finance Center hanya untuk owner/admin pabrik'));
  }
  next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    const result = await query(
      `SELECT u.id, u.username, u.role, u.privilege_level, u.accessible_modules, u.is_super_admin,
              u.owner_id, COALESCE(u.owner_id, u.id) AS tenant_owner_id,
              ARRAY(SELECT m.id FROM sys.users m WHERE COALESCE(m.owner_id, m.id) = COALESCE(u.owner_id, u.id)) AS tenant_user_ids
       FROM sys.users u WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length > 0) {
      req.user = result.rows[0];
      return requestContext.run({ user: req.user }, () => {
        next();
      });
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  
  next();
};

module.exports = {
  requireFinanceAccess,
  verifyToken,
  requireRole,
  optionalAuth
};
