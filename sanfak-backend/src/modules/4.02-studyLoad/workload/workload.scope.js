const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { resolveUserFacultyId } = require("#shared/userScope");
const {
  resolveFacultyDepartmentIds,
} = require("#modules/4.02-studyLoad/_shared/scopeHelpers");

const workloadScope = (options = {}) => {
  const { bypassRoles = [] } = options;

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(
          new ErrorHandler(
            500,
            "workloadScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
          ),
        );
      }

      const role = user.role;
      if (!role) {
        return next(new ErrorHandler(403, "Foydalanuvchiga rol biriktirilmagan"));
      }

      const roleTitle = role.title;
      const scopeLevel = role.scopeLevel || "self";

      if (bypassRoles.includes(roleTitle)) {
        req.scope = {};
        return next();
      }

      switch (scopeLevel) {
        case "global": {
          req.scope = {};
          return next();
        }

        case "department": {
          const department = user.department?._id || user.department || null;
          if (!department) {
            return next(
              new ErrorHandler(
                403,
                "Foydalanuvchi kafedrasi aniqlanmadi. Department biriktirilmagan.",
              ),
            );
          }

          req.scope = { department };
          return next();
        }

        case "faculty": {
          const faculty = resolveUserFacultyId(user);
          if (!faculty) {
            return next(
              new ErrorHandler(
                403,
                "Foydalanuvchi fakulteti aniqlanmadi. Department yoki faculty biriktirilmagan.",
              ),
            );
          }

          const departmentIds = await resolveFacultyDepartmentIds(user);
          req.scope = { department: { $in: departmentIds || [] } };
          return next();
        }

        case "self":
        default: {
          req.scope = { _id: { $in: [] } };
          return next();
        }
      }
    } catch (err) {
      winston.error(`workloadScope xatosi: ${err.message}`);
      return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
    }
  };
};

module.exports = workloadScope;
