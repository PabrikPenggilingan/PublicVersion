const db = require('../config/database');

const salesBerasModel = {
    async create(data) {
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const result = await db.query(
            `INSERT INTO trx.sales_beras (${columns.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
            values
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            'SELECT * FROM trx.sales_beras WHERE id = $1',
            [id]
        );
        return result.rows[0];
    },

    async getByProcessId(processId) {
        const result = await db.query(
            'SELECT * FROM trx.sales_beras WHERE process_id = $1 ORDER BY created_at DESC',
            [processId]
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

        if (updates.length === 0) {
            return this.findById(id);
        }

        params.push(id);
        const result = await db.query(
            `UPDATE trx.sales_beras SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.sales_beras WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    }
};

module.exports = salesBerasModel;
