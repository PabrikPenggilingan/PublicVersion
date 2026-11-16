const settingsModel = require('../models/settings.model');

const settingsController = {
    async getFinancialLockDate(req, res) {
        try {
            const setting = await settingsModel.getSetting('FINANCIAL_LOCK_DATE');
            res.json({
                success: true,
                data: setting ? setting.setting_value_date : null
            });
        } catch (error) {
            console.error('Error fetching lock date:', error);
            res.status(500).json({ success: false, message: 'Gagal mengambil tanggal tutup buku' });
        }
    },

    async updateFinancialLockDate(req, res) {
        try {
            const { lockDate } = req.body;
            if (!lockDate) {
                return res.status(400).json({ success: false, message: 'lockDate diperlukan' });
            }

            const updated = await settingsModel.updateFinancialLockDate(lockDate, req.user.id);
            res.json({
                success: true,
                message: 'Tanggal tutup buku berhasil diperbarui',
                data: updated.setting_value_date
            });
        } catch (error) {
            console.error('Error updating lock date:', error);
            res.status(500).json({ success: false, message: 'Gagal memperbarui tanggal tutup buku' });
        }
    }
};

module.exports = settingsController;
