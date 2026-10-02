const AuditLogModel = require("./auditLog.model");

const dayStart = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(d.setHours(0, 0, 0, 0));
};
const dayEnd = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(d.setHours(23, 59, 59, 999));
};

const buildFilter = (q = {}) => {
  const filter = {};

  if (q.user) filter.user = q.user;
  if (q.module) {
    const esc = String(q.module).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.module = new RegExp(`^${esc}(\\?|$)`);
  }
  if (q.targetId) filter.targetId = String(q.targetId).toLowerCase();
  if (q.method) filter.method = String(q.method).toUpperCase();
  if (q.statusCode) filter.statusCode = Number(q.statusCode);

  if (String(q.onlyMutations) === "true") {
    filter.method = { $in: ["POST", "PUT", "PATCH", "DELETE"] };
  }

  const from = q.dateFrom ? dayStart(q.dateFrom) : null;
  const to = q.dateTo ? dayEnd(q.dateTo) : null;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  if (q.search) {
    const rx = new RegExp(String(q.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ path: rx }, { action: rx }, { userName: rx }];
  }

  return filter;
};

const HIDDEN_FIELDS = "-requestBody -requestQuery";

module.exports = {
  buildFilter,

  paginate: async (query) => {
    const page = Math.max(parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 200);

    return AuditLogModel.paginate(buildFilter(query), {
      page,
      limit,
      sort: { createdAt: -1 },
      select: HIDDEN_FIELDS,
      populate: { path: "user", select: "firstName lastName" },
      lean: true,
    });
  },

  findById: async (id) =>
    AuditLogModel.findById(id)
      .select(HIDDEN_FIELDS)
      .populate("user", "firstName lastName")
      .lean()
      .exec(),

  listForExport: async (query, cap = 5000) =>
    AuditLogModel.find(buildFilter(query))
      .select(HIDDEN_FIELDS)
      .sort({ createdAt: -1 })
      .limit(cap)
      .populate("user", "firstName lastName")
      .lean()
      .exec(),

  distinctModules: async () => AuditLogModel.distinct("module"),
};
