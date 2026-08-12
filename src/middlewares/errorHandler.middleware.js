const { logger } = require('../utils/logger');

class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Multer's own errors (file too large, too many files, etc.) aren't
  // AppErrors and don't carry a statusCode — translate them here instead of
  // letting them fall through as a raw 500.
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: 'UploadError', message: err.message });
  }

  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    // Plain `logger.error(err)` has, in practice, printed a bare "Error"
    // with no message for some Sequelize/mysql2 driver errors (empty
    // err.message on the outer error) — the actually useful detail lives on
    // err.parent/err.original (the raw driver error) and err.sql. Surface
    // all of that explicitly so a real failure is never a dead end again.
    const parentInfo = err.parent || err.original;
    const detailParts = [
      `${err.name || 'Error'}: ${err.message || '(no message)'}`,
      parentInfo && `driver: ${parentInfo.code || ''} ${parentInfo.errno || ''} ${parentInfo.sqlMessage || parentInfo.message || ''}`.trim(),
      err.sql && `sql: ${err.sql}`,
    ].filter(Boolean);
    logger.error(`${detailParts.join(' | ')}\n${err.stack}`);
  }

  res.status(statusCode).json({
    error: err.name || 'Error',
    message: statusCode >= 500 ? 'Something went wrong. Please try again.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: 'NotFound', message: 'Route not found.' });
};

module.exports = { AppError, errorHandler, notFoundHandler };
