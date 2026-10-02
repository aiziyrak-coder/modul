const winston = require("./winston.logger");
const { isDevEnv } = require("./env");

class ErrorHandler extends Error {
  constructor(statusCode, message, detail, meta) {
    super();
    this.statusCode = statusCode;
    this.message = message;
    this.detail = detail;
    if (meta && typeof meta === "object") this.meta = meta;
  }
}

const handleError = (err, res) => {
  const statusCode = err.statusCode || 500;
  const rawMessage = err.message || "Internal Server Error";
  const detail = err.detail || "";

  winston.error(`${statusCode} - ${rawMessage} - ${detail}`);

  const hideDetail = !isDevEnv() && statusCode >= 500;

  const isDeliberateError = err instanceof ErrorHandler;
  const message = hideDetail && !isDeliberateError ? "Ichki server xatosi" : rawMessage;

  const body = {
    status: "error",
    statusCode,
    message,
    detail: hideDetail ? "" : detail,
  };
  if (err.meta && typeof err.meta === "object") {
    for (const [k, v] of Object.entries(err.meta)) {
      if (!(k in body)) body[k] = v;
    }
  }

  res.status(statusCode).json(body);
};

module.exports = { ErrorHandler, handleError };
