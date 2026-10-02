const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const authenticate = require("#shared/authenticate");
const C = require("./auth.controller");

const LOGIN_MAX =
  Number(process.env.LOGIN_RATE_MAX) ||
  (process.env.NODE_ENV === "production" ? 10 : 100);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", statusCode: 429, message: "Juda ko'p urinish — birozdan so'ng qayta urinib ko'ring" },
});

router.post("/", loginLimiter, C.login);
router.post("/refresh", loginLimiter, C.refresh);
router.get("/profile", authenticate, C.profile);

module.exports = router;
