const winston = require("./winston.logger");
const { MODULES } = require("../config/constants");
const PermissionModel = require("#modules/4.01-auth/permission/permission.model");

const startupRbacCheck = async () => {
  try {
    const canonicalSections = Object.values(MODULES);
    const dbPermissions = await PermissionModel.find({}, { section: 1 });
    const dbSections = new Set(dbPermissions.map((p) => p.section));

    const missingInDb = canonicalSections.filter((s) => !dbSections.has(s));
    const extraInDb = [...dbSections].filter(
      (s) => !canonicalSections.includes(s),
    );

    if (missingInDb.length === 0 && extraInDb.length === 0) {
      winston.info(
        `[RBAC] Integrity OK — ${canonicalSections.length} ta section DB bilan mos`,
      );
      return true;
    }

    if (missingInDb.length > 0) {
      winston.warn(
        `[RBAC] DBda yo'q bo'lgan kanonik sectionlar (${missingInDb.length}): ` +
          missingInDb.join(", "),
      );
      winston.warn(`[RBAC] \`npm run seed\` ishga tushiring`);
    }
    if (extraInDb.length > 0) {
      winston.warn(
        `[RBAC] DBda qo'shimcha sectionlar (${extraInDb.length}) — eski yoki qo'l bilan qo'shilgan: ` +
          extraInDb.join(", "),
      );
    }

    if (process.env.STRICT_RBAC === "true") {
      winston.error("[RBAC] STRICT_RBAC yoqilgan, server ishga tushmaydi");
      process.exit(1);
    }

    return false;
  } catch (err) {
    winston.error(`[RBAC] Startup check xatosi: ${err.message}`);
    if (process.env.STRICT_RBAC === "true") {
      process.exit(1);
    }
    return false;
  }
};

module.exports = startupRbacCheck;
