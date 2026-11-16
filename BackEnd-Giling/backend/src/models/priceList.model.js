const db = require('../config/database');

const priceListModel = {
    // Get active price for a tier + category (latest effective_date <= target_date)
    async getActivePrice(tierId, categoryId, targetDate = new Date()) {
        const result = await db.query(
            `SELECT pl.*, t.name AS tier_name, c.name AS category_name, c.code AS category_code
             FROM mst.price_list pl
             JOIN mst.customer_tiers t ON pl.tier_id = t.id
             JOIN mst.item_categories c ON pl.category_id = c.id
             WHERE pl.tier_id = $1
               AND pl.category_id = $2
               AND pl.effective_date <= $3
             ORDER BY pl.effective_date DESC
             LIMIT 1`,
            [tierId, categoryId, targetDate]
        );
        return result.rows[0] || null;
    },

    // Get all prices for a tier (latest per category)
    async getPricesByTier(tierId) {
        const result = await db.query(
            `SELECT DISTINCT ON (pl.category_id)
                pl.*, t.name AS tier_name,
                c.name AS category_name, c.code AS category_code, c.icon AS category_icon
             FROM mst.price_list pl
             JOIN mst.customer_tiers t ON pl.tier_id = t.id
             JOIN mst.item_categories c ON pl.category_id = c.id
             WHERE pl.tier_id = $1
             ORDER BY pl.category_id, pl.effective_date DESC`,
            [tierId]
        );
        return result.rows;
    },

    // Get all price lists (for admin management)
    async findAll() {
        const result = await db.query(
            `SELECT pl.*, t.name AS tier_name,
                c.name AS category_name, c.code AS category_code
             FROM mst.price_list pl
             JOIN mst.customer_tiers t ON pl.tier_id = t.id
             JOIN mst.item_categories c ON pl.category_id = c.id
             ORDER BY t.sort_order, c.name, pl.effective_date DESC`
        );
        return result.rows;
    },

    async create(data) {
        const result = await db.query(
            `INSERT INTO mst.price_list
               (tier_id, category_id, price_per_kg, price_per_sack, effective_date, notes, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [data.tierId, data.categoryId,
             data.pricePerKg || null, data.pricePerSack || null,
             data.effectiveDate || new Date(),
             data.notes || null, data.createdBy || null]
        );
        return result.rows[0];
    },

    async delete(id) {
        const result = await db.query(
            `DELETE FROM mst.price_list WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0];
    },

    async getAllTiers() {
        const result = await db.query(
            `SELECT * FROM mst.customer_tiers WHERE is_active = TRUE ORDER BY sort_order`
        );
        return result.rows;
    },

    async createTier(data) {
        const maxOrder = await db.query(`SELECT MAX(sort_order) AS max FROM mst.customer_tiers`);
        const nextOrder = (maxOrder.rows[0].max || 0) + 1;
        const result = await db.query(
            `INSERT INTO mst.customer_tiers (name, description, sort_order)
             VALUES ($1, $2, $3) RETURNING *`,
            [data.name, data.description || null, data.sortOrder || nextOrder]
        );
        return result.rows[0];
    }
};

module.exports = priceListModel;
