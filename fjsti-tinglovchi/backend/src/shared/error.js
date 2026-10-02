const logger = require("./logger");

class ErrorHandler extends Error {
  constructor(statusCode, message, detail = "") {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

function handleError(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Kutilmagan server xatosi";

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} — ${message}`, { detail: err.detail, stack: err.stack });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} — ${statusCode} ${message}`);
  }

  const hideDetail = process.env.NODE_ENV === "production" && statusCode >= 500;
  return res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    detail: hideDetail ? "" : err.detail || "",
  });
}

module.exports = { ErrorHandler, handleError };
