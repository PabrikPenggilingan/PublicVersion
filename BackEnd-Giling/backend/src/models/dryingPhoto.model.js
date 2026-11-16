const db = require('../config/database');

const dryingPhotosModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.drying_photos (session_id, file_path, file_name, file_size) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
            [data.sessionId, data.filePath, data.fileName, data.fileSize]
        );
        return result.rows[0];
    },

    async getBySessionId(sessionId) {
        const result = await db.query(
            'SELECT * FROM trx.drying_photos WHERE session_id = $1 ORDER BY created_at',
            [sessionId]
        );
        return result.rows;
    }
};

module.exports = dryingPhotosModel;
