const { ErrorHandler } = require("#shared/error");
const scopeFilter = require("#shared/scopeFilter");
const GiftedStudentModel = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const { roleMatches } = require("./roleEligibility");
const { ADVISOR, isAdvisor } = require("./moduleRoles");

const SCOPE_FIELD_MAP = {
  faculty: "facultyId",
  user: "user",
};

const advisorScope = (user) => ({ advisorId: String(user._id) });

const translateScope = (scope) => {
  if (!scope || Object.keys(scope).length === 0) return {};

  const out = {};
  for (const [key, value] of Object.entries(scope)) {
    const field = SCOPE_FIELD_MAP[key];
    if (!field) {
      throw new ErrorHandler(
        403,
        `Ko'rish doirasi qo'llab bo'lmadi: "${key}" — iqtidorli talabalar ro'yxatida bunday o'lcham yo'q.`,
      );
    }
    if (!GiftedStudentModel.schema.path(field)) {
      throw new ErrorHandler(
        500,
        `Ko'rish doirasi sozlanmagan: "${field}" maydoni giftedStudent sxemasida yo'q.`,
      );
    }
    out[field] = value;
  }
  return out;
};

const scopeOrBypass = (scopeField, bypassProfile) => {
  const inner = scopeFilter(scopeField);

  return (req, res, next) => {
    if (roleMatches(req.user?.role, bypassProfile.required, bypassProfile)) {
      req.scope = {};
      return next();
    }

    if (isAdvisor(req.user?.role)) {
      req.scope = advisorScope(req.user);
      return next();
    }
    return inner(req, res, (err) => {
      if (err) return next(err);
      try {
        req.scope = translateScope(req.scope);
      } catch (e) {
        return next(e);
      }
      return next();
    });
  };
};

module.exports = { scopeOrBypass, translateScope, SCOPE_FIELD_MAP, advisorScope, ADVISOR };
