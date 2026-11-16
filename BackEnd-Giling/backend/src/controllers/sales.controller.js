const salesService = require('../services/sales.service');
const { asyncHandler } = require('../utils/helpers');
const {
  CreateBerasSaleCommand,
  UpdateBerasSaleCommand,
  CreateSimplifiedSaleCommand,
  UpdateSimplifiedSaleCommand
} = require('../dtos/sales.dto');

const getSalesByProcessId = asyncHandler(async (req, res) => {
  const sales = await salesService.getSalesByProcessId(req.params.processId);

  res.json({
    success: true,
    data: sales
  });
});

const createBerasSale = asyncHandler(async (req, res) => {
  const command = new CreateBerasSaleCommand(req.params.processId, req.body);
  const sale = await salesService.createBerasSale(command);

  res.status(201).json({
    success: true,
    data: sale
  });
});

const createSimplifiedSale = asyncHandler(async (req, res) => {
  // Extract type from URL path (e.g., /sales/dedak)
  const urlParts = req.path.split('/');
  const type = urlParts[urlParts.length - 1]; // dedak, sekam, menir, or broken

  const command = new CreateSimplifiedSaleCommand(req.params.processId, type, req.body);
  const sale = await salesService.createSimplifiedSale(command);

  res.status(201).json({
    success: true,
    data: sale
  });
});

const updateSale = asyncHandler(async (req, res) => {
  const { type, id } = req.params;

  let sale;
  if (type === 'beras') {
    const command = new UpdateBerasSaleCommand(id, req.body);
    sale = await salesService.updateBerasSale(command);
  } else {
    const command = new UpdateSimplifiedSaleCommand(type, id, req.body);
    sale = await salesService.updateSimplifiedSale(command);
  }

  res.json({
    success: true,
    data: sale
  });
});

const deleteSale = asyncHandler(async (req, res) => {
  const { type, id } = req.params;

  if (type === 'beras') {
    await salesService.deleteBerasSale(id);
  } else {
    await salesService.deleteSimplifiedSale(type, id);
  }

  res.json({
    success: true,
    message: `${type} sale deleted successfully`
  });
});

module.exports = {
  getSalesByProcessId,
  createBerasSale,
  createSimplifiedSale,
  updateSale,
  deleteSale
};
