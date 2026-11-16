const db = require('../config/database');

const salesSimplifiedModel = {
    getTableName(type) {
        const tables = {
            dedak: 'sales_dedak',
            sekam: 'sales_sekam',
            menir: 'sales_menir',
            broken: 'sales_broken'
        };
        return tables[type];
    },

    async create(type, data) {
        const tableName = this.getTableName(type);
        if (!tableName) throw new Error(`Invalid sale type: ${type}`);

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const result = await db.query(
            `INSERT INTO ${tableName} (${columns.join(', ')}) 
       VALUES (${placeholders}) 
       RETURNING *`,
            values
        );
        return result.rows[0];
    },

    async findById(type, id) {
        const tableName = this.getTableName(type);
        if (!tableName) throw new Error(`Invalid sale type: ${type}`);

        const result = await db.query(
            `SELECT * FROM ${tableName} WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    },

    async getByProcessId(type, processId) {
        const tableName = this.getTableName(type);
        if (!tableName) throw new Error(`Invalid sale type: ${type}`);

        const result = await db.query(
            `SELECT * FROM ${tableName} WHERE process_id = $1 ORDER BY created_at DESC`,
            [processId]
        );
        return result.rows;
    },

    async getAllByProcessId(processId) {
        const types = ['dedak', 'sekam', 'menir', 'broken'];
        const results = {};

        for (const type of types) {
            results[type] = await this.getByProcessId(type, processId);
        }

        return results;
    },

    async update(type, id, data) {
        const tableName = this.getTableName(type);
        if (!tableName) throw new Error(`Invalid sale type: ${type}`);

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
            return this.findById(type, id);
        }

        params.push(id);
        const result = await db.query(
            `UPDATE ${tableName} SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(type, id) {
        const tableName = this.getTableName(type);
        if (!tableName) throw new Error(`Invalid sale type: ${type}`);

        const result = await db.query(
            `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    }
};

module.exports = salesSimplifiedModel;
