const purchaseService = require('../services/purchase.service');
const { asyncHandler, getPaginationParams, formatPaginatedResponse } = require('../utils/helpers');
const { CreatePurchaseCommand, UpdatePurchaseCommand } = require('../dtos/purchase.dto');
const PurchaseMapper = require('../mappers/purchase.mapper');

const createPurchase = asyncHandler(async (req, res) => {
  const command = new CreatePurchaseCommand(req.params.batchId, req.user.id, req.body);
  const purchase = await purchaseService.createPurchase(command);
  
  res.status(201).json({
    success: true,
    data: PurchaseMapper.toResponse(purchase)
  });
});

const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await purchaseService.getPurchaseById(req.params.id);
  
  res.json({
    success: true,
    data: PurchaseMapper.toResponse(purchase)
  });
});

const getPurchasesByBatchId = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPaginationParams(req.query);
  
  const { purchases, total } = await purchaseService.getPurchasesByBatchId(
    req.params.batchId,
    limit,
    offset
  );
  
  res.json({
    success: true,
    ...formatPaginatedResponse(purchases.map(PurchaseMapper.toResponse), total, page, limit)
  });
});

const updatePurchase = asyncHandler(async (req, res) => {
  const command = new UpdatePurchaseCommand(req.params.id, req.user.id, req.body);
  const purchase = await purchaseService.updatePurchase(command);
  
  res.json({
    success: true,
    data: PurchaseMapper.toResponse(purchase)
  });
});

const deletePurchase = asyncHandler(async (req, res) => {
  await purchaseService.deletePurchase(req.params.id);
  
  res.json({
    success: true,
    message: 'Purchase deleted successfully'
  });
});

const getAllPurchases = asyncHandler(async (req, res) => {
  const { page, limit, offset } = getPaginationParams(req.query);
  const { paymentStatus, calo } = req.query;
  
  const { purchases, total } = await purchaseService.getAllPurchases(
    limit,
    offset,
    { paymentStatus, calo }
  );
  
  res.json({
    success: true,
    ...formatPaginatedResponse(purchases.map(PurchaseMapper.toResponse), total, page, limit)
  });
});

const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo provided' });
  }

  const purchaseId = req.params.id;
  const photo = await purchaseService.uploadPhoto(purchaseId, req.file);

  res.status(201).json({
    success: true,
    data: photo
  });
});

module.exports = {
  createPurchase,
  getPurchaseById,
  getPurchasesByBatchId,
  updatePurchase,
  deletePurchase,
  getAllPurchases,
  uploadPhoto
};
