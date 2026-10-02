const winston = require("#shared/winston.logger");
const {
  dispatch,
  dispatchMany,
} = require("#system/notification/notificationDispatcher");
const { ROLES } = require("#config/constants");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const Position = require("#references/position/position.model");
const AcademicTitle = require("#references/academicTitle/academicTitle.model");
const CouncilMember = require("#modules/4.09-instituteCouncil/councilMember/councilMember.model");

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

const NOTIFY_TIMEOUT_MS = 3000;

const TIMED_OUT = Symbol("councilNotify.timeout");

const withTimeout = (promise) => {
  let timer;
  const guard = new Promise((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), NOTIFY_TIMEOUT_MS);
    timer?.unref?.();
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
};

const safeDispatch = async (payload) => {
  try {
    const result = await withTimeout(dispatch(payload));
    if (result === TIMED_OUT) {
      winston.warn(
        `[councilNotify] dispatch ${NOTIFY_TIMEOUT_MS}ms ichida tugamadi ` +
          `(${payload?.eventType || "?"}) — asosiy oqim davom etdi. ` +
          `Sabab odatda: Redis o'chiq (socket emit navbatda kutmoqda).`,
      );
      return null;
    }
    return result;
  } catch (err) {
    winston.warn(
      `[councilNotify] dispatch xato (${payload?.eventType || "?"}): ${err.message}`,
    );
    return null;
  }
};

const safeDispatchMany = async (payload) => {
  try {
    if (!Array.isArray(payload?.userIds) || payload.userIds.length === 0) {
      return { total: 0, success: 0, failed: 0 };
    }
    const result = await withTimeout(dispatchMany(payload));
    if (result === TIMED_OUT) {
      winston.warn(
        `[councilNotify] dispatchMany ${NOTIFY_TIMEOUT_MS}ms ichida tugamadi ` +
          `(${payload?.eventType || "?"}, ${payload.userIds.length} ta qabul qiluvchi) — ` +
          `asosiy oqim davom etdi. Sabab odatda: Redis o'chiq.`,
      );
      return null;
    }
    return result;
  } catch (err) {
    winston.warn(
      `[councilNotify] dispatchMany xato (${payload?.eventType || "?"}): ${err.message}`,
    );
    return null;
  }
};

const dispatchInBackground = (payload) => {
  safeDispatch(payload).catch((err) =>
    winston.warn(
      `[councilNotify] fon dispatch xato (${payload?.eventType || "?"}): ${err.message}`,
    ),
  );
};

const dispatchManyInBackground = (payload) => {
  safeDispatchMany(payload).catch((err) =>
    winston.warn(
      `[councilNotify] fon dispatchMany xato (${payload?.eventType || "?"}): ${err.message}`,
    ),
  );
};

const getKotibUserIds = async () => {
  try {
    const roleDoc = await Role.findOne({
      title: ROLES.ILMIY_KENGASH_KOTIBI,
      active: true,
    })
      .select("_id")
      .lean();
    if (!roleDoc) return [];

    const users = await User.find({ role: roleDoc._id, active: true })
      .select("_id")
      .lean();
    return uniqueIds(users.map((u) => u._id));
  } catch (err) {
    winston.warn(`[councilNotify] getKotibUserIds xato: ${err.message}`);
    return [];
  }
};

const getVoterUserIds = async () => {
  try {
    const members = await CouncilMember.find({ canVote: true, active: true })
      .select("user")
      .lean();
    return uniqueIds(members.map((m) => m.user));
  } catch (err) {
    winston.warn(`[councilNotify] getVoterUserIds xato: ${err.message}`);
    return [];
  }
};

const getMemberUserIds = async () => {
  try {
    const members = await CouncilMember.find({ active: true })
      .select("user")
      .lean();
    return uniqueIds(members.map((m) => m.user));
  } catch (err) {
    winston.warn(`[councilNotify] getMemberUserIds xato: ${err.message}`);
    return [];
  }
};

const getDeptHeadUserIds = async () => {
  const roleDoc = await Role.findOne({
    title: ROLES.KAFEDRA_MUDIRI,
    active: true,
  })
    .select("_id")
    .lean();

  if (roleDoc) {
    const users = await User.find({ role: roleDoc._id, active: true })
      .select("_id")
      .lean();
    if (users.length > 0) return uniqueIds(users.map((u) => u._id));
  }

  const positions = await Position.find({ title: /mudir/i, active: true })
    .select("_id")
    .lean();
  if (positions.length === 0) return [];

  const users = await User.find({
    position: { $in: positions.map((p) => p._id) },
    active: true,
  })
    .select("_id")
    .lean();
  return uniqueIds(users.map((u) => u._id));
};

const getMembersByAcademicTitle = async (titleRx) => {
  const titles = await AcademicTitle.find({ title: titleRx })
    .select("_id")
    .lean();
  if (titles.length === 0) {
    winston.warn(
      `[councilNotify] ${titleRx} unvoni ma'lumotnomada topilmadi — e'lon qabul qiluvchilari bo'sh`,
    );
    return [];
  }

  const users = await User.find({
    academicTitle: { $in: titles.map((t) => t._id) },
  })
    .select("_id")
    .lean();
  if (users.length === 0) return [];

  const members = await CouncilMember.find({
    active: true,
    user: { $in: users.map((u) => u._id) },
  })
    .select("user")
    .lean();
  return uniqueIds(members.map((m) => m.user));
};

const getAllTeacherUserIds = async () => {
  const roleIds = await Role.find({
    title: { $regex: /o['’‘ʻ`]?qituvchi/i },
    active: true,
  })
    .select("_id")
    .lean();
  const teachers = roleIds.length
    ? await User.find({ role: { $in: roleIds.map((r) => r._id) }, active: true })
        .select("_id")
        .lean()
    : [];
  const members = await getMemberUserIds();
  return uniqueIds([...teachers.map((u) => u._id), ...members]);
};

const getAnnouncementRecipients = async (recipientGroup) => {
  try {
    switch (recipientGroup) {
      case "all":
        return await getAllTeacherUserIds();
      case "professors":
        return await getMembersByAcademicTitle(/professor/i);
      case "dotsents":
        return await getMembersByAcademicTitle(/dotsent/i);
      case "deptHeads":
        return await getDeptHeadUserIds();
      default:
        winston.warn(
          `[councilNotify] noma'lum recipientGroup: ${recipientGroup}`,
        );
        return [];
    }
  } catch (err) {
    winston.warn(
      `[councilNotify] getAnnouncementRecipients xato (${recipientGroup}): ${err.message}`,
    );
    return [];
  }
};

module.exports = {
  safeDispatch,
  safeDispatchMany,
  dispatchInBackground,
  dispatchManyInBackground,
  getKotibUserIds,
  getVoterUserIds,
  getMemberUserIds,
  getAnnouncementRecipients,
};
