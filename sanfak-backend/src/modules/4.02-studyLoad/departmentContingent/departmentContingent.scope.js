"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const {
  resolveFacultyDepartmentIds,
} = require("#modules/4.02-studyLoad/_shared/scopeHelpers");

const forbidden = (message) => new ErrorHandler(403, message);

async function scopeFor(user) {
  const scopeLevel = user.role.scopeLevel || "self";
  if (scopeLevel === "global") return {};
  if (scopeLevel === "department") {
    const department = user.department?._id || user.department || null;
    if (!department) throw forbidden("Foydalanuvchi kafedrasi aniqlanmadi. Kafedra biriktirilmagan.");
    return { department };
  }
  if (scopeLevel === "faculty") {
    const departmentIds = await resolveFacultyDepartmentIds(user);
    return { department: { $in: departmentIds || [] } };
  }
  throw forbidden("Kafedra kontingenti faqat kafedra yoki institut darajasidagi rollarga ochiq");
}

const departmentContingentScope = () => async (req, res, next) => {
  try {
    if (!req.user) {
      return next(
        new ErrorHandler(500, "departmentContingentScope: req.user topilmadi — authenticate chaqirilganmi?"),
      );
    }
    if (!req.user.role) return next(forbidden("Foydalanuvchiga rol biriktirilmagan"));
    req.scope = await scopeFor(req.user);
    return next();
  } catch (err) {
    if (err.statusCode) return next(err);
    winston.error(`departmentContingentScope xatosi: ${err.message}`);
    return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
  }
};

module.exports = departmentContingentScope;
module.exports.scopeFor = scopeFor;
