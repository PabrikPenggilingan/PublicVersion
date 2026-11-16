const dashboardService = require('../services/dashboard.service');

const dashboardController = {
    async getTimeline(req, res, next) {
        try {
            const timeline = await dashboardService.getTimeline(req.user);
            res.json({
                success: true,
                data: timeline
            });
        } catch (error) {
            next(error);
        }
    }
};

module.exports = dashboardController;
