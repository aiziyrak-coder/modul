const { ErrorHandler } = require("#shared/error");
const { ROLES } = require("#config/constants");
const { resolveUserFacultyId } = require("#shared/userScope");

const GLOBAL_ROLES = new Set([
  ROLES.ILMIY_BOLIM,
  ROLES.PROREKTOR,
  ROLES.REKTOR,
  ROLES.ILMIY_KENGASH_KOTIBI,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
]);

const scopeForRole = (user = {}) => {
  const role = user.role && user.role.title;
  if (GLOBAL_ROLES.has(role)) return {};
  if (role === ROLES.OQITUVCHI) return { author: user._id };
  const deptId = (user.department && (user.department._id || user.department)) || null;
  const facultyId = resolveUserFacultyId(user);
  if (role === ROLES.KAFEDRA_MUDIRI) return deptId ? { department: deptId } : { _id: null };
  if (role === ROLES.DEKAN) return facultyId ? { faculty: facultyId } : { _id: null };
  return { author: user._id };
};

const articleScope = (req, res, next) => {
  if (!req.user) {
    return next(
      new ErrorHandler(500, "articleScope: req.user topilmadi — authenticate chaqirilganmi?"),
    );
  }
  req.scope = scopeForRole(req.user);
  return next();
};

module.exports = { articleScope, scopeForRole, GLOBAL_ROLES };
