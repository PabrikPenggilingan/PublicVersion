const dryingService = require('../services/drying.service');
const { asyncHandler } = require('../utils/helpers');
const { SubmitDryingSessionCommand } = require('../dtos/dryingForm.dto');
const DryingFormMapper = require('../mappers/dryingForm.mapper');

// Get form info by link code
const getFormInfo = asyncHandler(async (req, res) => {
    const info = await dryingService.getFormInfo(req.params.linkCode);

    res.json({
        success: true,
        data: DryingFormMapper.toResponse(info)
    });
});

// Submit start session
const submitStart = asyncHandler(async (req, res) => {
    const command = new SubmitDryingSessionCommand(req.params.linkCode, req.body, req.files);
    const session = await dryingService.submitStartSession(command);

    res.status(201).json({
        success: true,
        data: DryingFormMapper.toResponse(session),
        message: 'Start session submitted successfully'
    });
});

// Submit end session
const submitEnd = asyncHandler(async (req, res) => {
    const command = new SubmitDryingSessionCommand(req.params.linkCode, req.body, req.files);
    command.user = req.user || null;
    // "Input Admin" button opens the form with ?mode=admin; a plain shareable link never has it
    command.adminMode = req.query.mode === 'admin';
    const session = await dryingService.submitEndSession(command);

    res.status(201).json({
        success: true,
        data: { ...DryingFormMapper.toResponse(session), autoApproved: !!command.autoApproved },
        message: command.autoApproved
            ? 'Pengeringan selesai dan langsung disetujui (input admin)'
            : 'End session submitted successfully'
    });
});

// Get summary
const getSummary = asyncHandler(async (req, res) => {
    const summary = await dryingService.getSummary(req.params.linkCode);

    res.json({
        success: true,
        data: DryingFormMapper.toResponse(summary)
    });
});

module.exports = {
    getFormInfo,
    submitStart,
    submitEnd,
    getSummary
};
