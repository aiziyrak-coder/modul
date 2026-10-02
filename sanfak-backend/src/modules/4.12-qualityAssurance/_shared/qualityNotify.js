const winston = require("#shared/winston.logger");
const {
  dispatch,
  dispatchMany,
} = require("#system/notification/notificationDispatcher");
const { ROLES } = require("#config/constants");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");

const uniqueIds = (ids) => {
  const seen = new Set();
  const result = [];
  for (const id of ids) {
    if (!id) continue;
    const key = id.toString();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(id);
    }
  }
  return result;
};

const safeDispatch = async (payload) => {
  try {
    return await dispatch(payload);
  } catch (err) {
    winston.warn(
      `[qualityNotify] dispatch xato (${payload?.eventType || "?"}): ${err.message}`,
    );
    return null;
  }
};

const safeDispatchMany = async (payload) => {
  try {
    if (!Array.isArray(payload?.userIds) || payload.userIds.length === 0) {
      return { total: 0, success: 0, failed: 0 };
    }
    return await dispatchMany(payload);
  } catch (err) {
    winston.warn(
      `[qualityNotify] dispatchMany xato (${payload?.eventType || "?"}): ${err.message}`,
    );
    return null;
  }
};

const getSifatBolimiUserIds = async () => {
  try {
    const roleDocs = await Role.find({
      title: { $in: [ROLES.TALIM_SIFATI_NAZORATI, ROLES.SIFAT_BOLIMI] },
      active: true,
    })
      .select("_id")
      .lean();
    if (!roleDocs.length) return [];

    const users = await User.find({
      role: { $in: roleDocs.map((r) => r._id) },
      active: true,
    })
      .select("_id")
      .lean();
    return uniqueIds(users.map((u) => u._id));
  } catch (err) {
    winston.warn(`[qualityNotify] getSifatBolimiUserIds xato: ${err.message}`);
    return [];
  }
};

module.exports = {
  safeDispatch,
  safeDispatchMany,
  getSifatBolimiUserIds,
};
