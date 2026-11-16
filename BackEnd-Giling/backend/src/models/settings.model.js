const db = require('../config/database');

const settingsModel = {
    // Get a specific setting by key
    async getSetting(key) {
        const result = await db.query(
            "SELECT * FROM sys.system_settings WHERE setting_key = $1",
            [key]
        );
        return result.rows[0];
    },

    // Get all settings
    async getAllSettings() {
        const result = await db.query("SELECT * FROM sys.system_settings");
        return result.rows;
    },

    // Update the Financial Lock Date
    async updateFinancialLockDate(date, userId) {
        const result = await db.query(
            `INSERT INTO sys.system_settings (setting_key, setting_value_date, updated_by, updated_at)
             VALUES ('FINANCIAL_LOCK_DATE', $1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (setting_key) 
             DO UPDATE SET 
                setting_value_date = EXCLUDED.setting_value_date,
                updated_by = EXCLUDED.updated_by,
                updated_at = EXCLUDED.updated_at
             RETURNING *`,
            [date, userId]
        );
        return result.rows[0];
    }
};

module.exports = settingsModel;
