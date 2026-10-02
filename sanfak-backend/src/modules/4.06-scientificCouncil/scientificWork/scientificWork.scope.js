const { ErrorHandler } = require("#shared/error");

const scientificWorkScope = async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return next(
      new ErrorHandler(
        500,
        "scientificWorkScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
      ),
    );
  }

  const role = user.role;
  if (!role) {
    return next(new ErrorHandler(403, "Foydalanuvchiga rol biriktirilmagan"));
  }

  const scopeLevel = role.scopeLevel || "self";

  if (scopeLevel === "global") {
    req.scope = {};
    return next();
  }

  req.scope = {
    $or: [{ researcher: user._id }, { councilMembers: user._id }],
  };
  return next();
};

function narrowMemberFilter(scope = {}, memberIdQuery) {
  if (!memberIdQuery) return { ...scope };

  if (!Array.isArray(scope.$or)) {
    return { ...scope, councilMembers: memberIdQuery };
  }

  const ownId = scope.$or[0] && scope.$or[0].researcher;

  if (String(ownId) === String(memberIdQuery)) {
    return { ...scope, councilMembers: memberIdQuery };
  }

  return { councilMembers: { $in: [] } };
}

module.exports = scientificWorkScope;
module.exports.narrowMemberFilter = narrowMemberFilter;
