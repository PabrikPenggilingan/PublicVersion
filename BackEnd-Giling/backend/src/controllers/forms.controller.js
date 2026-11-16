const formService = require('../services/form.service');
const logger = require('../services/logger.service');
const purchaseService = require('../services/purchase.service');
const { UpdatePurchaseCommand } = require('../dtos/purchase.dto');
const { SubmitFormPurchaseCommand, CompleteFormBatchCommand, UpdateFormPurchaseCommand } = require('../dtos/form.dto');
const FormMapper = require('../mappers/form.mapper');
const { asyncHandler } = require('../utils/helpers');

/**
 * Get form info for a link code (public - just needs valid link)
 */
const getFormInfo = asyncHandler(async (req, res) => {
    try {
        const info = await formService.getFormInfo(req.params.linkCode);
        res.json({
            data: FormMapper.toResponse(info)
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        throw error;
    }
});

/**
 * Submit a purchase form with photos (requires authentication)
 */
const submitPurchase = asyncHandler(async (req, res) => {
    const command = new SubmitFormPurchaseCommand(req.params.linkCode, req.user.id, req.body, req.files || []);

    // Validate max 3 photos
    if (command.files.length > 3) {
        return res.status(400).json({ error: 'Maksimal 3 foto gabah' });
    }

    try {
        const result = await formService.submitPurchase(command);
        
        // Log IP and UA (controller concern)
        await logger.log({
            userId: command.userId,
            action: 'CREATE',
            entityType: 'purchase',
            entityId: result.purchase.id,
            oldData: null,
            newData: result.purchase,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json({
            data: FormMapper.toResponse(result.purchase),
            photoCount: result.photoCount,
            purchaseCount: result.purchaseCount,
            totalTonnage: result.totalTonnage,
            maxPurchases: result.maxPurchases
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        throw error;
    }
});

/**
 * Get batch summary with all entries and photos
 */
const getBatchSummary = asyncHandler(async (req, res) => {
    try {
        const summary = await formService.getBatchSummary(req.params.linkCode, req.user?.id);
        res.json({
            data: FormMapper.toResponse(summary)
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        throw error;
    }
});

/**
 * Complete batch with struk and lapangan photos
 */
const completeBatch = asyncHandler(async (req, res) => {
    const command = new CompleteFormBatchCommand(req.params.linkCode, req.user.id, req.body, req.files || {});

    try {
        const completion = await formService.completeBatch(command);
        
        // Log IP and UA
        await logger.log({
            userId: command.userId,
            action: 'COMPLETE',
            entityType: 'batch',
            entityId: completion.batch_id,
            oldData: null,
            newData: completion,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json({
            data: FormMapper.toResponse(completion),
            message: 'Batch berhasil di-complete!'
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        throw error;
    }
});

/**
 * Get employee's own submissions
 */
const getMySubmissions = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const result = await formService.getMySubmissions(req.user.id, page, limit);

    res.json({
        data: result.data.map(FormMapper.toResponse),
        pagination: {
            page,
            limit,
            total: result.total
        }
    });
});

/**
 * Update a purchase form (requires authentication)
 */
const updatePurchase = asyncHandler(async (req, res) => {
    const command = new UpdateFormPurchaseCommand(req.params.linkCode, req.params.purchaseId, req.user.id, req.body);

    try {
        const batchId = await formService.getBatchIdFromLink(command.linkCode);
        await formService.ensureBatchNotCompleted(batchId);
        await formService.ensurePurchaseBelongsToBatch(command.purchaseId, batchId);

        const serviceCommand = new UpdatePurchaseCommand(command.purchaseId, command.userId, command.data);
        const purchase = await purchaseService.updatePurchase(serviceCommand);

        res.json({
            success: true,
            data: FormMapper.toResponse(purchase)
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        throw error;
    }
});

/**
 * Delete a purchase form (requires authentication)
 */
const deletePurchase = asyncHandler(async (req, res) => {
    try {
        const batchId = await formService.getBatchIdFromLink(req.params.linkCode);
        await formService.ensureBatchNotCompleted(batchId);
        await formService.ensurePurchaseBelongsToBatch(req.params.purchaseId, batchId);

        await purchaseService.deletePurchase(req.params.purchaseId);
        
        res.json({
            success: true,
            message: 'Purchase deleted successfully'
        });
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        throw error;
    }
});

module.exports = {
    getFormInfo,
    submitPurchase,
    getBatchSummary,
    completeBatch,
    getMySubmissions,
    updatePurchase,
    deletePurchase
};
