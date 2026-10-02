const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const service = require("./loginLock.service");

const loginLockGuard = async (req, res, next) => {
  const pin = typeof req.body?.oneIdPin === "string" ? req.body.oneIdPin : "";
  if (!pin) return next();

  const masked = `****${pin.slice(-4)}`;

  let state;
  try {
    state = await service.checkLock(req.ip, pin);
  } catch (err) {
    winston.error(`[loginLock] qulfni tekshirib bo'lmadi (${masked}): ${err.message}`);
    return next(
      new ErrorHandler(
        503,
        "Kirish xizmati vaqtincha ishlamayapti. Birozdan so'ng qayta urining.",
        err.message,
      ),
    );
  }

  if (!state.locked) return next();

  req.auditUser = {
    id: null,
    name: `Qulflangan hisobga urinish · PIN ${masked}`,
  };

  winston.warn(
    `[loginLock] qulflangan juftlikka urinish · PIN ${masked} · ochilish: ${state.lockedUntil.toISOString()}`,
  );

  res.setHeader("Retry-After", String(state.retryAfterSeconds));
  return next(
    new ErrorHandler(
      429,
      `Juda ko'p muvaffaqiyatsiz urinish. Hisob vaqtincha qulflandi — ${state.retryAfterMinutes} daqiqadan so'ng qayta urining.`,
    ),
  );
};

module.exports = loginLockGuard;
