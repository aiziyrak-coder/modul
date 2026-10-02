const jwt = require("jsonwebtoken");
const { ErrorHandler } = require("./error");
const UserModel = require("#modules/4.01-auth/user/user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");

const LISTENER_ROLE_TITLE = "malaka_tinglovchi";

const USER_PROJECTION = {
  _id: 1,
  firstName: 1,
  lastName: 1,
  photo: 1,
  role: 1,
  active: 1,
  department: 1,
  faculty: 1,
  tokenVersion: 1,
};

const loadUser = (id) =>
  UserModel.findById(id, USER_PROJECTION)
    .populate("role", ["title", "permissions", "scopeLevel"])
    .populate("department", ["_id", "faculty"])
    .exec();

const attachServiceUser = async (req, next) => {
  if (!process.env.SERVICE_KEY || req.headers["x-service-key"] !== process.env.SERVICE_KEY) {
    return next(new ErrorHandler(401, "Service kaliti yaroqsiz"));
  }
  const actAs = req.headers["x-act-as"];
  const actAsListener = req.headers["x-act-as-listener"];
  if (!actAs && !actAsListener) {
    return next(new ErrorHandler(401, "X-Act-As yoki X-Act-As-Listener yuborilmadi"));
  }

  if (actAsListener) req.listenerId = String(actAsListener);

  if (actAs) {
    const user = await loadUser(actAs);
    if (!user) return next(new ErrorHandler(401, "Foydalanuvchi topilmadi"));
    if (user.active === false) return next(new ErrorHandler(403, "Foydalanuvchi bloklangan"));
    if (!user.role || user.role.title !== LISTENER_ROLE_TITLE) {
      return next(new ErrorHandler(403, "Service faqat tinglovchi nomidan ishlay oladi"));
    }
    req.user = user;
    return next();
  }

  const role = await RoleModel.findOne({ title: LISTENER_ROLE_TITLE, active: true })
    .select("title permissions scopeLevel")
    .lean();
  if (!role) return next(new ErrorHandler(403, "Tinglovchi roli sozlanmagan"));

  req.user = { _id: null, role, firstName: null, lastName: null, isServiceListener: true };
  return next();
};

const verifyAndAttach = async (req, next, allowQuery = false) => {
  try {
    if (req.headers["x-service-key"]) return attachServiceUser(req, next);

    const authHeader = req.headers.authorization;

    let token;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (allowQuery && typeof req.query.token === "string" && req.query.token) {
      token = req.query.token;
    } else {
      return next(new ErrorHandler(401, "Token topilmadi"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await loadUser(decoded._id);

    if (!user) {
      return next(new ErrorHandler(401, "Foydalanuvchi topilmadi"));
    }

    if (typeof user?.active === "boolean" && user?.active == false) {
      return next(new ErrorHandler(403, "Foydalanuvchi bloklangan"));
    }

    if ((decoded.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      return next(new ErrorHandler(401, "Sessiya bekor qilingan, qayta kiring"));
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError") {
      return next(new ErrorHandler(401, "Yaroqsiz token"));
    }
    if (err.name === "TokenExpiredError") {
      return next(new ErrorHandler(401, "Token muddati tugagan"));
    }
    return next(new ErrorHandler(401, "Autentifikatsiya xatosi", err.message));
  }
};

const authenticate = (req, res, next) => verifyAndAttach(req, next, false);

authenticate.stream = (req, res, next) => verifyAndAttach(req, next, true);

module.exports = authenticate;
