const usersModel = require('./user.model');
const batchesModel = require('./batch.model');
const purchasesModel = require('./purchase.model');
const processesModel = require('./process.model');
const processBatchesModel = require('./processBatch.model');
const processCostModel = require('./processCost.model');
const salesBerasModel = require('./salesBeras.model');
const salesSimplifiedModel = require('./salesSimplified.model');
const dryingProcessesModel = require('./dryingProcess.model');
const dryingBatchesModel = require('./dryingBatch.model');
const dryingSessionsModel = require('./dryingSession.model');
const dryingPhotosModel = require('./dryingPhoto.model');
const dryingLinksModel = require('./dryingLink.model');
const inventoryItemsModel = require('./inventoryItem.model');
const inventorySacksModel = require('./inventorySack.model');
const inventoryTransactionsModel = require('./inventoryTransaction.model');
const pendataanGabahModel = require('./pendataanGabah.model');
// Sales V2
const customerModel = require('./customer.model');
const priceListModel = require('./priceList.model');
const saleModel = require('./sale.model');
const { saleItemModel, saleDeliveryModel, salePaymentModel, saleReturnModel } = require('./saleV2.model');

module.exports = {
  usersModel,
  batchesModel,
  purchasesModel,
  processesModel,
  processBatchesModel,
  processCostModel,
  salesBerasModel,
  salesSimplifiedModel,
  dryingProcessesModel,
  dryingBatchesModel,
  dryingSessionsModel,
  dryingPhotosModel,
  dryingLinksModel,
  inventoryItemsModel,
  inventorySacksModel,
  inventoryTransactionsModel,
  pendataanGabahModel,
  // Sales V2
  customerModel,
  priceListModel,
  saleModel,
  saleItemModel,
  saleDeliveryModel,
  salePaymentModel,
  saleReturnModel,
  // Milling Flow
  millingLinkModel: require('./millingLink.model'),
  millingSessionModel: require('./millingSession.model'),
  millingPhotoModel: require('./millingPhoto.model')
};
