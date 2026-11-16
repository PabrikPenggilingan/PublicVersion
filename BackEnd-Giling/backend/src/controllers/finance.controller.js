const financeService = require('../services/finance.service');
const { asyncHandler } = require('../utils/helpers');
const {
    CreateOverheadCommand,
    RecordPurchasePaymentCommand,
    RecordCaloPayoutCommand
} = require('../dtos/finance.dto');
const FinanceMapper = require('../mappers/finance.mapper');

const financeController = {
    getDashboard: asyncHandler(async (req, res) => {
        const dashboard = await financeService.getDashboard(req.user);
        res.json({ success: true, data: dashboard });
    }),

    createOverhead: asyncHandler(async (req, res) => {
        const command = new CreateOverheadCommand(req.user.id, req.body);
        const overhead = await financeService.recordOverhead(command);
        res.json({
            success: true,
            data: FinanceMapper.toResponse(overhead)
        });
    }),

    // ─── Report (with Date Range support) ─────────────────────────────
    getReport: asyncHandler(async (req, res) => {
        const { startDate, endDate, date } = req.query;
        // Support both ?date=YYYY-MM-DD (legacy) and ?startDate=...&endDate=...
        const start = startDate || date || new Date().toISOString().split('T')[0];
        const end   = endDate   || date || new Date().toISOString().split('T')[0];
        const report = await financeService.getReport(start, end);
        res.json({ success: true, data: report });
    }),

    // Legacy alias: kept for backward compat
    getDailyReport: asyncHandler(async (req, res) => {
        const { date } = req.query;
        const reportDate = date || new Date().toISOString().split('T')[0];
        const report = await financeService.getDailyReport(reportDate);
        res.json({ success: true, data: report });
    }),

    downloadReport: asyncHandler(async (req, res) => {
        const { startDate, endDate, date } = req.query;
        const start = startDate || date || new Date().toISOString().split('T')[0];
        const end   = endDate   || date || new Date().toISOString().split('T')[0];

        const reportData = await financeService.getReport(start, end);
        const balanceSheet = await financeService.getBalanceSheet(end);

        const pdfService = require('../services/pdf.service');
        const pdfDoc = await pdfService.generateFinancialReport(reportData, balanceSheet, req.user);
        const stream = await pdfDoc.getStream();

        const label = start === end ? start : `${start}_sampai_${end}`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Laporan_Keuangan_${label}.pdf`);

        stream.pipe(res);
        stream.end();
    }),

    // Legacy PDF alias
    downloadDailyReport: asyncHandler(async (req, res) => {
        const { date } = req.query;
        const reportDate = date || new Date().toISOString().split('T')[0];
        req.query.startDate = reportDate;
        req.query.endDate = reportDate;
        return financeController.downloadReport(req, res);
    }),

    // ─── Purchase Payment (Debt) ───────────────────────────────────────
    recordPurchasePayment: asyncHandler(async (req, res) => {
        const command = new RecordPurchasePaymentCommand(req.user.id, req.body);
        const payment = await financeService.recordPurchasePayment(command);
        res.json({
            success: true,
            data: FinanceMapper.toResponse(payment)
        });
    }),

    // ─── Finance Accounts ─────────────────────────────────────────────
    getAccounts: asyncHandler(async (req, res) => {
        const financeModel = require('../models/finance.model');
        const accounts = await financeModel.getAccounts(req.query);
        res.json({ success: true, data: accounts });
    }),

    createAccount: asyncHandler(async (req, res) => {
        const financeModel = require('../models/finance.model');
        const account = await financeModel.createAccount(req.body);
        res.json({ success: true, data: account });
    }),

    updateAccount: asyncHandler(async (req, res) => {
        const financeModel = require('../models/finance.model');
        const account = await financeModel.updateAccount(req.params.id, req.body);
        res.json({ success: true, data: account });
    }),

    // ─── Balance Sheet ─────────────────────────────────────────────────
    getBalanceSheet: asyncHandler(async (req, res) => {
        const { asOfDate } = req.query;
        const balanceSheet = await financeService.getBalanceSheet(asOfDate);
        res.json({ success: true, data: balanceSheet });
    }),

    // ─── Approval Center ──────────────────────────────────────────────
    getPendingApprovals: asyncHandler(async (req, res) => {
        const pending = await financeService.getPendingApprovals();
        res.json({ success: true, data: pending });
    }),

    approveTransaction: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { accountId } = req.body;
        const approved = await financeService.approveTransaction(id, accountId, req.user.id);
        res.json({ success: true, data: approved, message: 'Transaksi berhasil disetujui dan saldo kas diperbarui.' });
    }),

    payBatch: asyncHandler(async (req, res) => {
        const voucher = await financeService.payBatch(req.body, req.user.id);
        res.status(201).json({ success: true, data: voucher, message: `${voucher.voucher_no} tersimpan, ${voucher.items.length} transaksi disetujui.` });
    }),

    getVouchers: asyncHandler(async (req, res) => {
        res.json({ success: true, data: await financeService.getVouchers(req.query) });
    }),

    getVoucherById: asyncHandler(async (req, res) => {
        res.json({ success: true, data: await financeService.getVoucherById(req.params.id) });
    }),

    rejectTransaction: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const rejected = await financeService.rejectTransaction(id, req.user.id);
        res.json({ success: true, data: rejected, message: 'Transaksi berhasil ditolak.' });
    }),

    getTransactionDetail: asyncHandler(async (req, res) => {
        const { id } = req.params;
        const detail = await financeService.getTransactionDetail(id);
        res.json({ success: true, data: detail });
    }),

    transferFunds: asyncHandler(async (req, res) => {
        const result = await financeService.transferFunds(req.body, req.user.id);
        res.json({ success: true, data: result, message: 'Transfer dana berhasil dicatat.' });
    }),

    createManualTransaction: asyncHandler(async (req, res) => {
        const result = await financeService.createManualTransaction(req.body, req.user.id);
        res.json({ success: true, data: result, message: 'Transaksi manual berhasil dicatat.' });
    }),

    getRecentActivity: asyncHandler(async (req, res) => {
        const limit = parseInt(req.query.limit, 10) || 10;
        const data = await financeService.getRecentActivity(limit);
        res.json({ success: true, data });
    }),
};

module.exports = financeController;
