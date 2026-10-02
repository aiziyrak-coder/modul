const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  resolveDepartmentMemberIds,
  resolveFacultyMemberIds,
} = require("#modules/4.02-studyLoad/_shared/scopeHelpers");
const { ROLES } = require("#config/constants");
const { resolveAssignedScienceIds } = require("./scienceProgram.assignedSciences");

const scienceProgramScope = (options = {}) => {
  const { bypassRoles = [] } = options;

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(
          new ErrorHandler(
            500,
            "scienceProgramScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
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
          const memberIds = await resolveDepartmentMemberIds(user);
          if (memberIds === null) {
            return next(
              new ErrorHandler(
                403,
                "Foydalanuvchi kafedrasi aniqlanmadi. Department biriktirilmagan.",
              ),
            );
          }

          req.scope = { user: { $in: memberIds } };
          return next();
        }

        case "faculty": {
          const memberIds = await resolveFacultyMemberIds(user);
          if (memberIds === null) {
            return next(
              new ErrorHandler(
                403,
                "Foydalanuvchi fakulteti aniqlanmadi. Department yoki faculty biriktirilmagan.",
              ),
            );
          }

          req.scope = { user: { $in: memberIds } };
          return next();
        }

        case "self":
        default: {
          if (req.method === "GET" && roleTitle === ROLES.OQITUVCHI) {
            const scienceIds = await resolveAssignedScienceIds(user._id);
            if (scienceIds.length) {
              req.scope = {
                $or: [
                  { user: user._id },
                  { status: "approved", science: { $in: scienceIds } },
                ],
              };
              return next();
            }
          }
          req.scope = { user: user._id };
          return next();
        }
      }
    } catch (err) {
      winston.error(`scienceProgramScope xatosi: ${err.message}`);
      return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
    }
  };
};

function narrowUserFilter(scope = {}, userQuery) {
  if (!userQuery) return { ...scope };

  const allowed = scope.user;

  if (allowed === undefined) return { ...scope, user: userQuery };

  if (allowed && Array.isArray(allowed.$in)) {
    const permitted = allowed.$in.some(
      (id) => String(id) === String(userQuery),
    );
    return permitted
      ? { ...scope, user: userQuery }
      : { ...scope, user: { $in: [] } };
  }

  return String(allowed) === String(userQuery)
    ? { ...scope, user: userQuery }
    : { ...scope, user: { $in: [] } };
}

module.exports = scienceProgramScope;
module.exports.narrowUserFilter = narrowUserFilter;
