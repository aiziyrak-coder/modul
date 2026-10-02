const { ErrorHandler } = require("./error");
const winston = require("./winston.logger");
const { ROLES, MODULES, ACTIONS } = require("../config/constants");

const METHOD_ACTION_MAP = {
  POST: ACTIONS.CREATE,
  GET: ACTIONS.READ_ALL,
  PUT: ACTIONS.UPDATE,
  PATCH: ACTIONS.UPDATE,
  DELETE: ACTIONS.DELETE,
};

const CANONICAL_MODULE_SET = new Set(Object.values(MODULES));

const permit = (moduleName, actions) => {
  if (!moduleName) {
    throw new Error("permit(): moduleName argumenti talab qilinadi");
  }
  if (!CANONICAL_MODULE_SET.has(moduleName)) {
    winston.warn(
      `[RBAC] permit() kanonik bo'lmagan modul nomi bilan chaqirildi: "${moduleName}". ` +
        `constants.MODULES dan foydalaning.`,
    );
  }

  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        winston.error(
          `[RBAC] req.user yo'q — authenticate middleware avval chaqirilmaganmi? ` +
            `Path: ${req.method} ${req.originalUrl}`,
        );
        return next(
          new ErrorHandler(
            500,
            "Server konfiguratsiyasi xatosi: autentifikatsiya o'rnatilmagan",
          ),
        );
      }

      if (!user.role) {
        return next(
          new ErrorHandler(403, "Foydalanuvchiga rol biriktirilmagan", "", {
            reason: "no_role",
          }),
        );
      }

      if (user.role.active === false) {
        return next(
          new ErrorHandler(403, "Foydalanuvchi roli bloklangan", "", {
            reason: "role_blocked",
          }),
        );
      }

      if (user.role.title === ROLES.SUPER_ADMIN) {
        return next();
      }

      let resolvedActions = Array.isArray(actions) ? [...actions] : [];

      if (resolvedActions.length === 0) {
        let action = METHOD_ACTION_MAP[req.method];
        if (
          req.method === "GET" &&
          req.params &&
          Object.keys(req.params).length > 0
        ) {
          action = ACTIONS.READ;
        }
        resolvedActions = action ? [action] : [];
      }

      if (resolvedActions.length === 0) {
        return next(
          new ErrorHandler(403, "Action aniqlanmadi", "", {
            reason: "action_unresolved",
          }),
        );
      }

      const rolePerm = (user.role.permissions || []).find(
        (perm) => perm.section === moduleName,
      );

      if (!rolePerm) {
        return next(
          new ErrorHandler(
            403,
            `"${moduleName}" modulida ruxsat berilmagan`,
            "",
            {
              reason: "missing_permission",
              requiredPermission: `${moduleName}:${resolvedActions[0]}`,
              requiredAnyOf: resolvedActions.map((a) => `${moduleName}:${a}`),
            },
          ),
        );
      }

      const hasPermission = resolvedActions.some((action) =>
        (rolePerm.actionKeys || []).includes(action),
      );

      if (!hasPermission) {
        return next(
          new ErrorHandler(
            403,
            `"${moduleName}" moduli uchun "${resolvedActions.join(
              ", ",
            )}" amali ruxsat etilmagan`,
            "",
            {
              reason: "missing_permission",
              requiredPermission: `${moduleName}:${resolvedActions[0]}`,
              requiredAnyOf: resolvedActions.map((a) => `${moduleName}:${a}`),
            },
          ),
        );
      }

      return next();
    } catch (err) {
      return next(
        new ErrorHandler(500, "Ruxsat tekshirish xatosi", err.message),
      );
    }
  };
};

module.exports = permit;
