const db = require('../config/database');
const { tenantIds, tenantSql, inTenant } = require('../utils/tenant');
const requestContext = require('../config/context');

const pendataanGabahModel = {
    async create(data) {
        const {
            purchaseId,
            createdBy,
            jenisGabah,
            varietas,
            kadarAir,
            kadarHampa,
            butirRusak,
            bendaAsing,
            kondisiGabah,
            notes
        } = data;

        const result = await db.query(
            `INSERT INTO trx.pendataan_gabah 
       (purchase_id, created_by, jenis_gabah, varietas, kadar_air, kadar_hampa, butir_rusak, benda_asing, kondisi_gabah, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       ON CONFLICT (purchase_id) DO UPDATE SET
       created_by = COALESCE(EXCLUDED.created_by, trx.pendataan_gabah.created_by),
       jenis_gabah = COALESCE(EXCLUDED.jenis_gabah, trx.pendataan_gabah.jenis_gabah),
       varietas = EXCLUDED.varietas,
       kadar_air = COALESCE(EXCLUDED.kadar_air, trx.pendataan_gabah.kadar_air),
       kadar_hampa = COALESCE(EXCLUDED.kadar_hampa, trx.pendataan_gabah.kadar_hampa),
       butir_rusak = EXCLUDED.butir_rusak,
       benda_asing = EXCLUDED.benda_asing,
       kondisi_gabah = COALESCE(EXCLUDED.kondisi_gabah, trx.pendataan_gabah.kondisi_gabah),
       notes = EXCLUDED.notes,
       updated_at = now()
       RETURNING *`,
            [
                purchaseId ?? null, 
                createdBy ?? null, 
                jenisGabah ?? null, 
                varietas ?? null, 
                kadarAir ?? null, 
                kadarHampa ?? null, 
                butirRusak ?? null, 
                bendaAsing ?? null, 
                kondisiGabah ?? null, 
                notes ?? null
            ]
        );
        return result.rows[0];
    },

    async findById(id) {
        const result = await db.query(
            `SELECT pg.*, p.nama as purchase_name, p.tanggal_belanja, p.berat_gabah_kg
       FROM trx.pendataan_gabah pg
       JOIN trx.purchases p ON pg.purchase_id = p.id
       WHERE pg.id = $1`,
            [id]
        );
        return result.rows[0];
    },

    async getAll(filters = {}, limit = 50, offset = 0) {
        let query = `
      SELECT pg.*, p.nama as purchase_name, p.tanggal_belanja, p.berat_gabah_kg
      FROM trx.pendataan_gabah pg
      JOIN trx.purchases p ON pg.purchase_id = p.id
      WHERE 1=1
    `;
        const params = [];
        let paramIndex = 1;

        if (filters && filters.purchaseId) {
            query += ` AND pg.purchase_id = $${paramIndex}`;
            params.push(filters.purchaseId);
            paramIndex++;
        }

        const store = requestContext.getStore();
        const user = store?.user;
        if (user) {
            query += ` AND pg.created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(user));
            paramIndex++;
        }

        query += ` ORDER BY pg.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset || 0);

        const result = await db.query(query, params);
        return result.rows;
    },

    async count(filters = {}) {
        let query = 'SELECT COUNT(*) FROM trx.pendataan_gabah pg WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (filters && filters.purchaseId) {
            query += ` AND pg.purchase_id = $${paramIndex}`;
            params.push(filters.purchaseId);
            paramIndex++;
        }

        const store = requestContext.getStore();
        const user = store?.user;
        if (user) {
            query += ` AND pg.created_by = ANY($${paramIndex}::uuid[])`;
            params.push(tenantIds(user));
            paramIndex++;
        }

        const result = await db.query(query, params);
        return parseInt(result.rows[0].count);
    },

    async update(id, data) {
        const updates = [];
        const params = [];
        let paramIndex = 1;

        const fieldMap = {
            jenisGabah: 'jenis_gabah',
            varietas: 'varietas',
            kadarAir: 'kadar_air',
            kadarHampa: 'kadar_hampa',
            butirRusak: 'butir_rusak',
            bendaAsing: 'benda_asing',
            kondisiGabah: 'kondisi_gabah',
            notes: 'notes'
        };

        Object.entries(data).forEach(([key, value]) => {
            const dbField = fieldMap[key] || key;
            if (value !== undefined) {
                updates.push(`${dbField} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        });

        if (updates.length === 0) return this.findById(id);

        params.push(id);
        const result = await db.query(
            `UPDATE trx.pendataan_gabah SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            params
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            'DELETE FROM trx.pendataan_gabah WHERE id = $1 RETURNING *',
            [id]
        );
        return result.rows[0];
    },

    async findByPurchaseId(purchaseId) {
        const result = await db.query(
            'SELECT * FROM trx.pendataan_gabah WHERE purchase_id = $1',
            [purchaseId]
        );
        return result.rows[0];
    }
};

module.exports = pendataanGabahModel;
