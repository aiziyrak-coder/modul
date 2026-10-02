const winston = require("#shared/winston.logger");
const { dispatch } = require("#system/notification/notificationDispatcher");
const User = require("#modules/4.01-auth/user/user.model");
const Role = require("#modules/4.01-auth/role/role.model");
const Department = require("#references/department/department.model");
const AcademicYear = require("#references/academicYear/academicYear.model");
const { ROLE_STEP } = require("./workPlanChain");

function uniqueIds(ids) {
  const seen = new Set();
  const result = [];
  for (const id of ids || []) {
    if (!id) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(id);
  }
  return result;
}

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
  const ids = uniqueIds(userIds);
  if (ids.length === 0) return;
  await Promise.all(ids.map((userId) => safeDispatch({ ...payload, userId })));
};

const STEP_ROLE = Object.fromEntries(
  Object.entries(ROLE_STEP).map(([role, step]) => [step, role]),
);

const STEP_SCOPE = {
  kafedraUslubiy: "department",
  kafedraIlmiy: "department",
  kafedraUstozShogird: "department",
  kafedraMudiri: "department",
  oquvUslubiy: "global",
  dekan: "faculty",
  ichkiNazorat: "global",
};

const resolveOwnerUnit = async (ownerId) => {
  if (!ownerId) return { department: null, faculty: null };
  const user = await User.findById(ownerId).select("department faculty").lean();
  const department = user?.department || null;
  let faculty = user?.faculty || null;
  if (!faculty && department) {
    const dept = await Department.findById(department).select("faculty").lean();
    faculty = dept?.faculty || null;
  }
  return { department, faculty };
};

const findUserIdsByRole = async (roleTitles, extraFilter = {}) => {
  const titles = (roleTitles || []).filter(Boolean);
  if (titles.length === 0) return [];
  const roles = await Role.find({
    title: { $in: titles },
    active: { $ne: false },
  })
    .select("_id")
    .lean();
  if (roles.length === 0) return [];
  const users = await User.find({
    role: { $in: roles.map((r) => r._id) },
    active: true,
    ...extraFilter,
  })
    .select("_id")
    .lean();
  return users.map((u) => u._id);
};

const getRecipients = async ({ roleTitles, level, ownerId } = {}) => {
  try {
    if (level === "global") {
      return uniqueIds(await findUserIdsByRole(roleTitles));
    }

    const { department, faculty } = await resolveOwnerUnit(ownerId);

    if (level === "department") {
      if (!department) return [];
      return uniqueIds(await findUserIdsByRole(roleTitles, { department }));
    }

    if (level === "faculty") {
      if (!faculty) return [];
      const departments = await Department.find({ faculty, active: true })
        .select("_id")
        .lean();
      return uniqueIds(
        await findUserIdsByRole(roleTitles, {
          $or: [
            { faculty },
            { department: { $in: departments.map((d) => d._id) } },
          ],
        }),
      );
    }

    winston.warn(`[chainNotify] noma'lum qabul qiluvchi darajasi: ${level}`);
    return [];
  } catch (err) {
    winston.warn(`[chainNotify] getRecipients xato: ${err.message}`);
    return [];
  }
};

const getRecipientsForSteps = async (steps, ownerId) => {
  const buckets = new Map();
  for (const step of steps || []) {
    const role = STEP_ROLE[step];
    const level = STEP_SCOPE[step];
    if (!role || !level) continue;
    if (!buckets.has(level)) buckets.set(level, []);
    buckets.get(level).push(role);
  }
  if (buckets.size === 0) return [];

  const lists = await Promise.all(
    [...buckets.entries()].map(([level, roleTitles]) =>
      getRecipients({ roleTitles, level, ownerId }),
    ),
  );
  return uniqueIds(lists.flat());
};

const describeOwner = async (ownerId, academicYearId) => {
  try {
    const [user, year] = await Promise.all([
      ownerId
        ? User.findById(ownerId).select("firstName lastName").lean()
        : null,
      academicYearId
        ? AcademicYear.findById(academicYearId).select("title").lean()
        : null,
    ]);
    const initial = user?.firstName ? `${user.firstName.charAt(0)}.` : "";
    const name = [user?.lastName, initial].filter(Boolean).join(" ");
    const parts = [];
    if (name) parts.push(name);
    if (year?.title) parts.push(`${year.title} o'quv yili`);
    return parts.join(" — ");
  } catch (err) {
    winston.warn(`[chainNotify] describeOwner xato: ${err.message}`);
    return "";
  }
};

module.exports = {
  safeDispatch,
  safeDispatchMany,
  STEP_ROLE,
  STEP_SCOPE,
  getRecipients,
  getRecipientsForSteps,
  describeOwner,
};
