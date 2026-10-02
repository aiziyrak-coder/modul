const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const winston = require("#shared/winston.logger");
const { resolveUserFacultyId } = require("#shared/userScope");
const { normalizePageParams, withTiebreaker } = require("#shared/paginate");
const { ROLES } = require("#config/constants");
const { dispatch } = require("#system/notification/notificationDispatcher");
const { emitToUser } = require("#system/_shared/socketHandler");
const {
  reserveTaskCodes,
  formatTaskCode,
} = require("#modules/4.07-task/_services/taskSequence");
const { sendTaskAssigned } = require("#modules/4.07-task/_services/taskBot");
const TaskResponse = require("#modules/4.07-task/taskResponse/taskResponse.model");
const {
  MONTHS_SHORT_UZ: MONTHS_UZ,
} = require("#modules/4.07-task/_services/taskLabels");
const grants = require("#modules/4.07-task/taskAssigneeGrant/taskAssigneeGrant.service");
const {
  applyScopedEquals,
} = require("#modules/4.07-task/_services/scopeGuard");
const { searchRegex, searchOr } = require("#modules/4.07-task/_services/searchTerm");
const Task = require("./task.model");

const {
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  DISPLAY_STATUSES,
  FINALIZE_OUTCOMES,
} = Task;

const USER_POP = {
  select: "firstName lastName middleName position",
  populate: { path: "position", select: "title name" },
};
const POPULATE = [
  { path: "createdBy", ...USER_POP },
  { path: "assignee", ...USER_POP },
  { path: "category", select: "name" },
];

const seesAll = (user) =>
  user?.role?.title === ROLES.SUPER_ADMIN ||
  user?.role?.title === ROLES.ADMIN ||
  user?.role?.scopeLevel === "global";

const isCreator = (task, user) =>
  String(task.createdBy?._id || task.createdBy) === String(user._id);
const isAssignee = (task, user) =>
  String(task.assignee?._id || task.assignee) === String(user._id);

const todayUTCMidnight = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const isTerminal = (status) => TERMINAL_STATUSES.includes(status);
const computeDisplayStatus = (task) => {
  if (
    !isTerminal(task.status) &&
    task.deadline &&
    new Date(task.deadline) < todayUTCMidnight()
  ) {
    return "overdue";
  }
  return task.status;
};
const decorate = (task) => {
  if (!task) return task;
  const obj = typeof task.toObject === "function" ? task.toObject() : task;
  obj.displayStatus = computeDisplayStatus(obj);
  obj.isOverdue = obj.displayStatus === "overdue";
  return obj;
};
const decorateMany = (docs) => (docs || []).map(decorate);

const attachResponseCounts = async (docs) => {
  const ids = (docs || []).map((d) => d._id).filter(Boolean);
  if (!ids.length) return docs;
  const rows = await TaskResponse.aggregate([
    { $match: { task: { $in: ids } } },
    { $group: { _id: "$task", count: { $sum: 1 } } },
  ]);
  const byTask = new Map(rows.map((r) => [String(r._id), r.count]));
  docs.forEach((d) => {
    d.responseCount = byTask.get(String(d._id)) || 0;
  });
  return docs;
};

const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};

const toObjectId = (v) => {
  if (v === null || v === undefined || v === "") return v;
  if (!mongoose.Types.ObjectId.isValid(v)) return v;
  const oid = new mongoose.Types.ObjectId(String(v));
  return String(oid) === String(v) ? oid : v;
};

