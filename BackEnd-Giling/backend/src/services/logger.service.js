const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

class LoggerService {
  async log(data) {
    const {
      userId,
      action,
      entityType,
      entityId,
      oldData,
      newData,
      ipAddress,
      userAgent
    } = data;

    try {
      await query(
        `INSERT INTO log.activity 
         (user_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          userId || null,
          action,
          entityType,
          entityId,
          oldData ? JSON.stringify(oldData) : null,
          newData ? JSON.stringify(newData) : null,
          ipAddress || null,
          userAgent || null
        ]
      );

      // Temporary measure for testing logs
      const logLine = `[${new Date().toISOString()}] USER:${userId || 'system'} ACTION:${action} ENTITY:${entityType} ID:${entityId}\n`;
      fs.appendFile(path.join(__dirname, '../../log.txt'), logLine, (fileErr) => {
        if (fileErr) console.error('Failed to write to log.txt:', fileErr);
      });

    } catch (error) {
      console.error('Failed to write to log_history:', error);
      // Don't throw - logging should not break the main flow
    }
  }

  async getLogsByEntity(entityType, entityId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT * FROM log.activity 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3 OFFSET $4`,
      [entityType, entityId, limit, offset]
    );
    return result.rows;
  }

  async getLogsByUser(userId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT * FROM log.activity 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }
}

module.exports = new LoggerService();

