const Joi = require('joi');
const { FILE_TYPES } = require('../utils/constants');

const uploadFileSchema = Joi.object({
    purchaseId: Joi.string().uuid().optional().allow('', null),
    processId: Joi.string().uuid().optional().allow('', null),
    saleId: Joi.string().uuid().optional().allow('', null),
    saleType: Joi.string().valid('giling', 'jual', 'titipan', 'titipan_keluar', 'v2', 'beras', 'dedak', 'sekam', 'menir', 'broken').optional().allow('', null),
    fileType: Joi.string().valid(...Object.values(FILE_TYPES)).required()
}).or('purchaseId', 'processId', 'saleId');

module.exports = {
    uploadFileSchema
};