const buildFilter = (scope, query = {}) => {
  const filter = { ...scope };
  const searchBranch = searchOr(query.search, ["title", "code"]);
  if (searchBranch) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchBranch }];
      delete filter.$or;
    } else {
      filter.$or = searchBranch;
    }
  }
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = toObjectId(query.category);
  applyScopedEquals(filter, scope, "assignee", toObjectId(query.assignee));

  const deadline = {};
  if (query.deadlineFrom) deadline.$gte = new Date(query.deadlineFrom);
  if (query.deadlineTo) deadline.$lte = new Date(query.deadlineTo);

  const createdAt = {};
  if (query.createdFrom) createdAt.$gte = new Date(query.createdFrom);
  if (query.createdTo) createdAt.$lte = new Date(query.createdTo);
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;

  const statusList = String(query.status || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (statusList.includes("overdue")) {
    filter.status = { $nin: TERMINAL_STATUSES };
    deadline.$lt = todayUTCMidnight();
  } else if (statusList.length) {
    const terminal = statusList.filter((s) => TERMINAL_STATUSES.includes(s));
    const active = statusList.filter((s) => !TERMINAL_STATUSES.includes(s));
    const clauses = [];
    if (terminal.length) clauses.push({ status: { $in: terminal } });
    if (active.length) {
      clauses.push({
        status: { $in: active },
        $or: [{ deadline: null }, { deadline: { $gte: todayUTCMidnight() } }],
      });
    }
    filter.$and = [
      ...(filter.$and || []),
      clauses.length === 1 ? clauses[0] : { $or: clauses },
    ];
  }

  if (Object.keys(deadline).length) filter.deadline = deadline;
  return filter;
};

const createdScope = (user) =>
  seesAll(user)
    ? {}
    : { createdBy: user._id };

const assertAssignableScope = async (creator, assigneeIds) => {
  if (!creator || !creator._id) return;
  if (grants.isPlatformAdmin(creator)) return;

  const ids = [...new Set(assigneeIds.map(String))];

  const granted = await grants.grantedAssigneeIds(creator._id);
  if (granted.size) {
    const outside = ids.filter((id) => !granted.has(id));
    if (outside.length) {
      throw new ErrorHandler(
        403,
        "Ba'zi ijrochilar sizga biriktirilmagan — ularga topshiriq bera olmaysiz",
      );
    }
    return;
  }

  if (grants.isStrictMode()) {
    throw new ErrorHandler(
      403,
      "Sizga hech qanday ijrochi biriktirilmagan — administratorga murojaat qiling",
    );
  }

  if (seesAll(creator)) return;
  const level = creator.role?.scopeLevel || "self";
  if (level === "global") return;

  if (level === "self") {
    if (ids.some((id) => id !== String(creator._id))) {
      throw new ErrorHandler(
        403,
        "Sizning rolingiz faqat o'zingizga topshiriq berishga ruxsat beradi",
      );
    }
    return;
  }

  const creatorDept = String(creator.department?._id || creator.department || "");
  const creatorFaculty = String(resolveUserFacultyId(creator) || "");
  if (level === "department" && !creatorDept) {
    throw new ErrorHandler(403, "Kafedrangiz aniqlanmadi — topshiriq bera olmaysiz");
  }
  if (level === "faculty" && !creatorFaculty) {
    throw new ErrorHandler(403, "Fakultetingiz aniqlanmadi — topshiriq bera olmaysiz");
  }

  const User = mongoose.model("user");
  const query = User.find({ _id: { $in: ids } }).select("department");
  if (level === "faculty") query.populate({ path: "department", select: "faculty" });
  const users = await query.lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  const outside = ids.filter((id) => {
    const u = byId.get(id);
    if (!u) return true;
    if (level === "department") {
      return String(u.department?._id || u.department || "") !== creatorDept;
    }
    return String(u.department?.faculty || "") !== creatorFaculty;
  });

  if (outside.length) {
    throw new ErrorHandler(
      403,
      level === "department"
        ? "Ba'zi ijrochilar sizning kafedrangizdan tashqarida — biriktirib bo'lmaydi"
        : "Ba'zi ijrochilar sizning fakultetingizdan tashqarida — biriktirib bo'lmaydi",
    );
  }
};

