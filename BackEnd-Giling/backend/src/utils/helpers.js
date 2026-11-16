const { v4: uuidv4, validate: uuidValidate } = require('uuid');

// UUID helpers
const generateUUID = () => uuidv4();
const isValidUUID = (uuid) => uuidValidate(uuid);

// Pagination helpers
const getPaginationParams = (query, defaultPageSize = 30, maxPageSize = 100) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(maxPageSize, Math.max(1, parseInt(query.limit) || defaultPageSize));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

const formatPaginatedResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// Date helpers
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

const isWithinDays = (startDate, endDate, maxDays) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= maxDays;
};

// Number helpers
const roundToDecimal = (num, decimals = 2) => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

const calculateRendemen = (outputKg, inputKg) => {
  if (inputKg === 0) return 0;
  return roundToDecimal((outputKg / inputKg) * 100, 2);
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Clean object (remove null/undefined values)
const cleanObject = (obj) => {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
};

module.exports = {
  generateUUID,
  isValidUUID,
  getPaginationParams,
  formatPaginatedResponse,
  formatDate,
  isWithinDays,
  roundToDecimal,
  calculateRendemen,
  asyncHandler,
  cleanObject
};
