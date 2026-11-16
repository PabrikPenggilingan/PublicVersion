const db = require('../config/database');

const usersModel = {
    async create(data) {
        const { username, passwordHash, role, ownerId } = data;
        const result = await db.query(
            `INSERT INTO sys.users (username, password_hash, role, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, created_at, updated_at, accessible_modules, owner_id`,
            [username, passwordHash, role, ownerId || null]
        );
        return result.rows[0];
    },

    async findByUsername(username) {
        const result = await db.query(
            'SELECT id, username, password_hash, role, accessible_modules, is_super_admin FROM sys.users WHERE username = $1',
            [username]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            'SELECT id, username, role, created_at, updated_at, accessible_modules, is_super_admin FROM sys.users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    },

    // tenantOwnerId: limit to one pabrik (owner + its users); null = all users (super admin)
    async getAll(limit, offset, tenantOwnerId = null) {
        const params = [limit, offset];
        let where = '';
        if (tenantOwnerId) { params.push(tenantOwnerId); where = 'WHERE COALESCE(owner_id, id) = $3'; }
        const result = await db.query(
            `SELECT id, username, role, created_at, updated_at, accessible_modules, owner_id FROM sys.users ${where} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
            params
        );
        return result.rows;
    },

    async count(tenantOwnerId = null) {
        const result = tenantOwnerId
            ? await db.query('SELECT COUNT(*) FROM sys.users WHERE COALESCE(owner_id, id) = $1', [tenantOwnerId])
            : await db.query('SELECT COUNT(*) FROM sys.users');
        return parseInt(result.rows[0].count);
    },

    async tenantOwnerOf(id) {
        const result = await db.query('SELECT COALESCE(owner_id, id) AS owner FROM sys.users WHERE id = $1', [id]);
        return result.rows[0]?.owner || null;
    },

    async updateModules(id, modules) {
        const result = await db.query(
            'UPDATE sys.users SET accessible_modules = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, accessible_modules',
            [JSON.stringify(modules), id]
        );
        return result.rows[0];
    }
};

module.exports = usersModel;
