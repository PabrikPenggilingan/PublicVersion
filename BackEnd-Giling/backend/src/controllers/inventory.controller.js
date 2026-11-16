/**
 * Inventory Controller - API endpoints for inventory management
 */

const inventoryService = require('../services/inventory.service');
const { asyncHandler } = require('../utils/helpers');
const {
    CreateManualItemCommand,
    CreateFromDryingCommand,
    CreateFromBatchCommand,
    UpdateInventoryItemCommand,
    AddSacksCommand,
    TakeSacksCommand,
    TakeWeightCommand
} = require('../dtos/inventory.dto');
const InventoryMapper = require('../mappers/inventory.mapper');

// Create manual inventory item
const createItem = asyncHandler(async (req, res) => {
    const command = new CreateManualItemCommand(req.user.id, req.body);
    const item = await inventoryService.createManualItem(command);

    res.status(201).json({
        success: true,
        data: InventoryMapper.toResponse(item),
        message: 'Item inventory berhasil dibuat'
    });
});

// Create from drying process
const createFromDrying = asyncHandler(async (req, res) => {
    const command = new CreateFromDryingCommand(req.params.dryingId, req.user.id, req.body);
    const items = await inventoryService.createFromDrying(command);

    res.status(201).json({
        success: true,
        data: items.map(InventoryMapper.toResponse),
        message: `${items.length} item inventory berhasil dibuat dari pengeringan`
    });
});

// Create from batch (direct to inventory)
const createFromBatch = asyncHandler(async (req, res) => {
    const command = new CreateFromBatchCommand(req.params.batchId, req.user.id, req.body);
    const item = await inventoryService.createFromBatch(command);

    res.status(201).json({
        success: true,
        data: InventoryMapper.toResponse(item),
        message: 'Item inventory berhasil dibuat langsung dari pembelian batch'
    });
});

// Get all inventory items (newest first by default, FIFO optional)
const getAllItems = asyncHandler(async (req, res) => {
    const { status, sourceType, categoryCode, processId, isTitipan, titipanSubtype, page = 1, limit = 20, fifo } = req.query;

    const result = await inventoryService.getAllItems({
        status,
        sourceType,
        categoryCode,
        processId,
        isTitipan,
        titipanSubtype,
        fifo: fifo === 'true',
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        offset: (parseInt(page) - 1) * Math.min(parseInt(limit), 100)
    }, req.user);

    res.json({
        success: true,
        data: result.items.map(InventoryMapper.toResponse),
        pagination: {
            page: result.page,
            total: result.total,
            totalPages: result.totalPages
        }
    });
});

// Get available items (FIFO) - for process/sale selection
const getAvailableItems = asyncHandler(async (req, res) => {
    const { limit = 50 } = req.query;
    const items = await inventoryService.getAvailableItemsFIFO(Math.min(parseInt(limit), 5000));

    res.json({
        success: true,
        data: items.map(InventoryMapper.toResponse)
    });
});

// Get available Gabah Titipan Basah items - for drying batch picker
const getAvailableTitipanBasah = asyncHandler(async (req, res) => {
    const items = await inventoryService.getAvailableTitipanBasah();

    res.json({
        success: true,
        data: items.map(InventoryMapper.toResponse)
    });
});

// Get single item by ID
const getItemById = asyncHandler(async (req, res) => {
    const item = await inventoryService.getItemById(req.params.id, req.user);

    res.json({
        success: true,
        data: InventoryMapper.toResponse(item)
    });
});

// Update item info
const updateItem = asyncHandler(async (req, res) => {
    const command = new UpdateInventoryItemCommand(req.params.id, req.user.id, req.body);
    const item = await inventoryService.updateItem(command);

    res.json({
        success: true,
        data: InventoryMapper.toResponse(item),
        message: 'Item berhasil diupdate'
    });
});

// Add sacks to item
const addSacks = asyncHandler(async (req, res) => {
    const { sacks } = req.body;

    if (!sacks || !Array.isArray(sacks) || sacks.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Daftar karung harus diisi'
        });
    }

    const command = new AddSacksCommand(req.params.id, req.user.id, sacks);
    const item = await inventoryService.addSacks(command);

    res.json({
        success: true,
        data: InventoryMapper.toResponse(item),
        message: `${sacks.length} karung berhasil ditambahkan`
    });
});

// Take sacks from item
const takeSacks = asyncHandler(async (req, res) => {
    const { sackIds, takenFor, referenceId } = req.body;

    if (!sackIds || !Array.isArray(sackIds) || sackIds.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Daftar karung harus diisi'
        });
    }

    if (!takenFor || !['process', 'sale'].includes(takenFor)) {
        return res.status(400).json({
            success: false,
            message: 'takenFor harus "process" atau "sale"'
        });
    }

    const command = new TakeSacksCommand(req.params.id, req.user.id, req.body);
    const item = await inventoryService.takeSacks(command);

    res.json({
        success: true,
        data: InventoryMapper.toResponse(item),
        message: `${sackIds.length} karung berhasil diambil`
    });
});

// Take stock by weight (for Gabah/Dedak/Menir/Broken without sacks)
const takeWeight = asyncHandler(async (req, res) => {
    const { weightKg, takenFor, referenceId } = req.body;

    if (!weightKg || parseFloat(weightKg) <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Jumlah berat (kg) harus diisi dan lebih dari 0'
        });
    }

    if (!takenFor || !['process', 'sale'].includes(takenFor)) {
        return res.status(400).json({
            success: false,
            message: 'takenFor harus "process" atau "sale"'
        });
    }

    const command = new TakeWeightCommand(req.params.id, req.user.id, req.body);
    const item = await inventoryService.takeWeight(command);

    res.json({
        success: true,
        data: InventoryMapper.toResponse(item),
        message: `${weightKg} kg berhasil diambil`
    });
});

// Delete item
const deleteItem = asyncHandler(async (req, res) => {
    await inventoryService.deleteItem(req.params.id);

    res.json({
        success: true,
        message: 'Item berhasil dihapus'
    });
});

// Get statistics
const getStats = asyncHandler(async (req, res) => {
    const stats = await inventoryService.getStats();

    res.json({
        success: true,
        data: stats
    });
});

// Get all item categories from mst schema
const getCategories = asyncHandler(async (req, res) => {
    const { inventoryItemsModel } = require('../models');
    const categories = await inventoryItemsModel.getCategories();

    res.json({
        success: true,
        data: categories
    });
});

// Get per-category stock summary
const getCategoryStats = asyncHandler(async (req, res) => {
    const { inventoryItemsModel } = require('../models');
    const stats = await inventoryItemsModel.getCategoryStats();

    res.json({
        success: true,
        data: stats
    });
});

const returnToPenitip = asyncHandler(async (req, res) => {
    const feeAmount = parseFloat(req.body.feeAmount) || 0;
    const feeNotes = req.body.feeNotes || '';
    const item = await inventoryService.returnTitipan(req.params.id, req.user.id, feeAmount, feeNotes);
    res.json({
        success: true,
        data: InventoryMapper.toResponse(item),
        message: 'Status titipan berhasil diubah menjadi Dalam Proses Pembayaran'
    });
});

module.exports = {
    createItem,
    createFromDrying,
    createFromBatch,
    getAllItems,
    getAvailableItems,
    getAvailableTitipanBasah,
    getItemById,
    updateItem,
    addSacks,
    takeSacks,
    takeWeight,
    deleteItem,
    getStats,
    getCategories,
    getCategoryStats,
    returnToPenitip
};
