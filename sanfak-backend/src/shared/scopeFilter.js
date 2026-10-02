const { ErrorHandler } = require("./error");
const { resolveUserFacultyId } = require("./userScope");

const scopeFilter = (scopeField = "department", options = {}) => {
  const { bypassRoles = [] } = options;

  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return next(
          new ErrorHandler(500, "scopeFilter: req.user topilmadi — authenticate middleware chaqirilganmi?"),
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

        case "faculty": {
          const faculty = resolveUserFacultyId(user);
          if (!faculty) {
            return next(
              new ErrorHandler(403, "Foydalanuvchi fakulteti aniqlanmadi. Department yoki faculty biriktirilmagan."),
            );
          }

          if (scopeField === "user") {
            req.scope = { user: user._id };
          } else {
            req.scope = { faculty: faculty };
          }
          return next();
        }

        case "department": {
          const department = user.department?._id || user.department || null;
          if (!department) {
            return next(
              new ErrorHandler(403, "Foydalanuvchi kafedrasi aniqlanmadi. Department biriktirilmagan."),
            );
          }

          if (scopeField === "user") {
            req.scope = { user: user._id };
          } else if (scopeField === "faculty") {
            const faculty = user.department?.faculty || null;
            if (!faculty) {
              return next(
                new ErrorHandler(403, "Foydalanuvchi fakulteti aniqlanmadi."),
              );
            }
            req.scope = { faculty: faculty };
          } else {
            req.scope = { department: department };
          }
          return next();
        }

        case "self":
        default: {
          req.scope = { user: user._id };
          return next();
        }
      }
    } catch (err) {
      return next(
        new ErrorHandler(500, "Scope tekshirish xatosi", err.message),
      );
    }
  };
};

module.exports = scopeFilter;
