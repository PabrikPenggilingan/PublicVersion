const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const batchesRoutes = require('./batches.routes');
const purchasesRoutes = require('./purchases.routes');
const processesRoutes = require('./processes.routes');
const salesRoutes = require('./sales.routes');
const filesRoutes = require('./files.routes');
const logsRoutes = require('./logs.routes');
const batchLinksRoutes = require('./batch-links.routes');
const formsRoutes = require('./forms.routes');
const dryingRoutes = require('./drying.routes');
const dryingFormsRoutes = require('./drying-forms.routes');
const inventoryRoutes = require('./inventory.routes');
const pendataanRoutes = require('./pendataan.routes');
const salesV2Routes = require('./salesV2.routes');
const financeRoutes = require('./finance.routes');
const logisticsRoutes = require('./logistics.routes');
const settingsRoutes = require('./settings.routes');
const usersRoutes = require('./users.routes');
const dashboardRoutes = require('./dashboard.routes');
const adminMonitoringRoutes = require('./adminMonitoring.routes');

// Mount routes
// Mount public/shareable routes first
router.use('/milling-forms', require('./millingForm.routes'));
router.use('/drying-forms', dryingFormsRoutes);
router.use('/forms', formsRoutes);

// Mount other routes
router.use('/dashboard', dashboardRoutes);
router.use('/auth', authRoutes);
router.use('/batches', batchesRoutes);
router.use('/', purchasesRoutes); 
router.use('/processes', processesRoutes);
router.use('/', salesRoutes);
router.use('/files', filesRoutes);
router.use('/logs', logsRoutes);
router.use('/', batchLinksRoutes);
router.use('/drying', dryingRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/pendataan', pendataanRoutes);
router.use('/sales-v2', salesV2Routes);
router.use('/finance', financeRoutes);
router.use('/logistics', logisticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/users', usersRoutes);
router.use('/admin', adminMonitoringRoutes);

module.exports = router;
