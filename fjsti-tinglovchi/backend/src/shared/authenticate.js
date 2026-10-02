const jwt = require("jsonwebtoken");
const { ErrorHandler } = require("./error");
const { ROLE } = require("#config/constants");

function serviceAuth(req, next) {
  if (!process.env.SERVICE_KEY || req.headers["x-service-key"] !== process.env.SERVICE_KEY) {
    return next(new ErrorHandler(401, "Service kaliti yaroqsiz"));
  }
  const actAs = req.headers["x-act-as"];
  if (!actAs) return next(new ErrorHandler(401, "X-Act-As yuborilmadi"));

  req.user = { id: String(actAs), role: "service" };
  req.listenerId = null;
  req.isServiceCall = true;
  return next();
}

function authenticate(req, _res, next) {
  if (req.headers["x-service-key"]) return serviceAuth(req, next);

  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return next(new ErrorHandler(401, "Token yuborilmadi"));

  try {
    const payload = jwt.verify(token, process.env.LISTENER_JWT_SECRET);

    if (payload.role !== ROLE) {
      return next(new ErrorHandler(403, "Bu kabinetga faqat tinglovchi kira oladi"));
    }

    req.user = { id: payload.sub, role: payload.role };
    req.listenerId = payload.listenerId || null;
    return next();
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    return next(new ErrorHandler(401, expired ? "Token muddati tugagan" : "Token yaroqsiz"));
  }
}

module.exports = authenticate;
