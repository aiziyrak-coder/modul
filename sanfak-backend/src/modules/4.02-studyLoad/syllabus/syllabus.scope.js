const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { resolveUserFacultyId } = require("#shared/userScope");
const {
  resolveDepartmentMemberIds,
} = require("#modules/4.02-studyLoad/_shared/scopeHelpers");

const syllabusScope = (options = {}) => {
  const { bypassRoles = [] } = options;

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(
          new ErrorHandler(
            500,
            "syllabusScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
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

          req.scope = { "author.teacher": { $in: memberIds } };
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

          req.scope = { faculty };
          return next();
        }

        case "self":
        default: {
          req.scope = { "author.teacher": user._id };
          return next();
        }
      }
    } catch (err) {
      winston.error(`syllabusScope xatosi: ${err.message}`);
      return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
    }
  };
};

function narrowTeacherFilter(scope = {}, teacherQuery) {
  if (!teacherQuery) return { ...scope };

  if (scope.faculty !== undefined) {
    return { ...scope, "author.teacher": teacherQuery };
  }

  const allowed = scope["author.teacher"];

  if (allowed === undefined) return { ...scope, "author.teacher": teacherQuery };

  if (allowed && Array.isArray(allowed.$in)) {
    const permitted = allowed.$in.some(
      (id) => String(id) === String(teacherQuery),
    );
    return permitted
      ? { ...scope, "author.teacher": teacherQuery }
      : { ...scope, "author.teacher": { $in: [] } };
  }

  return String(allowed) === String(teacherQuery)
    ? { ...scope, "author.teacher": teacherQuery }
    : { ...scope, "author.teacher": { $in: [] } };
}

module.exports = syllabusScope;
module.exports.narrowTeacherFilter = narrowTeacherFilter;
