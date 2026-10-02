const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const { ROLES } = require("#config/constants");
const { searchOr } = require("#modules/4.07-task/_services/searchTerm");
const Grant = require("./taskAssigneeGrant.model");

const User = () => mongoose.model("user");

const USER_SELECT = "firstName lastName middleName position department role active";
const USER_POPULATE = [
  { path: "position", select: "title name" },
  { path: "department", select: "title name" },
  { path: "role", select: "title description" },
];

const isPlatformAdmin = (user) =>
  user?.role?.title === ROLES.SUPER_ADMIN || user?.role?.title === ROLES.ADMIN;

const isStrictMode = () =>
  String(process.env.TASK_ASSIGNEE_GRANT_STRICT || "").toLowerCase() === "true";

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

const assertValidObjectId = (id, label) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ErrorHandler(400, `${label} noto'g'ri`);
  }
};

const userSearchFilter = (search) => {
  const or = searchOr(search, ["firstName", "lastName", "middleName"]);
  if (!or) return {};
  return { $or: or };
};

const grantedAssigneeIds = async (assignerId) => {
  const ids = await Grant.distinct("assignee", { assigner: toObjectId(assignerId) });
  return new Set(ids.map(String));
};

const listAssigners = async (query = {}) => {
  const { page, limit } = normalizePageParams(query, { defaultLimit: 20 });

  const filter = { ...userSearchFilter(query.search) };
  if (query.role) {
    assertValidObjectId(query.role, "Rol");
    filter.role = toObjectId(query.role);
  }
  if (query.active !== undefined) filter.active = query.active;

  const res = await User().paginate(filter, {
    page,
    limit,
    select: USER_SELECT,
    populate: USER_POPULATE,
    sort: withTiebreaker({ lastName: 1, firstName: 1 }),
    lean: true,
  });

  const ids = (res.docs || []).map((u) => u._id);
  const rows = ids.length
    ? await Grant.aggregate([
        { $match: { assigner: { $in: ids } } },
        { $lookup: { from: "users", localField: "assignee", foreignField: "_id", as: "u" } },
        { $match: { "u.0": { $exists: true } } },
        { $group: { _id: "$assigner", count: { $sum: 1 } } },
      ])
    : [];
  const byAssigner = new Map(rows.map((r) => [String(r._id), r.count]));

  return {
    ...res,
    docs: (res.docs || []).map((u) => ({
      ...u,
      grantCount: byAssigner.get(String(u._id)) || 0,
    })),
  };
};

const listGrants = async (assignerId) => {
  assertValidObjectId(assignerId, "Foydalanuvchi");
  const ids = await Grant.distinct("assignee", { assigner: toObjectId(assignerId) });
  if (!ids.length) return [];
  return User()
    .find({ _id: { $in: ids } })
    .select(USER_SELECT)
    .populate(USER_POPULATE)
    .sort({ lastName: 1, firstName: 1 })
    .lean();
};

const listCandidates = async (query = {}) => {
  const { page, limit } = normalizePageParams(query, { defaultLimit: 20 });
  const filter = { ...userSearchFilter(query.search) };
  if (query.role) {
    assertValidObjectId(query.role, "Rol");
    filter.role = toObjectId(query.role);
  }
  return User().paginate(filter, {
    page,
    limit,
    select: USER_SELECT,
    populate: USER_POPULATE,
    sort: withTiebreaker({ lastName: 1, firstName: 1 }),
    lean: true,
  });
};

const listRoleOptions = async () => {
  const Role = mongoose.model("role");
  return Role.find({}).select("title description").sort({ title: 1 }).lean();
};

const assertUsersExist = async (ids) => {
  const found = await User()
    .find({ _id: { $in: ids.map(toObjectId) } })
    .select("_id")
    .lean();
  if (found.length !== ids.length) {
    throw new ErrorHandler(400, "Ba'zi foydalanuvchilar tizimda topilmadi");
  }
};

const normalizeIds = (raw) => {
  const ids = [...new Set((raw || []).map(String))];
  ids.forEach((id) => assertValidObjectId(id, "Ijrochi"));
  return ids;
};

const replaceGrants = async (assignerId, assigneeIdsRaw, actor) => {
  assertValidObjectId(assignerId, "Foydalanuvchi");
  const assigner = toObjectId(assignerId);
  const ids = normalizeIds(assigneeIdsRaw);
  if (ids.length) await assertUsersExist(ids);

  const before = await Grant.distinct("assignee", { assigner });
  const beforeSet = new Set(before.map(String));
  const afterSet = new Set(ids);

  const toAdd = ids.filter((id) => !beforeSet.has(id));
  const toRemove = before.filter((id) => !afterSet.has(String(id)));

  if (toAdd.length) {
    await Grant.bulkWrite(
      toAdd.map((assignee) => ({
        updateOne: {
          filter: { assigner, assignee: toObjectId(assignee) },
          update: {
            $setOnInsert: {
              assigner,
              assignee: toObjectId(assignee),
              createdBy: actor?._id || actor,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  if (toRemove.length) {
    await Grant.deleteMany({ assigner, assignee: { $in: toRemove } });
  }

  return { added: toAdd.length, removed: toRemove.length, total: ids.length };
};

const addGrants = async (assignerId, assigneeIdsRaw, actor) => {
  assertValidObjectId(assignerId, "Foydalanuvchi");
  const assigner = toObjectId(assignerId);
  const ids = normalizeIds(assigneeIdsRaw);
  if (!ids.length) return { added: 0 };
  await assertUsersExist(ids);

  const res = await Grant.bulkWrite(
    ids.map((assignee) => ({
      updateOne: {
        filter: { assigner, assignee: toObjectId(assignee) },
        update: {
          $setOnInsert: {
            assigner,
            assignee: toObjectId(assignee),
            createdBy: actor?._id || actor,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return { added: res.upsertedCount || 0 };
};

const removeGrant = async (assignerId, assigneeId) => {
  assertValidObjectId(assignerId, "Foydalanuvchi");
  assertValidObjectId(assigneeId, "Ijrochi");
  const res = await Grant.deleteOne({
    assigner: toObjectId(assignerId),
    assignee: toObjectId(assigneeId),
  });
  if (!res.deletedCount) throw new ErrorHandler(404, "Biriktirish topilmadi");
  return { removed: 1 };
};

module.exports = {
  isPlatformAdmin,
  isStrictMode,
  grantedAssigneeIds,
  listAssigners,
  listGrants,
  listCandidates,
  listRoleOptions,
  replaceGrants,
  addGrants,
  removeGrant,

  USER_SELECT,
  USER_POPULATE,
  userSearchFilter,
};
