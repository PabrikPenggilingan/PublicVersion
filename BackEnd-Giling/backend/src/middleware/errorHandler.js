const config = require('../config/env');
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.stack = err.stack;

  // Log error
  console.error('Error Detail:', {
    message: err.message,
    code: err.code,
    detail: err.detail,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    body: req.body
  });
  try {
    require('fs').appendFileSync('error.log', new Date().toISOString() + '\\n' + err.stack + '\\n\\n');
  } catch (e) {}

  // PostgreSQL errors
  if (err.code === '23505') {
    error = new AppError('Duplicate entry', 409);
  }
  
  if (err.code === '23503') {
    error = new AppError('Referenced resource not found', 404);
  }
  
  if (err.code === '23514') {
    error = new AppError('Constraint violation: ' + (err.detail || err.message), 422);
  }

  // Joi validation errors
  if (err.isJoi) {
    error = new AppError(err.details[0].message, 400);
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(config.nodeEnv === 'development' && {
      stack: error.stack,
      details: err.detail
    })
  });
};

// 404 handler
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
