const loggerService = require('../services/logger.service');
const { query } = require('../config/database');
const { LogQueryCommand } = require('../dtos/logs.dto');
const LogsMapper = require('../mappers/logs.mapper');

// Get all logs with pagination
const getAllLogs = async (req, res, next) => {
    try {
        const command = new LogQueryCommand(req.query);
        const offset = (command.page - 1) * command.limit;

        // Build dynamic WHERE clause
        let whereClause = '';
        const params = [];
        let paramIndex = 1;

        if (command.action) {
            whereClause += ` AND action = $${paramIndex}`;
            params.push(command.action);
            paramIndex++;
        }

        if (command.entityType) {
            whereClause += ` AND entity_type = $${paramIndex}`;
            params.push(command.entityType);
            paramIndex++;
        }

        if (command.userId) {
            whereClause += ` AND user_id = $${paramIndex}`;
            params.push(command.userId);
            paramIndex++;
        }

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM log.activity WHERE 1=1 ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count, 10);

        // Get logs (without JOIN since users is in different database)
        const result = await query(
            `SELECT * FROM log.activity
       WHERE 1=1 ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, command.limit, offset]
        );

        // Get user info from main database
        const logs = result.rows;
        const userIds = [...new Set(logs.filter(l => l.user_id).map(l => l.user_id))];

        let usersMap = {};
        if (userIds.length > 0) {
            try {
                const usersResult = await query(
                    `SELECT id, username FROM sys.users WHERE id = ANY($1)`,
                    [userIds]
                );
                usersMap = usersResult.rows.reduce((acc, u) => {
                    acc[u.id] = u.username;
                    return acc;
                }, {});
            } catch (e) {
                console.error('Failed to get usernames:', e);
            }
        }

        // Merge username into logs
        const logsWithUsernames = logs.map(log => ({
            ...log,
            username: log.user_id ? usersMap[log.user_id] || 'Unknown' : 'System'
        }));

        res.json({
            success: true,
            data: logsWithUsernames.map(LogsMapper.toResponse),
            pagination: {
                page: parseInt(command.page, 10),
                limit: parseInt(command.limit, 10),
                total,
                totalPages: Math.ceil(total / command.limit),
                hasNext: command.page * command.limit < total,
                hasPrev: command.page > 1
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get logs by entity
const getLogsByEntity = async (req, res, next) => {
    try {
        const { entityType, entityId } = req.params;
        const command = new LogQueryCommand(req.query);

        const logs = await loggerService.getLogsByEntity(
            entityType,
            entityId,
            parseInt(command.limit, 10),
            parseInt(command.offset, 10)
        );

        res.json({
            success: true,
            data: logs.map(LogsMapper.toResponse)
        });
    } catch (error) {
        next(error);
    }
};

// Get logs by current user
const getMyLogs = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const command = new LogQueryCommand(req.query);

        const logs = await loggerService.getLogsByUser(
            userId,
            parseInt(command.limit, 10),
            parseInt(command.offset, 10)
        );

        res.json({
            success: true,
            data: logs.map(LogsMapper.toResponse)
        });
    } catch (error) {
        next(error);
    }
};

// Get activity summary
const getActivitySummary = async (req, res, next) => {
    try {
        const command = new LogQueryCommand(req.query);

        const result = await query(
            `SELECT 
         action,
         entity_type,
         COUNT(*) as count,
         DATE_TRUNC('day', created_at) as date
       FROM log.activity
       WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(command.days, 10)} days'
       GROUP BY action, entity_type, DATE_TRUNC('day', created_at)
       ORDER BY date DESC, count DESC`,
            []
        );

        // Get totals by action
        const actionTotals = await query(
            `SELECT action, COUNT(*) as count
       FROM log.activity
       WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(command.days, 10)} days'
       GROUP BY action`,
            []
        );

        // Get totals by entity type
        const entityTotals = await query(
            `SELECT entity_type, COUNT(*) as count
       FROM log.activity
       WHERE created_at >= CURRENT_DATE - INTERVAL '${parseInt(command.days, 10)} days'
       GROUP BY entity_type`,
            []
        );

        res.json({
            success: true,
            data: {
                daily: result.rows.map(LogsMapper.toResponse),
                byAction: actionTotals.rows.map(LogsMapper.toResponse),
                byEntityType: entityTotals.rows.map(LogsMapper.toResponse)
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllLogs,
    getLogsByEntity,
    getMyLogs,
    getActivitySummary
};
