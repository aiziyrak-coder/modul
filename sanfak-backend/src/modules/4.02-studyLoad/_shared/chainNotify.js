const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { ROLES } = require("#config/constants");
const User = require("#modules/4.01-auth/user/user.model");

const safeDispatch = async (payload) => {
  try {
    return await dispatch(payload);
  } catch (err) {
    winston.warn(
      `[chainNotify] dispatch xato (${payload?.eventType || "?"}): ${err.message}`,
    );
    return null;
  }
};

const safeDispatchMany = async (userIds, payload) => {
  const ids = (userIds || []).filter(Boolean);
  if (ids.length === 0) return;
  await Promise.all(ids.map((userId) => safeDispatch({ ...payload, userId })));
};

const getDepartmentHeadUserIds = async (departmentId) => {
  if (!departmentId) return [];
  try {
    const users = await User.find({ department: departmentId, active: true })
      .populate("role")
      .select("role")
      .lean();
    return users
      .filter((u) => u.role?.title === ROLES.KAFEDRA_MUDIRI)
      .map((u) => u._id);
  } catch (err) {
    winston.warn(`[chainNotify] getDepartmentHeadUserIds xato: ${err.message}`);
    return [];
  }
};

module.exports = { safeDispatch, safeDispatchMany, getDepartmentHeadUserIds };
