const requireEri = require("#shared/requireEri");
const winston = require("#shared/winston.logger");

const TEMP_ERI_PLACEHOLDER = "TEMP_ERI_PLACEHOLDER";

const ERI_REQUIRED = process.env.ERI_REQUIRED === "true";

function eriGuard(options = {}) {
  const bodyKey = options.bodyKey || "eriSignature";
  const inner = requireEri({ ...options, optional: !ERI_REQUIRED });

  return (req, res, next) => {
    if (!ERI_REQUIRED && req.body?.[bodyKey] === TEMP_ERI_PLACEHOLDER) {
      winston.info(
        `[eriGuard] soft-mode: TEMP_ERI_PLACEHOLDER o'tkazildi (${req.originalUrl})`,
      );
      return next();
    }
    return inner(req, res, next);
  };
}

module.exports = eriGuard;
module.exports.TEMP_ERI_PLACEHOLDER = TEMP_ERI_PLACEHOLDER;
module.exports.ERI_REQUIRED = ERI_REQUIRED;
