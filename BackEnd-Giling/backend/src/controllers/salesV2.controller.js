const {
    customerService, priceListService, saleService,
    deliveryService, paymentService, returnService
} = require('../services/salesV2.service');
const {
    CreateCustomerCommand, UpdateCustomerCommand,
    CreatePriceTierCommand, CreatePriceCommand,
    CreateSaleCommand, AddSaleItemCommand,
    CreateDeliveryCommand, CreatePaymentCommand, CreateReturnCommand
} = require('../dtos/salesV2.dto');
const SalesV2Mapper = require('../mappers/salesV2.mapper');

// ════════════════════════════════════════
// CUSTOMERS
// ════════════════════════════════════════
const getCustomers = async (req, res, next) => {
    try {
        const { isActive, tierId, search } = req.query;
        const filters = {
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            tierId, search
        };
        const data = await customerService.getAll(filters);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const getCustomerById = async (req, res, next) => {
    try {
        const data = await customerService.getById(req.params.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const createCustomer = async (req, res, next) => {
    try {
        const command = new CreateCustomerCommand(req.user.id, req.body);
        const data = await customerService.create(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const updateCustomer = async (req, res, next) => {
    try {
        const command = new UpdateCustomerCommand(req.params.id, req.body);
        const data = await customerService.update(command);
        res.json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const deleteCustomer = async (req, res, next) => {
    try {
        const data = await customerService.deactivate(req.params.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

// ════════════════════════════════════════
// PRICE LIST & TIERS
// ════════════════════════════════════════
const getTiers = async (req, res, next) => {
    try {
        const data = await priceListService.getAllTiers();
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const createTier = async (req, res, next) => {
    try {
        const command = new CreatePriceTierCommand(req.body);
        const data = await priceListService.createTier(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const getPriceLists = async (req, res, next) => {
    try {
        const { tierId } = req.query;
        const data = tierId
            ? await priceListService.getPricesByTier(tierId)
            : await priceListService.getAllPriceLists();
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const createPrice = async (req, res, next) => {
    try {
        const command = new CreatePriceCommand(req.user.id, req.body);
        const data = await priceListService.createPrice(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const deletePrice = async (req, res, next) => {
    try {
        const data = await priceListService.deletePrice(req.params.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const getActivePrice = async (req, res, next) => {
    try {
        const { tierId, categoryId, date } = req.query;
        const data = await priceListService.getActivePrice(tierId, categoryId, date);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

// ════════════════════════════════════════
// SALES
// ════════════════════════════════════════
const getSales = async (req, res, next) => {
    try {
        const { status, paymentStatus, customerId, dateFrom, dateTo, page, limit } = req.query;
        const data = await saleService.getAll({
            status, paymentStatus, customerId, dateFrom, dateTo,
            page: parseInt(page) || 1,
            limit: Math.min(parseInt(limit) || 20, 100)
        });
        res.json({ success: true, ...data });
    } catch (err) { next(err); }
};

const getSaleById = async (req, res, next) => {
    try {
        const data = await saleService.getDetail(req.params.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const getSaleStats = async (req, res, next) => {
    try {
        const data = await saleService.getSummaryStats();
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const createSale = async (req, res, next) => {
    try {
        const command = new CreateSaleCommand(req.user.id, req.body);
        const data = await saleService.create(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const updateSaleCustomer = async (req, res, next) => {
    try {
        const { customerId } = req.body;
        const data = await saleService.updateCustomer(req.params.id, customerId);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const addSaleItem = async (req, res, next) => {
    try {
        const command = new AddSaleItemCommand(req.params.id, req.user.id, req.body);
        const data = await saleService.addItem(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const removeSaleItem = async (req, res, next) => {
    try {
        const data = await saleService.removeItem(req.params.id, req.params.itemId);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const confirmSale = async (req, res, next) => {
    try {
        const data = await saleService.confirm(req.params.id, req.user.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const setSaleDeduction = async (req, res, next) => {
    try {
        const data = await saleService.setDeduction(req.params.id, req.body, req.user.id);
        res.json({ success: true, message: 'Potongan customer disimpan', data });
    } catch (err) { next(err); }
};

const voidSale = async (req, res, next) => {
    try {
        const { voidReason } = req.body;
        const data = await saleService.voidSale(req.params.id, voidReason, req.user.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

const closeSale = async (req, res, next) => {
    try {
        const data = await saleService.closeSale(req.params.id, req.user.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

// ════════════════════════════════════════
// DELIVERIES
// ════════════════════════════════════════
const createDelivery = async (req, res, next) => {
    try {
        const command = new CreateDeliveryCommand(req.params.id, req.user.id, req.body);
        const data = await deliveryService.create(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const deleteDelivery = async (req, res, next) => {
    try {
        const data = await deliveryService.delete(req.params.deliveryId, req.params.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

// ════════════════════════════════════════
// PAYMENTS
// ════════════════════════════════════════
const createPayment = async (req, res, next) => {
    try {
        // Support both JSON body and multipart form data
        const body = {
            amount: parseFloat(req.body.amount),
            paymentDate: req.body.paymentDate,
            paymentMethod: req.body.paymentMethod,
            referenceNo: req.body.referenceNo,
            notes: req.body.notes
        };
        const buktiNotaPath = req.file ? req.file.path : null;
        const command = new CreatePaymentCommand(req.params.id, req.user.id, body, buktiNotaPath);
        const data = await paymentService.create(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const deletePayment = async (req, res, next) => {
    try {
        const data = await paymentService.delete(req.params.paymentId, req.params.id);
        res.json({ success: true, data });
    } catch (err) { next(err); }
};

// ════════════════════════════════════════
// RETURNS
// ════════════════════════════════════════
const createReturn = async (req, res, next) => {
    try {
        const command = new CreateReturnCommand(req.params.id, req.user.id, req.body);
        const data = await returnService.create(command);
        res.status(201).json({ success: true, data: SalesV2Mapper.toResponse(data) });
    } catch (err) { next(err); }
};

const deleteReturn = async (req, res, next) => {
    try {
        const { id, returnId } = req.params;
        const data = await returnService.delete(returnId, id);
        res.status(200).json({ success: true, data });
    } catch (err) { next(err); }
};

module.exports = {
    // Customers
    getCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer,
    // Price List
    getTiers, createTier, getPriceLists, getActivePrice, createPrice, deletePrice,
    // Sales
    getSales, getSaleById, getSaleStats, createSale, updateSaleCustomer, confirmSale, setSaleDeduction, voidSale, closeSale,
    addSaleItem, removeSaleItem,
    // Deliveries
    createDelivery, deleteDelivery,
    // Payments
    createPayment, deletePayment,
    // Returns
    createReturn, deleteReturn
};
