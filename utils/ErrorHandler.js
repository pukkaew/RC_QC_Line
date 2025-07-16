// Error handling utility
const logger = require('./Logger');

// Custom error class for application-specific errors
class AppError extends Error {
  constructor(message, statusCode = 500, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Middleware for handling errors in Express
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    details: err.details || {},
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Set default values if not provided
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  // Determine if the error should be shown to the user
  const isProduction = process.env.NODE_ENV === 'production';
  const details = isProduction ? {} : (err.details || {});
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(Object.keys(details).length > 0 && { details })
    }
  });
};

// Function to handle async route handlers
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  errorHandler,
  asyncHandler
};