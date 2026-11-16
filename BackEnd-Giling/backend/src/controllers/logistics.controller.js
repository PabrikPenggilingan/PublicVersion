const { asyncHandler } = require('../utils/helpers');
const logisticsService = require('../services/logistics.service');
const { CreateLogisticsTaskCommand, UpdateLogisticsTaskCommand } = require('../dtos/logistics.dto');
const LogisticsMapper = require('../mappers/logistics.mapper');

const createLogisticsTask = asyncHandler(async (req, res) => {
    const command = new CreateLogisticsTaskCommand(req.user.id, req.body);
    const task = await logisticsService.createLogisticsTask(command);
    res.status(201).json({ success: true, message: 'Data logistik berhasil disimpan', data: LogisticsMapper.toResponse(task) });
});

const getLogisticsTasks = asyncHandler(async (req, res) => {
    const filters = {
        referenceType: req.query.referenceType,
        status: req.query.status
    };
    const tasks = await logisticsService.getAllLogisticsTasks(filters);
    res.json({ success: true, data: tasks.map(LogisticsMapper.toResponse) });
});

const getLogisticsTaskById = asyncHandler(async (req, res) => {
    const task = await logisticsService.getLogisticsTaskById(req.params.id);
    res.json({ success: true, data: LogisticsMapper.toResponse(task) });
});

const updateLogisticsTask = asyncHandler(async (req, res) => {
    const command = new UpdateLogisticsTaskCommand(req.params.id, req.user.id, req.body);
    const task = await logisticsService.updateLogisticsTask(command);
    res.json({ success: true, message: 'Data logistik berhasil diupdate', data: LogisticsMapper.toResponse(task) });
});

const getAvailableReferences = asyncHandler(async (req, res) => {
    const refs = await logisticsService.getAvailableReferences(req.query.type);
    res.json({ success: true, data: refs });
});

module.exports = {
    createLogisticsTask,
    getLogisticsTasks,
    getLogisticsTaskById,
    updateLogisticsTask,
    getAvailableReferences
};
