const dryingService = require('../services/drying.service');
const { asyncHandler, getPaginationParams, formatPaginatedResponse } = require('../utils/helpers');
const {
    CreateDryingCommand,
    UpdateDryingBatchesCommand,
    CreateDryingLinkCommand,
    ToggleDryingActiveCommand,
    ToggleDryingLinkCommand,
    ApproveDryingCommand,
    RejectDryingCommand,
    AddDryingCostCommand
} = require('../dtos/drying.dto');
const DryingMapper = require('../mappers/drying.mapper');

// Admin: Create drying process
const createDrying = asyncHandler(async (req, res) => {
    const command = new CreateDryingCommand(req.user.id, req.body);
    const drying = await dryingService.createDryingProcess(command);

    res.status(201).json({
        success: true,
        data: DryingMapper.toResponse(drying)
    });
});

// Admin: Get all drying processes
const getAllDrying = asyncHandler(async (req, res) => {
    const { page, limit, offset } = getPaginationParams(req.query);
    const filters = {};

    if (req.query.status) {
        filters.status = req.query.status;
    }

    const { dryings, total } = await dryingService.getAllDrying(filters, limit, offset, req.user);

    res.json({
        success: true,
        ...formatPaginatedResponse(dryings.map(DryingMapper.toResponse), total, page, limit)
    });
});

// Admin: Get drying by ID
const getDryingById = asyncHandler(async (req, res) => {
    const drying = await dryingService.getDryingById(req.params.id, req.user);

    res.json({
        success: true,
        data: DryingMapper.toResponse(drying)
    });
});

// Admin: Delete drying
const deleteDrying = asyncHandler(async (req, res) => {
    await dryingService.deleteDrying(req.params.id);

    res.json({
        success: true,
        message: 'Drying process deleted successfully'
    });
});

// Admin: Update batches
const updateBatches = asyncHandler(async (req, res) => {
    const command = new UpdateDryingBatchesCommand(req.params.id, req.body);
    const drying = await dryingService.updateDryingBatches(command);

    res.json({
        success: true,
        data: DryingMapper.toResponse(drying)
    });
});

// Admin: Get links
const getLinks = asyncHandler(async (req, res) => {
    const links = await dryingService.getLinksByDryingId(req.params.id);

    res.json({
        success: true,
        data: links
    });
});

// Admin: Create link
const createLink = asyncHandler(async (req, res) => {
    const command = new CreateDryingLinkCommand(req.params.id, req.body);
    const link = await dryingService.createLink(command);

    res.status(201).json({
        success: true,
        data: link
    });
});

// Admin: Toggle drying active
const toggleActive = asyncHandler(async (req, res) => {
    const command = new ToggleDryingActiveCommand(req.params.id, req.body);
    const drying = await dryingService.toggleDryingActive(command);

    res.json({
        success: true,
        data: DryingMapper.toResponse(drying)
    });
});

// Admin: Toggle link
const toggleLink = asyncHandler(async (req, res) => {
    const command = new ToggleDryingLinkCommand(req.params.linkId, req.params.id, req.body);
    const link = await dryingService.toggleLinkActive(command);

    res.json({
        success: true,
        data: link
    });
});

// Admin: Delete link
const deleteLink = asyncHandler(async (req, res) => {
    await dryingService.deleteLink(req.params.linkId, req.params.id);

    res.json({
        success: true,
        message: 'Link deleted successfully'
    });
});

// Admin: Approve drying (mark as COMPLETED, reduce batch tonnage)
const approveDrying = asyncHandler(async (req, res) => {
    const command = new ApproveDryingCommand(req.params.id, req.user.id);
    const drying = await dryingService.approveDrying(command);

    res.json({
        success: true,
        data: DryingMapper.toResponse(drying),
        message: 'Pengeringan berhasil diapprove'
    });
});

// Admin: Reject drying (reset to IN_PROGRESS)
const rejectDrying = asyncHandler(async (req, res) => {
    const command = new RejectDryingCommand(req.params.id);
    const drying = await dryingService.rejectDrying(command);

    res.json({
        success: true,
        data: DryingMapper.toResponse(drying),
        message: 'Pengeringan dikembalikan ke status IN_PROGRESS'
    });
});

// Admin: Add cost to drying
const addCost = asyncHandler(async (req, res) => {
    const command = new AddDryingCostCommand(req.params.id, req.user.id, req.body);
    const cost = await dryingService.addDryingCost(command);

    res.status(201).json({
        success: true,
        data: cost,
        message: 'Biaya berhasil ditambahkan dan dicatat di kas'
    });
});

// Admin: Get drying costs
const getCosts = asyncHandler(async (req, res) => {
    const costs = await dryingService.getDryingCosts(req.params.id);

    res.json({
        success: true,
        data: costs
    });
});

// Admin: Delete drying cost
const deleteCost = asyncHandler(async (req, res) => {
    await dryingService.deleteDryingCost(req.params.id, req.params.costId);

    res.json({
        success: true,
        message: 'Biaya berhasil dihapus'
    });
});

module.exports = {
    createDrying,
    getAllDrying,
    getDryingById,
    deleteDrying,
    updateBatches,
    toggleActive,
    approveDrying,
    rejectDrying,
    getLinks,
    createLink,
    toggleLink,
    deleteLink,
    addCost,
    getCosts,
    deleteCost
};

