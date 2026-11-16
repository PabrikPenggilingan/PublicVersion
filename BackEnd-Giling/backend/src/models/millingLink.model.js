const db = require('../config/database');

class MillingLinkModel {
    async create(data) {
        const { processId, linkCode, expiresAt } = data;
        const result = await db.query(
            `INSERT INTO trx.milling_links (process_id, link_code, expires_at)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [processId, linkCode, expiresAt]
        );
        return result.rows[0];
    }

    async getByCode(linkCode) {
        const result = await db.query(
            `SELECT * FROM trx.milling_links WHERE link_code = $1 AND expires_at > NOW()`,
            [linkCode]
        );
        return result.rows[0];
    }

    async getByProcessId(processId) {
        const result = await db.query(
            `SELECT * FROM trx.milling_links WHERE process_id = $1 AND expires_at > NOW()`,
            [processId]
        );
        return result.rows[0];
    }

    async delete(id) {
        const result = await db.query('DELETE FROM trx.milling_links WHERE id = $1 RETURNING *', [id]);
        return result.rowCount > 0;
    }
}

module.exports = new MillingLinkModel();
