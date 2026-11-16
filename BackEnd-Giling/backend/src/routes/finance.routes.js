const express = require('express');
const router = express.Router();
const financeController = require('../controllers/finance.controller');
const { verifyToken, requireFinanceAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const {
    payBatchSchema,
    createOverheadSchema,
    recordPurchasePaymentSchema
} = require('../validators/finance.validator');
const { logActivity } = require('../middleware/logActivity');
const { LOG_ACTIONS } = require('../utils/constants');


router.use(verifyToken);
router.use(requireFinanceAccess);

// Dashboard & Stats
router.get('/dashboard', financeController.getDashboard);
router.get('/recent-activity', financeController.getRecentActivity);
router.get('/accounts', financeController.getAccounts);
router.post('/accounts', financeController.createAccount);
router.put('/accounts/:id', financeController.updateAccount);
router.get('/balance-sheet', financeController.getBalanceSheet);


// Financial Report with Date Range (NEW)
router.get('/report', financeController.getReport);
router.get('/report/download', financeController.downloadReport);

// Legacy Daily P&L (backward compat — kept for existing frontend calls)
router.get('/daily-report', financeController.getDailyReport);
router.get('/daily-report/download', financeController.downloadDailyReport);

// Overhead Expenses
router.post('/overhead', logActivity(LOG_ACTIONS.CREATE, 'finance'), validateRequest(createOverheadSchema), financeController.createOverhead);

// Debt Management (Purchases)
router.post('/purchase-payments', logActivity(LOG_ACTIONS.CREATE, 'finance'), validateRequest(recordPurchasePaymentSchema), financeController.recordPurchasePayment);


// ── Approval Center (NEW) ─────────────────────────────────────────────
// GET all pending transactions awaiting Finance Manager approval
router.get('/approvals', financeController.getPendingApprovals);
// PUT approve a single pending transaction (assign account + update balance)
router.put('/transactions/:id/approve', financeController.approveTransaction);
// Bukti kas: bayar / terima beberapa transaksi tertunda sekaligus (BKK / BKM)
router.post('/vouchers', logActivity(LOG_ACTIONS.CREATE, 'finance'), validateRequest(payBatchSchema), financeController.payBatch);
router.get('/vouchers', financeController.getVouchers);
router.get('/vouchers/:id', financeController.getVoucherById);
// PUT reject a single pending transaction
router.put('/transactions/:id/reject', financeController.rejectTransaction);

// GET transaction detail with joined relation metadata (NEW)
router.get('/transactions/:id', financeController.getTransactionDetail);
// POST transfer funds between accounts (NEW)
router.post('/transfer', financeController.transferFunds);
// POST record manual cash adjustment/capital injection (NEW)
router.post('/transactions/manual', financeController.createManualTransaction);

module.exports = router;
