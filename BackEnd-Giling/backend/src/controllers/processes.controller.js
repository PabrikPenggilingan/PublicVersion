const processService = require('../services/process.service');
const { asyncHandler, getPaginationParams, formatPaginatedResponse } = require('../utils/helpers');
const {
    StartProcessCommand,
    UpdateProcessCommand,
    CancelProcessCommand,
    CompleteProcessCommand,
    AttachBatchCommand,
    AddProcessCostCommand
} = require('../dtos/process.dto');
const ProcessMapper = require('../mappers/process.mapper');

// POST /api/processes — Buat proses baru & reserve gabah dari inventory
const createProcess = asyncHandler(async (req, res) => {
    const command = new StartProcessCommand(req.user.id, req.body);
    const process = await processService.startProcess(command);
    res.status(201).json({ success: true, data: ProcessMapper.toResponse(process) });
});

// GET /api/processes/:id
const getProcessById = asyncHandler(async (req, res) => {
    const process = await processService.getProcessById(req.params.id);
    res.json({ success: true, data: ProcessMapper.toResponse(process) });
});

// GET /api/processes
const getAllProcesses = asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPaginationParams(req.query);
    const filters = { status: req.query.status };
    const { processes, total } = await processService.getAllProcesses(filters, limit, offset);
    res.json({ success: true, ...formatPaginatedResponse(processes.map(ProcessMapper.toResponse), total, page, limit) });
});

// PUT /api/processes/:id
const updateProcess = asyncHandler(async (req, res) => {
    const command = new UpdateProcessCommand(req.params.id, req.body);
    const process = await processService.updateProcess(command);
    res.json({ success: true, data: ProcessMapper.toResponse(process) });
});

// DELETE /api/processes/:id
const deleteProcess = asyncHandler(async (req, res) => {
    await processService.deleteProcess(req.params.id);
    res.json({ success: true, message: 'Proses berhasil dihapus' });
});

// POST /api/processes/:id/cancel
const cancelProcess = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const command = new CancelProcessCommand(req.params.id, req.user.id, reason);
    const process = await processService.cancelProcess(command);
    res.json({ success: true, message: 'Proses berhasil dibatalkan', data: ProcessMapper.toResponse(process) });
});

// POST /api/processes/:id/complete
const completeProcess = asyncHandler(async (req, res) => {
    const command = new CompleteProcessCommand(req.params.id, req.user.id, req.body);
    const items = await processService.completeProcess(command);
    res.json({ success: true, message: 'Penggilingan selesai', data: items.map(ProcessMapper.toResponse) });
});

// POST /api/processes/:id/batches (legacy)
const attachBatch = asyncHandler(async (req, res) => {
    const command = new AttachBatchCommand(req.params.id, req.body);
    const processBatch = await processService.attachBatch(command);
    res.status(201).json({ success: true, data: processBatch }); // Pass-through directly, likely no mapper needed for this pivot table
});

// DELETE /api/processes/:id/batches/:batchId (legacy)
const detachBatch = asyncHandler(async (req, res) => {
    await processService.detachBatch(req.params.id, req.params.batchId);
    res.json({ success: true, message: 'Batch detached successfully' });
});

// GET /api/processes/:id/batches (legacy)
const getProcessBatches = asyncHandler(async (req, res) => {
    const batches = await processService.getProcessBatches(req.params.id);
    res.json({ success: true, data: batches });
});

// POST /api/processes/:id/costs — Tambah biaya HPP
const addProcessCost = asyncHandler(async (req, res) => {
    const command = new AddProcessCostCommand(req.params.id, req.user.id, req.body);
    const cost = await processService.addProcessCost(command);
    res.status(201).json({ success: true, data: cost });
});

// GET /api/processes/:id/costs — List biaya HPP
const getProcessCosts = asyncHandler(async (req, res) => {
    const costs = await processService.getProcessCosts(req.params.id);
    res.json({ success: true, data: costs });
});

// DELETE /api/processes/:id/costs/:costId — Hapus biaya HPP
const deleteProcessCost = asyncHandler(async (req, res) => {
    await processService.deleteProcessCost(req.params.id, req.params.costId);
    res.json({ success: true, message: 'Biaya berhasil dihapus' });
});

const millingService = require('../services/milling.service');

// POST /api/processes/:id/milling-link - Generate sharable link
const generateMillingLink = asyncHandler(async (req, res) => {
    const link = await millingService.getOrCreateLink(req.params.id);
    res.json({ success: true, data: link });
});

// GET /api/processes/:id/milling-summary - Get session summary
const getMillingSummary = asyncHandler(async (req, res) => {
    const summary = await millingService.getProcessSummary(req.params.id);
    res.json({ success: true, data: summary });
});

// POST /api/processes/:id/finalize - Admin finalizes and moves to inventory
const finalizeProduction = asyncHandler(async (req, res) => {
    const items = await millingService.finalizeProduction(req.params.id, req.user.id, req.body.corrections);
    res.json({ success: true, message: 'Produksi berhasil difinalisasi', data: items });
});

module.exports = {
    createProcess,
    getProcessById,
    getAllProcesses,
    updateProcess,
    deleteProcess,
    cancelProcess,
    completeProcess,
    attachBatch,
    detachBatch,
    getProcessBatches,
    addProcessCost,
    getProcessCosts,
    deleteProcessCost,
    generateMillingLink,
    getMillingSummary,
    finalizeProduction
};
