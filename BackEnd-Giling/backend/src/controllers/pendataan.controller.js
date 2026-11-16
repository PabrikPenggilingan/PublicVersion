/**
 * Pendataan Gabah Controller - API endpoints for R&D grain data collection
 */

const pendataanService = require('../services/pendataan.service');
const { asyncHandler } = require('../utils/helpers');
const { CreatePendataanCommand, UpdatePendataanCommand } = require('../dtos/pendataan.dto');
const PendataanMapper = require('../mappers/pendataan.mapper');

// Create pendataan
const create = asyncHandler(async (req, res) => {
    const command = new CreatePendataanCommand(req.user.id, req.body);
    const pendataan = await pendataanService.create(command);

    res.status(201).json({
        success: true,
        data: PendataanMapper.toResponse(pendataan),
        message: 'Pendataan Gabah berhasil dibuat'
    });
});

// Get pendataan by ID
const getById = asyncHandler(async (req, res) => {
    const pendataan = await pendataanService.getById(req.params.id);

    res.json({
        success: true,
        data: PendataanMapper.toResponse(pendataan)
    });
});

// Get pendataan by purchase ID
const getByPurchaseId = asyncHandler(async (req, res) => {
    const pendataan = await pendataanService.getByPurchaseId(req.params.purchaseId);

    res.json({
        success: true,
        data: pendataan ? PendataanMapper.toResponse(pendataan) : null
    });
});

// Get all pendataan
const getAll = asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = await pendataanService.getAll(limit, offset);

    res.json({
        success: true,
        data: {
            ...result,
            data: result.data.map(PendataanMapper.toResponse)
        }
    });
});

// Update pendataan
const update = asyncHandler(async (req, res) => {
    const command = new UpdatePendataanCommand(req.params.id, req.body);
    const pendataan = await pendataanService.update(command);

    res.json({
        success: true,
        data: PendataanMapper.toResponse(pendataan),
        message: 'Pendataan Gabah berhasil diperbarui'
    });
});

// Delete pendataan
const deletePendataan = asyncHandler(async (req, res) => {
    await pendataanService.delete(req.params.id);

    res.json({
        success: true,
        message: 'Pendataan Gabah berhasil dihapus'
    });
});

module.exports = {
    create,
    getById,
    getByPurchaseId,
    getAll,
    update,
    delete: deletePendataan
};