const countByDisplayStatus = async (match) => {
  const rows = await Task.aggregate([
    { $match: { ...match, deletedAt: null } },
    {
      $addFields: {
        ds: {
          $cond: [
            {
              $and: [
                { $not: [{ $in: ["$status", TERMINAL_STATUSES] }] },
                { $ne: ["$deadline", null] },
                { $lt: ["$deadline", "$$NOW"] },
              ],
            },
            "overdue",
            "$status",
          ],
        },
      },
    },
    { $group: { _id: "$ds", count: { $sum: 1 } } },
  ]);
  const out = { total: 0 };
  for (const key of DISPLAY_STATUSES) out[key] = 0;

  rows.forEach((r) => {
    if (out[r._id] !== undefined) out[r._id] = r.count;
    else {
      winston.warn(
        `[4.7 stats] lug'atda yo'q holat: "${r._id}" (${r.count} ta topshiriq)`,
      );
    }
    out.total += r.count;
  });
  return out;
};

const notifyInApp = async (userId, eventType, title, body, taskId, code) => {
  try {
    await dispatch({
      userId,
      eventType,
      title,
      body,
      link: `/tasks/${taskId}`,
      metadata: { taskId, code },
      overrideChannels: { inApp: true },
    });
  } catch (err) {
    winston.error(`[task] in-app notify xato (${eventType}): ${err.message}`);
  }
};

const notifyAssignment = async (item, base) => {
  try {
    await dispatch({
      userId: item.assignee,
      eventType: "task_assigned",
      title: "Yangi topshiriq",
      body: base.title,
      link: `/tasks/${item._id}`,
      metadata: { taskId: item._id, code: item.code },
      overrideChannels: { inApp: true },
    });
  } catch (err) {
    winston.error(`[task] in-app notify xato: ${err.message}`);
  }
  try {
    await sendTaskAssigned(item.assignee, {
      code: item.code,
      title: base.title,
      deadline: base.deadline,
    });
  } catch (err) {
    winston.error(`[task] telegram notify xato: ${err.message}`);
  }
};

const listSort = (query = {}) =>
  query.sort === "deadline"
    ? { deadline: query.order === "asc" ? 1 : -1 }
    : { createdAt: -1 };

const MONITORING_SORT_FIELDS = {
  rating: "rating",
  total: "total",
  completed: "completed",
  done: "completed",
  active: "active",
  overdue: "overdue",
  late: "overdue",
  name: "lastName",
};
const monitoringSort = (query = {}) => {
  const f = MONITORING_SORT_FIELDS[query.sort] || "rating";
  const o = query.order === "asc" ? 1 : -1;
  const s = { [f]: o };
  if (f !== "total") s.total = -1;
  s.assigneeId = 1;
  return s;
};

const monitoringPipeline = (user, query = {}) => {
  const match = seesAll(user)
    ? {}
    : { $or: [{ createdBy: user._id }, { assignee: user._id }] };
  match.deletedAt = null;
  if (query.from || query.to) {
    match.createdAt = {};
    if (query.from) match.createdAt.$gte = new Date(query.from);
    if (query.to) match.createdAt.$lte = new Date(query.to);
  }
  if (query.assignee) {
    match.assignee = new mongoose.Types.ObjectId(String(query.assignee));
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$assignee",
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        notNeeded: { $sum: { $cond: [{ $eq: ["$status", "not_needed"] }, 1, 0] } },
        active: {
          $sum: { $cond: [{ $in: ["$status", ACTIVE_STATUSES] }, 1, 0] },
        },
        overdue: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $not: [{ $in: ["$status", TERMINAL_STATUSES] }] },
                  { $ne: ["$deadline", null] },
                  { $lt: ["$deadline", "$$NOW"] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $addFields: {
        rating: {
          $cond: [
            { $gt: ["$total", 0] },
            { $round: [{ $multiply: [{ $divide: ["$completed", "$total"] }, 100] }, 0] },
            0,
          ],
        },
      },
    },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "departments", localField: "user.department", foreignField: "_id", as: "dept" } },
    { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "positions", localField: "user.position", foreignField: "_id", as: "pos" } },
    { $unwind: { path: "$pos", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        firstName: "$user.firstName",
        lastName: "$user.lastName",
        middleName: "$user.middleName",
        department: "$dept.title",
        position: "$pos.title",
        fullName: {
          $trim: {
            input: {
              $concat: [
                { $ifNull: ["$user.lastName", ""] },
                " ",
                { $ifNull: ["$user.firstName", ""] },
                " ",
                { $ifNull: ["$user.middleName", ""] },
              ],
            },
          },
        },
      },
    },
  ];
  const searchRx = searchRegex(query.search);
  if (searchRx) {
    pipeline.push({ $match: { fullName: searchRx } });
  }
  pipeline.push({
    $project: {
      _id: 0,
      assigneeId: "$_id",
      firstName: 1,
      lastName: 1,
      middleName: 1,
      department: 1,
      position: 1,
      total: 1,
      completed: 1,
      rejected: 1,
      notNeeded: 1,
      active: 1,
      overdue: 1,
      rating: 1,
    },
  });
  return pipeline;
};


