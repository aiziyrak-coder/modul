const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  resolveFacultyDirectionIds,
} = require("#modules/4.02-studyLoad/_shared/scopeHelpers");

const parentDirectionScope = (options = {}) => {
  const { parentModel, parentRefField, bypassRoles = [] } = options;

  if (!parentModel || !parentRefField) {
    throw new Error(
      "parentDirectionScope: 'parentModel' va 'parentRefField' options majburiy",
    );
  }

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return next(
          new ErrorHandler(
            500,
            "parentDirectionScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
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

          const parents = await parentModel
            .find({ direction: { $in: directionIds } })
            .select("_id")
            .lean();

          req.scope = {
            [parentRefField]: { $in: parents.map((p) => p._id) },
          };
          return next();
        }

        case "self":
        default: {
          req.scope = { _id: { $in: [] } };
          return next();
        }
      }
    } catch (err) {
      winston.error(`parentDirectionScope xatosi: ${err.message}`);
      return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
    }
  };
};

function narrowParentFilter(scope = {}, parentRefField, queryValue) {
  if (!queryValue) return { ...scope };

  const allowed = scope[parentRefField];

  if (allowed === undefined) {
    return { ...scope, [parentRefField]: queryValue };
  }

  if (allowed && Array.isArray(allowed.$in)) {
    const permitted = allowed.$in.some((id) => String(id) === String(queryValue));
    return permitted
      ? { ...scope, [parentRefField]: queryValue }
      : { ...scope, [parentRefField]: { $in: [] } };
  }

  return String(allowed) === String(queryValue)
    ? { ...scope, [parentRefField]: queryValue }
    : { ...scope, [parentRefField]: { $in: [] } };
}

module.exports = parentDirectionScope;
module.exports.narrowParentFilter = narrowParentFilter;
