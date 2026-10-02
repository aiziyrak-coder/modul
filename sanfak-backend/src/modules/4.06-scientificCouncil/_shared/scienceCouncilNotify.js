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
      `[scienceCouncilNotify] dispatch xato (${payload?.eventType || "?"}): ${err.message}`,
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
      `[scienceCouncilNotify] dispatchMany xato (${payload?.eventType || "?"}): ${err.message}`,
    );
    return null;
  }
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
    winston.warn(`[scienceCouncilNotify] getKotibUserIds xato: ${err.message}`);
    return [];
  }
};

const provisionExternalResearcherAccount = async (work) => {
  try {
    if (work.authorType !== "external") return null;
    if (work.externalAuthor?.provisionedUserId) {
      return work.externalAuthor.provisionedUserId;
    }

    const pinfl = work.externalAuthor?.pinfl;
    if (!pinfl) {
      winston.warn(
        `[scienceCouncilNotify] tashqi tadqiqotchi akkaunti yaratilmadi — PINFL kiritilmagan (workId=${work._id})`,
      );
      return null;
    }

    const existing = await User.findOne({ oneIdPin: pinfl }).select("_id");
    if (existing) return existing._id;

    const roleDoc = await Role.findOne({
      title: ROLES.TASHQI_TADQIQOTCHI,
    }).select("_id");
    if (!roleDoc) {
      winston.warn(
        `[scienceCouncilNotify] "${ROLES.TASHQI_TADQIQOTCHI}" roli DBda topilmadi — seed ishga tushirilmagan (workId=${work._id})`,
      );
      return null;
    }

    const fullName = (work.externalAuthor?.name || "").trim();
    const spaceIdx = fullName.indexOf(" ");
    const firstName = spaceIdx > 0 ? fullName.slice(0, spaceIdx) : fullName || "Tadqiqotchi";
    const lastName = spaceIdx > 0 ? fullName.slice(spaceIdx + 1).trim() : "—";

    const user = await User.create({
      firstName,
      lastName,
      oneIdPin: pinfl,
      role: roleDoc._id,
      active: true,
    });
    return user._id;
  } catch (err) {
    winston.warn(
      `[scienceCouncilNotify] tashqi tadqiqotchi akkaunti yaratishda xato (workId=${work._id}): ${err.message}`,
    );
    return null;
  }
};

module.exports = {
  safeDispatch,
  safeDispatchMany,
  getKotibUserIds,
  provisionExternalResearcherAccount,
};
