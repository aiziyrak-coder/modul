const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const { ipKeyGenerator } = rateLimit;

const OBJECT_ID_RE = /^[0-9a-f]{24}$/;

const authLoginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urining.",
  },
  skipSuccessfulRequests: true,
});

const authLoginPinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urining.",
  },
  skipSuccessfulRequests: true,
  keyGenerator: (req) =>
    typeof req.body?.oneIdPin === "string" && req.body.oneIdPin
      ? `pin:${req.body.oneIdPin}`
      : ipKeyGenerator(req.ip),
});

const authRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Juda ko'p urinish. 15 daqiqadan so'ng qayta urining.",
  },
  keyGenerator: (req) => {
    const token = req.body?.refreshToken;
    if (typeof token === "string" && token) {
      try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, {
          ignoreExpiration: true,
        });
        if (decoded && OBJECT_ID_RE.test(String(decoded._id))) {
          return `u:${decoded._id}`;
        }
      } catch {}
    }
    return ipKeyGenerator(req.ip);
  },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "So'rovlar chegarasi oshib ketdi. Biroz kuting.",
  },
  skip: (req) => {
    return req.path.startsWith("/api-docs") || req.path.startsWith("/files");
  },
});

const apiUserLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "So'rovlar chegarasi oshib ketdi. Biroz kuting.",
  },
  keyGenerator: (req) =>
    req.user && req.user._id ? `user:${req.user._id}` : ipKeyGenerator(req.ip),
});

const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "So'rovlar chegarasi oshib ketdi. Biroz kuting.",
  },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    statusCode: 429,
    message: "Fayl yuklash chegarasi oshdi. 1 soatdan so'ng qayta urining.",
  },
});

module.exports = {
  authLoginIpLimiter,
  authLoginPinLimiter,
  authRefreshLimiter,
  apiLimiter,
  apiUserLimiter,
  publicReadLimiter,
  uploadLimiter,
};
