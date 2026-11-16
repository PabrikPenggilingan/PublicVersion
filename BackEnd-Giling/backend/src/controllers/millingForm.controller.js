const { asyncHandler } = require('../utils/helpers');
const millingService = require('../services/milling.service');
const { SubmitMillingSessionCommand } = require('../dtos/millingForm.dto');
const MillingFormMapper = require('../mappers/millingForm.mapper');

// GET /api/milling-forms/:linkCode
const getFormInfo = asyncHandler(async (req, res) => {
    const info = await millingService.getFormInfoByCode(req.params.linkCode);
    res.json({ success: true, data: MillingFormMapper.toResponse(info) });
});

// POST /api/milling-forms/:linkCode/session
const submitSession = asyncHandler(async (req, res) => {
    const command = new SubmitMillingSessionCommand(req.params.linkCode, req.body, req.files);
    
    const session = await millingService.submitSession(command);

    res.status(201).json({ 
        success: true, 
        message: 'Sesi berhasil dicatat',
        data: MillingFormMapper.toResponse(session) 
    });
});

module.exports = {
    getFormInfo,
    submitSession
};
