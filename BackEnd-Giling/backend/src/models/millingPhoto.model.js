const db = require('../config/database');

class MillingPhotoModel {
    async create(data) {
        const { sessionId, filePath, fileName, fileSize } = data;
        const result = await db.query(
            `INSERT INTO trx.milling_photos (session_id, file_path, file_name, file_size)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [sessionId, filePath, fileName, fileSize]
        );
        return result.rows[0];
    }

    async getBySessionId(sessionId) {
        const result = await db.query(
            'SELECT * FROM trx.milling_photos WHERE session_id = $1',
            [sessionId]
        );
        return result.rows;
    }
}

module.exports = new MillingPhotoModel();
