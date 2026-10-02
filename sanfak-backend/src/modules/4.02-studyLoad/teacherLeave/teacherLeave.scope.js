const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { resolveUserFacultyId } = require("#shared/userScope");
const User = require("#modules/4.01-auth/user/user.model");
const Department = require("#references/department/department.model");

const teacherLeaveScope = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(
        new ErrorHandler(
          500,
          "teacherLeaveScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
        ),
      );
    }

    const role = user.role;
    if (!role) {
      return next(new ErrorHandler(403, "Foydalanuvchiga rol biriktirilmagan"));
    }

    const scopeLevel = role.scopeLevel || "self";

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

        const members = await User.find({ department, active: true })
          .select("_id")
          .lean();
        req.scope = { teacher: { $in: members.map((m) => m._id) } };
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

        const departments = await Department.find({ faculty, active: true })
          .select("_id")
          .lean();
        const departmentIds = departments.map((d) => d._id);

        const members = await User.find({
          department: { $in: departmentIds },
          active: true,
        })
          .select("_id")
          .lean();
        req.scope = { teacher: { $in: members.map((m) => m._id) } };
        return next();
      }

      case "self":
      default: {
        req.scope = { teacher: user._id };
        return next();
      }
    }
  } catch (err) {
    winston.error(`teacherLeaveScope xatosi: ${err.message}`);
    return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
  }
};

function narrowTeacherFilter(scope = {}, teacherQuery) {
  if (!teacherQuery) return { ...scope };

  const allowed = scope.teacher;

  if (allowed === undefined) return { ...scope, teacher: teacherQuery };

  if (allowed && Array.isArray(allowed.$in)) {
    const permitted = allowed.$in.some(
      (id) => String(id) === String(teacherQuery),
    );
    return permitted
      ? { ...scope, teacher: teacherQuery }
      : { ...scope, teacher: { $in: [] } };
  }

  return String(allowed) === String(teacherQuery)
    ? { ...scope, teacher: teacherQuery }
    : { ...scope, teacher: { $in: [] } };
}

module.exports = teacherLeaveScope;
module.exports.narrowTeacherFilter = narrowTeacherFilter;
