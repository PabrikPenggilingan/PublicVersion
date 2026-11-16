const db = require('../config/database');

const dryingLinksModel = {
    async create(data) {
        const result = await db.query(
            `INSERT INTO trx.drying_links (drying_id, link_code, employee_name, expires_at) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
            [data.dryingId, data.linkCode, data.employeeName, data.expiresAt]
        );
        return result.rows[0];
    },

    async findByLinkCode(linkCode) {
        const result = await db.query(
            `SELECT dl.*, dp.status as drying_status
       FROM trx.drying_links dl
       JOIN trx.drying_processes dp ON dp.id = dl.drying_id
       WHERE dl.link_code = $1`,
            [linkCode]
        );
        return result.rows[0];
    },

    async getByCode(linkCode) {
        return this.findByLinkCode(linkCode);
    },

    async getByDryingId(dryingId) {
        const result = await db.query(
            'SELECT * FROM trx.drying_links WHERE drying_id = $1 ORDER BY created_at DESC',
            [dryingId]
        );
        return result.rows;
    },

    async update(id, data) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                updates.push(`${key} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        if (updates.length === 0) return null;

        params.push(id);
        const result = await db.query(
            `UPDATE trx.drying_links SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.drying_links WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

module.exports = dryingLinksModel;
