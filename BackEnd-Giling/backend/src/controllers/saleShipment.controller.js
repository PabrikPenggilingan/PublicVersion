const { asyncHandler } = require('../utils/helpers');
const saleShipmentService = require('../services/saleShipment.service');

const getShipments = asyncHandler(async (req, res) => {
    const data = await saleShipmentService.getAll();
    res.json({ success: true, data });
});

const getShipmentById = asyncHandler(async (req, res) => {
    const data = await saleShipmentService.getById(req.params.id);
    res.json({ success: true, data });
});

const getAvailableSales = asyncHandler(async (req, res) => {
    const data = await saleShipmentService.getAvailableSales(req.query.excludeShipmentId || null);
    res.json({ success: true, data });
});

const createShipment = asyncHandler(async (req, res) => {
    const data = await saleShipmentService.save(null, req.body, req.user.id);
    res.status(201).json({ success: true, message: 'Pengiriman disimpan, biaya dikirim ke Keuangan', data });
});

const updateShipment = asyncHandler(async (req, res) => {
    const data = await saleShipmentService.save(req.params.id, req.body, req.user.id);
    res.json({ success: true, message: 'Pengiriman diperbarui', data });
});

const deleteShipment = asyncHandler(async (req, res) => {
    const data = await saleShipmentService.delete(req.params.id);
    res.json({ success: true, message: 'Pengiriman dihapus', data });
});

module.exports = {
    getShipments,
    getShipmentById,
    getAvailableSales,
    createShipment,
    updateShipment,
    deleteShipment,
};
