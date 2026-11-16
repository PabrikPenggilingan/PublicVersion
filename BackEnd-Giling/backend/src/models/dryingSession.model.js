const db = require('../config/database');

const dryingSessionsModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.drying_sessions (drying_id, session_type, pic, people_involved, session_date, session_time, moisture_content, tonnage_kg, waste_kg, waste_reason, hpp_per_kg, button_pressed_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING *`,
            [data.dryingId, data.sessionType, data.pic, data.peopleInvolved, data.sessionDate, data.sessionTime, data.moistureContent, data.tonnageKg, data.wasteKg || 0, data.wasteReason || null, data.hppPerKg || 0, data.buttonPressedAt]
        );
        return result.rows[0];
    },

    async getByDryingId(dryingId) {
        const result = await db.query(
            `SELECT ds.*, 
              (SELECT COUNT(*) FROM trx.drying_photos WHERE session_id = ds.id) as photo_count,
              COALESCE((SELECT json_agg(ph.file_path ORDER BY ph.created_at) FROM trx.drying_photos ph WHERE ph.session_id = ds.id), '[]'::json) as photos
       FROM trx.drying_sessions ds
       WHERE ds.drying_id = $1
       ORDER BY ds.session_type`,
            [dryingId]
        );
        return result.rows;
    },

    async getByDryingIdAndType(dryingId, sessionType) {
        const result = await db.query(
            `SELECT * FROM trx.drying_sessions WHERE drying_id = $1 AND session_type = $2`,
            [dryingId, sessionType]
        );
        return result.rows[0];
    },

    async update(id, data) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        const fieldMap = {
            wasteKg: 'waste_kg',
            wasteReason: 'waste_reason',
            hppPerKg: 'hpp_per_kg'
        };

        Object.entries(data).forEach(([key, value]) => {
            const dbField = fieldMap[key] || key;
            if (value !== undefined) {
                updates.push(`${dbField} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        if (updates.length === 0) return null;

        params.push(id);
        const result = await db.query(
            `UPDATE trx.drying_sessions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async updateByDryingIdAndType(dryingId, sessionType, data) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        const fieldMap = {
            wasteKg: 'waste_kg',
            wasteReason: 'waste_reason',
            hppPerKg: 'hpp_per_kg'
        };

        Object.entries(data).forEach(([key, value]) => {
            const dbField = fieldMap[key] || key;
            if (value !== undefined) {
                updates.push(`${dbField} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        if (updates.length === 0) return null;

        params.push(dryingId, sessionType);
        const result = await db.query(
            `UPDATE trx.drying_sessions SET ${updates.join(', ')} 
             WHERE drying_id = $${paramIndex} AND session_type = $${paramIndex + 1} 
             RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async deleteByDryingId(dryingId) {
        await db.query(
            'DELETE FROM trx.drying_photos WHERE session_id IN (SELECT id FROM trx.drying_sessions WHERE drying_id = $1)',
            [dryingId]
        );
        const result = await db.query('DELETE FROM trx.drying_sessions WHERE drying_id = $1 RETURNING *', [dryingId]);
        return result.rows;
    }
};

module.exports = dryingSessionsModel;
