/**
 * Rate Limiting Service - Tracks submission counts per entity
 */

const db = require('../config/database');
const { RATE_LIMITS } = require('../validators/form.validator');

class RateLimitError extends Error {
    constructor(message, entityType, entityId) {
        super(message);
        this.name = 'RateLimitError';
        this.entityType = entityType;
        this.entityId = entityId;
        this.statusCode = 429;
        this.isOperational = true;
    }
}

class RateLimitService {
    /**
     * Check if entity has reached submission limit
     * @param {string} entityType - 'batch', 'drying', 'process'
     * @param {number|string} entityId - Entity ID
     * @returns {Promise<{allowed: boolean, current: number, max: number}>}
     */
    async checkLimit(entityType, entityId) {
        const config = require('../config/env');
        const maxSubmissions = RATE_LIMITS[entityType];
        if (!maxSubmissions) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        if (config.nodeEnv === 'development') {
            return { allowed: true, current: 0, max: maxSubmissions };
        }

        const result = await db.query(
            `SELECT submission_count FROM trx.submission_counts 
             WHERE entity_type = $1 AND entity_id = $2`,
            [entityType, entityId]
        );

        const current = result.rows[0]?.submission_count || 0;

        return {
            allowed: current < maxSubmissions,
            current,
            max: maxSubmissions,
        };
    }

    /**
     * Increment submission count for entity
     * @param {string} entityType - 'batch', 'drying', 'process'
     * @param {number|string} entityId - Entity ID
     * @returns {Promise<number>} New count
     */
    async incrementCount(entityType, entityId) {
        const config = require('../config/env');
        const maxSubmissions = RATE_LIMITS[entityType];
        if (!maxSubmissions) {
            throw new Error(`Unknown entity type: ${entityType}`);
        }

        if (config.nodeEnv === 'development') {
            return 1;
        }

        // Upsert: insert or update
        const result = await db.query(
            `INSERT INTO trx.submission_counts (entity_type, entity_id, submission_count, updated_at)
             VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
             ON CONFLICT (entity_type, entity_id) 
             DO UPDATE SET 
                submission_count = submission_counts.submission_count + 1,
                updated_at = CURRENT_TIMESTAMP
             RETURNING submission_count`,
            [entityType, entityId]
        );

        return result.rows[0].submission_count;
    }

    /**
     * Enforce rate limit - check and throw if exceeded
     * @param {string} entityType - 'batch', 'drying', 'process'
     * @param {number|string} entityId - Entity ID
     * @throws {RateLimitError} If limit exceeded
     */
    async enforceLimit(entityType, entityId) {
        const { allowed, current, max } = await this.checkLimit(entityType, entityId);

        if (!allowed) {
            const entityNames = {
                batch: 'Batch',
                drying: 'Pengeringan',
                process: 'Proses',
            };
            throw new RateLimitError(
                `${entityNames[entityType]} ini sudah mencapai batas maksimum ${max} submission`,
                entityType,
                entityId
            );
        }

        return { current, max };
    }

    /**
     * Get current count for entity
     * @param {string} entityType 
     * @param {number|string} entityId 
     * @returns {Promise<number>}
     */
    async getCount(entityType, entityId) {
        const result = await db.query(
            `SELECT submission_count FROM trx.submission_counts 
             WHERE entity_type = $1 AND entity_id = $2`,
            [entityType, entityId]
        );
        return result.rows[0]?.submission_count || 0;
    }

    /**
     * Reset count for entity (admin function)
     * @param {string} entityType 
     * @param {number|string} entityId 
     */
    async resetCount(entityType, entityId) {
        await db.query(
            `UPDATE trx.submission_counts 
             SET submission_count = 0, last_reset_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE entity_type = $1 AND entity_id = $2`,
            [entityType, entityId]
        );
    }
}

module.exports = {
    RateLimitError,
    rateLimitService: new RateLimitService(),
};
