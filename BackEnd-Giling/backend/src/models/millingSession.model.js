const db = require('../config/database');

class MillingSessionModel {
    async create(data) {
        const { 
            processId, sessionType, pic, crewNames, 
            sessionDate, sessionTime, moistureContent, 
            hardnessType, brokenRatio, outputData, notes 
        } = data;
        
        const result = await db.query(
            `INSERT INTO trx.milling_sessions 
            (process_id, session_type, pic, crew_names, session_date, session_time, 
             moisture_content, hardness_type, broken_ratio, output_data, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                processId, sessionType, pic, crewNames, 
                sessionDate || new Date(), 
                sessionTime || new Date().toLocaleTimeString('en-GB', { hour12: false }), 
                moistureContent, hardnessType, brokenRatio, 
                outputData ? JSON.stringify(outputData) : null, 
                notes
            ]
        );
        return result.rows[0];
    }

    async getByProcessId(processId) {
        const result = await db.query(
            `SELECT ms.*, COALESCE((SELECT json_agg(ph.file_path ORDER BY ph.created_at) FROM trx.milling_photos ph WHERE ph.session_id = ms.id), '[]'::json) as photos
             FROM trx.milling_sessions ms WHERE ms.process_id = $1 ORDER BY ms.created_at ASC`,
            [processId]
        );
        return result.rows;
    }

    async getByProcessIdAndType(processId, type) {
        const result = await db.query(
            `SELECT * FROM trx.milling_sessions WHERE process_id = $1 AND session_type = $2 LIMIT 1`,
            [processId, type]
        );
        return result.rows[0];
    }
}

module.exports = new MillingSessionModel();
