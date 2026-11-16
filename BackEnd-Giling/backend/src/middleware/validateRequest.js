const { ValidationError } = require('../utils/errors');

// Validate request with Joi schema
const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map(detail => detail.message)
        .join(', ');
      return next(new ValidationError(errorMessage));
    }

    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

module.exports = {
  validateRequest
};
