const loggerService = require('../services/logger.service');

// Log activity to log_history table
const logActivity = (action, entityType) => {
  return async (req, res, next) => {
    // Store original json function
    const originalJson = res.json;

    // Override json function to capture response
    res.json = function (data) {
      // Only log successful operations
      if (res.statusCode < 400) {
        const entityId = req.params.id || data?.data?.id;
        
        if (entityId) {
          loggerService.log({
            userId: req.user?.id,
            action,
            entityType,
            entityId,
            oldData: req.oldData || null,
            newData: data?.data || null,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
          }).catch(err => {
            console.error('Failed to log activity:', err);
          });
        }
      }

      // Call original json function
      return originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  logActivity
};
