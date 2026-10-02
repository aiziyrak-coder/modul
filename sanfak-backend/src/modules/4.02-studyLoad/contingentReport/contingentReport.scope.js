"use strict";

const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { resolveUserFacultyId } = require("#shared/userScope");

const contingentReportScope = () => (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(
        new ErrorHandler(
          500,
          "contingentReportScope: req.user topilmadi — authenticate middleware chaqirilganmi?",
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
    if (scopeLevel === "faculty") {
      const faculty = resolveUserFacultyId(user);
      if (!faculty) {
        return next(
          new ErrorHandler(
            403,
            "Foydalanuvchi fakulteti aniqlanmadi. Fakultet yoki kafedra biriktirilmagan.",
          ),
        );
      }
      req.scope = { faculty };
      return next();
    }
    return next(
      new ErrorHandler(
        403,
        "Kontingent hisoboti faqat fakultet yoki institut darajasidagi rollarga ochiq",
      ),
    );
  } catch (err) {
    winston.error(`contingentReportScope xatosi: ${err.message}`);
    return next(new ErrorHandler(500, "Scope tekshirish xatosi", err.message));
  }
};

module.exports = contingentReportScope;
