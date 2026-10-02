const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  resolveFacultyDirectionIds,
} = require("#modules/4.02-studyLoad/_shared/scopeHelpers");

const workingScheduleScope = (options = {}) => {
  const { bypassRoles = [] } = options;

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(
          new ErrorHandler(
            500,
            "workingScheduleScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
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

        case "faculty":
        case "department": {
          const directionIds = await resolveFacultyDirectionIds(user);
          if (directionIds === null) {
            return next(
              new ErrorHandler(
                403,
                "Foydalanuvchi fakulteti aniqlanmadi. Department yoki faculty biriktirilmagan.",
              ),
            );
          }

          req.scope = { direction: { $in: directionIds } };
          return next();
        }

        case "self":
        default: {
          req.scope = { _id: { $in: [] } };
          return next();
        }
      }
    } catch (err) {
      winston.error(`workingScheduleScope xatosi: ${err.message}`);
      return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
    }
  };
};

function narrowDirectionFilter(scope = {}, directionQuery) {
  if (!directionQuery) return { ...scope };

  const allowed = scope.direction;

  if (allowed === undefined) return { ...scope, direction: directionQuery };

  if (allowed && Array.isArray(allowed.$in)) {
    const permitted = allowed.$in.some(
      (id) => String(id) === String(directionQuery),
    );
    return permitted
      ? { ...scope, direction: directionQuery }
      : { ...scope, direction: { $in: [] } };
  }

  return String(allowed) === String(directionQuery)
    ? { ...scope, direction: directionQuery }
    : { ...scope, direction: { $in: [] } };
}

module.exports = workingScheduleScope;
module.exports.narrowDirectionFilter = narrowDirectionFilter;
