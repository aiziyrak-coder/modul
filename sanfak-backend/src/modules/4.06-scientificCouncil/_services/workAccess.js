const ScientificWork = require("#modules/4.06-scientificCouncil/scientificWork/scientificWork.model");
const { ErrorHandler } = require("#shared/error");

const isGlobalScope = (user) => user?.role?.scopeLevel === "global";

const idOf = (value) =>
  value && typeof value === "object" && value._id ? value._id : value;

const sameId = (a, b) => {
  const aId = idOf(a);
  if (!aId || !b) return false;
  return String(aId) === String(b);
};

const isCouncilMember = (work, userId) =>
  Array.isArray(work.councilMembers) &&
  work.councilMembers.some((m) => sameId(m, userId));

const canReadWork = (work, user) =>
  isGlobalScope(user) ||
  sameId(work.researcher, user._id) ||
  sameId(work.secretary, user._id) ||
  isCouncilMember(work, user._id);

const canWriteWork = (work, user) =>
  isGlobalScope(user) ||
  sameId(work.researcher, user._id) ||
  sameId(work.secretary, user._id);

const buildWorkReadGuard = (getWorkId) => async (req, res, next) => {
  try {
    if (!req.user) {
      return next(
        new ErrorHandler(
          500,
          "requireWorkReadAccess: req.user topilmadi — authenticate middleware chaqirilganmi?",
        ),
      );
    }

    const workId = getWorkId(req);
    if (!workId) {
      return next(new ErrorHandler(400, "Ilmiy ish id'si ko'rsatilmagan"));
    }

    const work = await ScientificWork.findById(workId).exec();
    if (!work) return next(new ErrorHandler(404, "Ilmiy ish topilmadi"));

    if (!canReadWork(work, req.user)) {
      return next(
        new ErrorHandler(403, "Bu ilmiy ishni ko'rishga ruxsatingiz yo'q"),
      );
    }

    req.work = work;
    return next();
  } catch (err) {
    return next(
      new ErrorHandler(
        400,
        "Ilmiy ishga kirishni tekshirishda xatolik",
        err.message,
      ),
    );
  }
};

const requireWorkReadAccess = (paramName) =>
  buildWorkReadGuard((req) => req.params[paramName]);

const requireWorkReadAccessFromBody = (field) =>
  buildWorkReadGuard((req) => (req.body || {})[field]);

module.exports = {
  canReadWork,
  canWriteWork,
  requireWorkReadAccess,
  requireWorkReadAccessFromBody,
  isGlobalScope,
  sameId,
};
