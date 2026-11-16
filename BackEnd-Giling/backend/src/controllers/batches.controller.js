const batchService = require('../services/batch.service');
const db = require('../config/database');
const { asyncHandler, getPaginationParams, formatPaginatedResponse } = require('../utils/helpers');
const { CreateBatchCommand, UpdateBatchCommand, CreateBatchPaymentCommand } = require('../dtos/batch.dto');
const BatchMapper = require('../mappers/batch.mapper');

const createBatch = asyncHandler(async (req, res) => {
  const command = new CreateBatchCommand(req.user.id, req.body);
  const batch = await batchService.createBatch(command);

  res.status(201).json({
    success: true,
    data: BatchMapper.toResponse(batch)
  });
});

const getBatchById = asyncHandler(async (req, res) => {
  const batch = await batchService.getBatchById(req.params.id);

  res.json({
    success: true,
    data: BatchMapper.toResponse(batch)
  });
});

const getAllBatches = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPaginationParams(req.query);
  const filters = {
    status: req.query.status,
    availableForDrying: req.query.availableForDrying === 'true'
  };

  const { batches, total } = await batchService.getAllBatches(filters, limit, offset);

  res.json({
    success: true,
    ...formatPaginatedResponse(batches.map(BatchMapper.toResponse), total, page, limit)
  });
});

const updateBatch = asyncHandler(async (req, res) => {
  const command = new UpdateBatchCommand(req.params.id, req.body);
  const batch = await batchService.updateBatch(command);

  res.json({
    success: true,
    data: BatchMapper.toResponse(batch)
  });
});

const deleteBatch = asyncHandler(async (req, res) => {
  await batchService.deleteBatch(req.params.id);

  res.json({
    success: true,
    message: 'Batch deleted successfully'
  });
});

const getBatchCompletion = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await db.query(
    'SELECT * FROM trx.batch_completions WHERE batch_id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Completion not found' });
  }

  res.json({
    success: true,
    data: result.rows[0]
  });
});

const getBatchMarginReport = asyncHandler(async (req, res) => {
  const marginReport = await batchService.getBatchMarginReport(req.params.id, req.user.id);
  res.json({
    success: true,
    data: marginReport
  });
});

const getAllBatchMarginReports = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  const marginReports = await batchService.getAllBatchMarginReports(req.user.id, limit);
  res.json({
    success: true,
    data: marginReports
  });
});

const getBatchDebt = asyncHandler(async (req, res) => {
  const debt = await batchService.getBatchDebt(req.params.id, req.user.id);
  res.json({
    success: true,
    data: debt
  });
});

const createBatchPayment = asyncHandler(async (req, res) => {
  // Support both JSON body and multipart form data
  const body = {
    amount: parseFloat(req.body.amount),
    paymentDate: req.body.paymentDate,
    paymentMethod: req.body.paymentMethod,
    referenceNo: req.body.referenceNo,
    notes: req.body.notes
  };
  const buktiNotaPath = req.file ? req.file.path : null;
  const command = new CreateBatchPaymentCommand(req.params.id, req.user.id, body, buktiNotaPath);
  const debt = await batchService.createBatchPayment(command);
  res.status(201).json({
    success: true,
    data: debt
  });
});

module.exports = {
  createBatch,
  getBatchById,
  getAllBatches,
  updateBatch,
  deleteBatch,
  getBatchCompletion,
  getBatchMarginReport,
  getAllBatchMarginReports,
  getBatchDebt,
  createBatchPayment
};
