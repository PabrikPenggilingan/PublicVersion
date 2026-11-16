const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken } = require('../middleware/auth');

router.get('/timeline', verifyToken, dashboardController.getTimeline);

module.exports = router;
