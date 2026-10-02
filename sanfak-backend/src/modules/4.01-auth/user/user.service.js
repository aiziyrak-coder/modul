const UserModel = require("./user.model");
const RoleModel = require("#modules/4.01-auth/role/role.model");
const { escapeRegex } = require("#shared/searchFilter");

const LOOKUP_LIMIT_DEFAULT = 50;
const LOOKUP_LIMIT_MAX = 100;
const LOOKUP_SELECT = "_id firstName lastName position role department academicTitle";
const LOOKUP_POPULATE = [
  { path: "position", select: "title", strictPopulate: false },
  { path: "role", select: "title", strictPopulate: false },
  { path: "department", select: "title", strictPopulate: false },
  { path: "academicTitle", select: "title", strictPopulate: false },
];

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const resolveLookupLimit = (limit) => {
  const parsed = parseInt(limit, 10);
  const safe = Number.isFinite(parsed) && parsed > 0 ? parsed : LOOKUP_LIMIT_DEFAULT;
  return Math.min(safe, LOOKUP_LIMIT_MAX);
};

const normalizeRoleList = (role) => {
  if (role === undefined || role === null || role === "") return [];
  const list = Array.isArray(role)
    ? role
    : String(role)
        .split(",")
        .map((r) => r.trim());
  return list.filter(Boolean);
};

const resolveRoleIds = async (roleList) => {
  if (roleList.length === 0) return null;
  const ids = roleList.filter((r) => OBJECT_ID_RE.test(r));
  const names = roleList.filter((r) => !OBJECT_ID_RE.test(r));
  if (names.length === 0) return ids;
  const docs = await RoleModel.find({ title: { $in: names } })
    .select("_id")
    .lean();
  return [...ids, ...docs.map((d) => String(d._id))];
};

const buildLookupFilter = (search, roleIds) => {
  const filter = { active: true };
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }];
  }
  if (roleIds) filter.role = { $in: roleIds };
  return filter;
};

module.exports = {
  LOOKUP_LIMIT_DEFAULT,
  LOOKUP_LIMIT_MAX,
  resolveLookupLimit,
  normalizeRoleList,
  resolveRoleIds,
  buildLookupFilter,

  lookup: async ({ search, limit, role } = {}) => {
    const roleIds = await resolveRoleIds(normalizeRoleList(role));
    return UserModel.find(buildLookupFilter(search, roleIds))
      .select(LOOKUP_SELECT)
      .populate(LOOKUP_POPULATE)
      .limit(resolveLookupLimit(limit))
      .lean()
      .exec();
  },
};