module.exports = {
  buildFilter,
  createdScope,
  decorate,

  create: async ({ assignees, ...base }, creator) => {
    const createdBy = creator?._id || creator;
    const ids = [...new Set((assignees || []).map(String))];
    if (ids.length === 0) {
      throw new ErrorHandler(400, "Kamida bitta ijrochi talab qilinadi");
    }

    const User = mongoose.model("user");
    const found = await User.find({ _id: { $in: ids } })
      .select("_id firstName lastName active")
      .lean();
    if (found.length !== ids.length) {
      throw new ErrorHandler(400, "Ba'zi ijrochilar tizimda topilmadi");
    }

    const blocked = found.filter((u) => u.active === false);
    if (blocked.length) {
      const names = blocked
        .map((u) => `${u.lastName || ""} ${u.firstName || ""}`.trim() || String(u._id))
        .join(", ");
      throw new ErrorHandler(
        400,
        `Bloklangan xodimga topshiriq berib bo'lmaydi: ${names}`,
      );
    }

    await assertAssignableScope(creator, ids);

    const { start } = await reserveTaskCodes(ids.length);

    const batchId = new mongoose.Types.ObjectId().toString();

    const documents = ids.map((assignee, i) => ({
      _id: new mongoose.Types.ObjectId(),
      ...base,
      assignee,
      createdBy,
      batchId,
      code: formatTaskCode(start + i),
      status: "new",
    }));

    await Task.bulkWrite(
      documents.map((document) => ({ insertOne: { document } })),
    );

    const items = documents.map((d) => ({
      _id: d._id,
      code: d.code,
      assignee: d.assignee,
    }));

    await Promise.all(items.map((it) => notifyAssignment(it, base)));

    return items;
  },

  findAll: (user, query) =>
    Task.find(buildFilter(createdScope(user), query))
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .lean()
      .then(decorateMany),

  paginate: (user, query) => {
    const { page, limit } = normalizePageParams(query);
    return Task.paginate(buildFilter(createdScope(user), query), {
      page,
      limit,
      sort: withTiebreaker(listSort(query)),
      populate: POPULATE,
      lean: true,
    }).then(async (res) => ({
      ...res,
      docs: await attachResponseCounts(decorateMany(res.docs)),
    }));
  },

  paginateMine: (user, query) => {
    const { page, limit } = normalizePageParams(query);
    return Task.paginate(buildFilter({ assignee: user._id }, query), {
      page,
      limit,
      sort: withTiebreaker(listSort(query)),
      populate: POPULATE,
      lean: true,
    }).then(async (res) => ({
      ...res,
      docs: await attachResponseCounts(decorateMany(res.docs)),
    }));
  },

  stats: async (user, query = {}) => {
    const { status, page, limit, sort, order, ...listFilters } = query;
    return {
      created: await countByDisplayStatus(buildFilter(createdScope(user), listFilters)),
      assigned: await countByDisplayStatus(buildFilter({ assignee: user._id }, listFilters)),
    };
  },

  assignableUsers: async (user, query = {}) => {
    const User = mongoose.model("user");
    const { page, limit } = normalizePageParams(query, { defaultLimit: 50 });
    const select = "firstName lastName middleName position department";
    const POP = [
      { path: "position", select: "title name" },
      { path: "department", select: "title name" },
    ];

    const base = { active: { $ne: false } };
    const nameOr = searchOr(query.search, ["firstName", "lastName", "middleName"]);
    if (nameOr) base.$or = nameOr;

    const paginate = (extra = {}) =>
      User.paginate(
        { ...base, ...extra },
        {
          page,
          limit,
          select,
          populate: POP,
          sort: withTiebreaker({ lastName: 1, firstName: 1 }),
          lean: true,
        },
      );

    const emptyPage = {
      docs: [],
      totalDocs: 0,
      limit,
      page,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    };

    if (grants.isPlatformAdmin(user)) return paginate();

    const granted = await grants.grantedAssigneeIds(user._id);
    if (granted.size) {
      return paginate({
        _id: { $in: [...granted].map((id) => new mongoose.Types.ObjectId(id)) },
      });
    }
    if (grants.isStrictMode()) return emptyPage;

    if (seesAll(user)) return paginate();
    const level = user.role?.scopeLevel || "self";
    if (level === "global") return paginate();
    if (level === "self") return paginate({ _id: user._id });

    const creatorDept = String(user.department?._id || user.department || "");
    const creatorFaculty = String(resolveUserFacultyId(user) || "");
    if (level === "department") {
      if (!creatorDept) return emptyPage;
      return paginate({ department: creatorDept });
    }
    if (level === "faculty") {
      if (!creatorFaculty) return emptyPage;
      const deptIds = await mongoose
        .model("department")
        .distinct("_id", { faculty: creatorFaculty });
      if (!deptIds.length) return emptyPage;
      return paginate({ department: { $in: deptIds } });
    }
    return emptyPage;
  },

  findMine: (user, query) =>
    Task.find(buildFilter({ assignee: user._id }, query))
      .populate(POPULATE)
      .sort({ createdAt: -1 })
      .lean()
      .then(decorateMany),

  findOne: async (id, user) => {
    const task = await Task.findById(id).populate(POPULATE);
    if (!task) return null;
    const creator = isCreator(task, user);
    const assignee = isAssignee(task, user);
    if (!creator && !assignee && !seesAll(user)) {
      throw new ErrorHandler(403, "Bu topshiriqni ko'rish huquqingiz yo'q");
    }
    if (assignee && !task.readAt) {
      task.readAt = new Date();
      await task.save();
    }
    return decorate(task);
  },

  update: async (id, user, body) => {
    const task = await Task.findById(id);
    if (!task) throw new ErrorHandler(404, "Topshiriq topilmadi");
    if (!isCreator(task, user) && !seesAll(user)) {
      throw new ErrorHandler(403, "Faqat topshiriq beruvchi tahrirlay oladi");
    }

    if (body.deadline !== undefined) {
      const d = new Date(body.deadline);
      if (Number.isNaN(d.getTime())) throw new ErrorHandler(400, "Muddat noto'g'ri");
      const startToday = new Date();
      startToday.setHours(0, 0, 0, 0);
      if (d < startToday) throw new ErrorHandler(400, "Muddat o'tmishdan bo'lishi mumkin emas");
    }

    const prevDeadline = task.deadline ? new Date(task.deadline).getTime() : null;

    const fields = ["title", "description", "deadline", "priority", "category"];
    fields.forEach((f) => {
      if (body[f] !== undefined) task[f] = body[f];
    });
    if (Array.isArray(body.attachments) && body.attachments.length) {
      task.attachments = [...(task.attachments || []), ...body.attachments];
    }
    await task.save();

    const newDeadline = task.deadline ? new Date(task.deadline).getTime() : null;
    if (newDeadline !== prevDeadline && !isAssignee(task, user)) {
      await notifyInApp(
        task.assignee,
        "task_deadline_changed",
        "Topshiriq muddati o'zgardi",
        `${task.code}: ${task.title} — yangi muddat ${formatDate(task.deadline)}`,
        task._id,
        task.code,
      );
    }
    return decorate(task);
  },

  remove: async (id, user, reason) => {
    const task = await Task.findById(id);
    if (!task) throw new ErrorHandler(404, "Topshiriq topilmadi");
    if (!isCreator(task, user) && !seesAll(user)) {
      throw new ErrorHandler(403, "Faqat topshiriq beruvchi o'chira oladi");
    }
    await task.softDelete(user._id, reason || null);
    return task;
  },

  addResponse: async (taskId, user, body) => {
    const task = await Task.findById(taskId);
    if (!task) throw new ErrorHandler(404, "Topshiriq topilmadi");

    const creator = isCreator(task, user);
    const assignee = isAssignee(task, user);
    if (!creator && !assignee && !seesAll(user)) {
      throw new ErrorHandler(403, "Bu topshiriqqa javob bera olmaysiz");
    }
    if (task.status === "completed" || task.status === "not_needed") {
      throw new ErrorHandler(400, "Yopilgan topshiriqqa javob berib bo'lmaydi");
    }
    if (body.isRejected && task.status === "rejected") {
      throw new ErrorHandler(400, "Topshiriq allaqachon rad etilgan");
    }

    const {
      text,
      attachments = [],
      isCompleted,
      isRejected,
      rejectionReason,
      isDeadlineChange,
      isReassign,
    } = body;

    const hasText = typeof text === "string" && text.trim().length > 0;
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    if (!hasText && !hasAttachments && !isCompleted && !isRejected) {
      throw new ErrorHandler(400, "Bo'sh javob yuborib bo'lmaydi");
    }

    const doc = {
      task: taskId,
      author: user._id,
      text: text || null,
      attachments,
    };

    if (creator && !assignee) {
      doc.isComment = true;
      if (isDeadlineChange) doc.isDeadlineChange = true;
      if (isReassign) doc.isReassign = true;
    } else {
      if (isRejected) {
        doc.isRejected = true;
        doc.rejectionReason = rejectionReason || null;
        task.status = "rejected";
        task.outcome = "rejected";
        task.rejectionReason = rejectionReason || null;
      } else if (isCompleted) {
        doc.isCompleted = true;
        task.status = "under_review";
      } else if (task.status === "new") {
        task.status = "in_progress";
      }
      if (!task.readAt) task.readAt = new Date();
    }

    await task.save();
    const created = await TaskResponse.create(doc);

    try {
      const populated = await created.populate({
        path: "author",
        select: "firstName lastName middleName",
      });
      const recipients = new Set([String(task.createdBy), String(task.assignee)]);
      const settled = await Promise.allSettled(
        [...recipients].map((userId) =>
          emitToUser(userId, "taskResponse:new", { taskId: task._id, response: populated }),
        ),
      );
      settled.forEach((r) => {
        if (r.status === "rejected") {
          winston.error(`[task] taskResponse:new socket xato: ${r.reason?.message || r.reason}`);
        }
      });
    } catch (err) {
      winston.error(`[task] taskResponse:new socket xato: ${err.message}`);
    }

    if (!doc.isComment) {
      if (isRejected) {
        await notifyInApp(
          task.createdBy, "task_rejected_by_executor",
          "Topshiriq rad etildi",
          `${task.code}: ${task.title}`,
          task._id, task.code
        );
      } else if (isCompleted) {
        await notifyInApp(
          task.createdBy, "task_submitted",
          "Topshiriq tekshiruvga yuborildi",
          `${task.code}: ${task.title}`,
          task._id, task.code
        );
      }
    }

    return { response: created, task: decorate(task) };
  },

  listResponses: async (taskId, user, query) => {
    const task = await Task.findById(taskId);
    if (!task) throw new ErrorHandler(404, "Topshiriq topilmadi");
    const creator = isCreator(task, user);
    const assignee = isAssignee(task, user);
    if (!creator && !assignee && !seesAll(user)) {
      throw new ErrorHandler(403, "Bu topshiriqning yozishmalarini ko'rish huquqingiz yo'q");
    }

    const { page, limit } = normalizePageParams(query, { defaultLimit: 20 });
    const primaryDir = query.order === "desc" ? -1 : 1;
    return TaskResponse.paginate(
      { task: taskId },
      {
        page,
        limit,
        sort: withTiebreaker({ createdAt: primaryDir }),
        populate: { path: "author", select: "firstName lastName middleName" },
        lean: true,
      },
    );
  },

  finalize: async (taskId, user, outcome) => {
    const task = await Task.findById(taskId);
    if (!task) throw new ErrorHandler(404, "Topshiriq topilmadi");
    if (!isCreator(task, user) && !seesAll(user)) {
      throw new ErrorHandler(403, "Faqat topshiriq beruvchi yakunlay oladi");
    }
    if (!FINALIZE_OUTCOMES.includes(outcome)) {
      throw new ErrorHandler(400, "Noto'g'ri natija");
    }
    task.status = outcome;
    task.outcome = outcome;
    task.completedAt = new Date();
    task.finalizedBy = user._id;
    task.rejectionReason = null;
    await task.save();
    await notifyInApp(
      task.assignee,
      outcome === "completed" ? "task_completed" : "task_not_needed",
      outcome === "completed" ? "Topshiriq bajarildi deb tasdiqlandi" : "Topshiriq kerak emas deb yopildi",
      `${task.code}: ${task.title}`,
      task._id, task.code
    );
    return decorate(task);
  },

  reopen: async (taskId, user) => {
    const task = await Task.findById(taskId);
    if (!task) throw new ErrorHandler(404, "Topshiriq topilmadi");
    const assignee = isAssignee(task, user);
    const canReopen =
      isCreator(task, user) || seesAll(user) || (assignee && task.status === "rejected");
    if (!canReopen) {
      throw new ErrorHandler(403, "Faqat topshiriq beruvchi qayta ocha oladi");
    }
    task.status = "in_progress";
    task.outcome = null;
    task.completedAt = null;
    task.finalizedBy = null;
    task.rejectionReason = null;
    await task.save();
    if (!assignee) {
      await notifyInApp(
        task.assignee, "task_reopened",
        "Topshiriq qayta ochildi",
        `${task.code}: ${task.title}`,
        task._id, task.code
      );
    }
    return decorate(task);
  },

  monitoringRows: (user, query = {}) =>
    Task.aggregate([...monitoringPipeline(user, query), { $sort: monitoringSort(query) }]),

  monitoringPage: (user, query = {}) =>
    Task.aggregatePaginate(Task.aggregate(monitoringPipeline(user, query)), {
      useFacet: false,
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 12,
      sort: monitoringSort(query),
    }),

  monitoringMonthly: async (user, query = {}) => {
    const y = parseInt(query.year) || new Date().getFullYear();
    const match = seesAll(user)
    ? {}
    : { $or: [{ createdBy: user._id }, { assignee: user._id }] };
    match.deletedAt = null;
    match.createdAt = {
      $gte: new Date(y, 0, 1),
      $lte: new Date(y, 11, 31, 23, 59, 59),
    };
    const rows = await Task.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $month: "$createdAt" },
          berilgan: { $sum: 1 },
          bajarilgan: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          kechikdi: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $not: [{ $in: ["$status", TERMINAL_STATUSES] }] },
                    { $ne: ["$deadline", null] },
                    { $lt: ["$deadline", "$$NOW"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const map = {};
    rows.forEach((r) => {
      map[r._id] = r;
    });
    return MONTHS_UZ.map((m, i) => ({
      month: m,
      berilgan: map[i + 1]?.berilgan || 0,
      bajarilgan: map[i + 1]?.bajarilgan || 0,
      kechikdi: map[i + 1]?.kechikdi || 0,
    }));
  },
};
