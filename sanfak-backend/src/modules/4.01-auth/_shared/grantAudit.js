const winston = require("#shared/winston.logger");
const AuditLogModel = require("#modules/4.01-auth/auditLog/auditLog.model");

const toKeySet = (permissions = []) => {
  const set = new Set();
  (permissions || []).forEach((p) => {
    if (!p || !p.section) return;
    (p.actionKeys || []).forEach((a) => set.add(`${p.section}:${a}`));
  });
  return set;
};

const logGrantChange = async ({ req, roleId, before, after, action }) => {
  try {
    const oldKeys = toKeySet(before?.permissions);
    const newKeys = toKeySet(after?.permissions);

    const addedKeys = [...newKeys].filter((k) => !oldKeys.has(k));
    const removedKeys = [...oldKeys].filter((k) => !newKeys.has(k));

    const metaChanged =
      (before &&
        (before.scopeLevel !== after?.scopeLevel ||
          before.active !== after?.active ||
          before.title !== after?.title)) ||
      !before;

    if (!addedKeys.length && !removedKeys.length && !metaChanged) return;

    await AuditLogModel.create({
      user: req?.user?._id,
      userName: req?.user?.fullName || req?.user?.firstName || undefined,
      action,
      module: "role",
      method: req?.method,
      path: req?.originalUrl,
      targetId: String(roleId || "").toLowerCase(),
      ip: req?.ip,
      userAgent: req?.headers?.["user-agent"],
      requestBody: {
        kind: "rbacGrantDiff",
        roleTitle: after?.title ?? before?.title,
        addedKeys,
        removedKeys,
        addedCount: addedKeys.length,
        removedCount: removedKeys.length,
        scopeLevelBefore: before?.scopeLevel,
        scopeLevelAfter: after?.scopeLevel,
        activeBefore: before?.active,
        activeAfter: after?.active,
        titleBefore: before?.title,
        titleAfter: after?.title,
      },
    });
  } catch (err) {
    winston.error(`grantAudit yozilmadi (roleId=${roleId}): ${err.message}`);
  }
};

module.exports = { logGrantChange, toKeySet };
