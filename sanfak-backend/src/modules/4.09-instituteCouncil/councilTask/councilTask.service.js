const CouncilTask = require("./councilTask.model");
const { escapeRegex } = require("#shared/searchFilter");
const { normalizePageParams } = require("#shared/paginate");
const winston = require("#shared/winston.logger");
const {
  safeDispatch,
} = require("#modules/4.09-instituteCouncil/_shared/councilNotify");

const EXCLUDE = { createdAt: 0, updatedAt: 0 };
const POPULATE = ["assignee", "createdBy", "approvedBy", "rejectedBy"];

const OVERDUE_NOTIFY_BATCH = 50;

const SUBMIT_ALLOWED_FROM = [
  "new",
  "in_progress",
  "overdue",
  "rejected",
  "done",
];

const applyPopulate = (query) => {
  POPULATE.forEach((p) => {
    query = query.populate(p);
  });
  return query;
};

const startOfDay = (value) => {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (value) => {
  const d = new Date(value);
  d.setHours(23, 59, 59, 999);
  return d;
};

const buildFilter = ({
  search,
  status,
  assignee,
  deadlineFrom,
  deadlineTo,
}) => {
  const data = {};
  if (search) data.title = { $regex: new RegExp(escapeRegex(search), "i") };
  if (status) data.status = status;
  if (assignee) data.assignee = assignee;
  if (deadlineFrom || deadlineTo) {
    data.deadline = {};
    if (deadlineFrom) data.deadline.$gte = startOfDay(deadlineFrom);
    if (deadlineTo) data.deadline.$lte = endOfDay(deadlineTo);
  }
  return data;
};

module.exports = {
  buildFilter,

  create: (body) => new CouncilTask(body).save(),

  findAll: (filter) =>
    applyPopulate(CouncilTask.find(filter, EXCLUDE)).exec(),

  paginate: (filter, query) => {
    const { page, limit } = normalizePageParams(query);
    return CouncilTask.paginate(filter, {
      limit,
      page,
      select: ["-createdAt", "-updatedAt"],
      populate: POPULATE,
    });
  },

  findOne: (id) => applyPopulate(CouncilTask.findById(id, EXCLUDE)).exec(),

  update: (id, body) =>
    CouncilTask.findByIdAndUpdate(id, body, { new: true }),

  remove: (id) => CouncilTask.findByIdAndDelete(id),

  markOverdue: async () => {
    await CouncilTask.updateMany(
      {
        status: { $in: ["new", "in_progress"] },
        deadline: { $lt: new Date() },
      },
      { $set: { status: "overdue" } },
    );

    const freshOverdue = await CouncilTask.find({
      status: "overdue",
      overdueNotifiedAt: null,
    })
      .select("title assignee")
      .limit(OVERDUE_NOTIFY_BATCH);

    const results = await Promise.allSettled(
      freshOverdue.map(async (task) => {
        const claimed = await CouncilTask.findOneAndUpdate(
          { _id: task._id, overdueNotifiedAt: null },
          { $set: { overdueNotifiedAt: new Date() } },
        );
        if (!claimed) return;
        await safeDispatch({
          userId: task.assignee,
          eventType: "council_task_overdue",
          title: `T: "${task.title}" muddati o'tdi`,
          link: "/kengash/topshiriqlar",
          metadata: { taskId: task._id, code: "T" },
        });
      }),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      winston.warn(
        `[councilTask.markOverdue] ${failed.length}/${results.length} ta bildirishnoma ` +
          `ishlanmadi: ${failed[0].reason?.message || failed[0].reason}`,
      );
    }
  },

  submitResult: (id, files, actorName) =>
    CouncilTask.findOneAndUpdate(
      { _id: id, status: { $in: SUBMIT_ALLOWED_FROM } },
      {
        status: "done",
        resultFiles: files,
        $push: {
          history: {
            at: new Date(),
            actor: actorName,
            action: "submit-result",
          },
        },
      },
      { new: true },
    ),

  deleteResult: (id, actorName) =>
    CouncilTask.findOneAndUpdate(
      { _id: id, status: "done" },
      {
        status: "in_progress",
        resultFiles: [],
        $push: {
          history: {
            at: new Date(),
            actor: actorName,
            action: "delete-result",
          },
        },
      },
      { new: true },
    ),

  approve: (id, actorId, actorName) =>
    CouncilTask.findOneAndUpdate(
      { _id: id, status: "done" },
      {
        status: "approved",
        approvedBy: actorId,
        completedAt: new Date(),
        $push: {
          history: {
            at: new Date(),
            actor: actorName,
            action: "approve",
          },
        },
      },
      { new: true },
    ),

  reject: (id, actorId, actorName, reason) =>
    CouncilTask.findOneAndUpdate(
      { _id: id, status: "done" },
      {
        status: "rejected",
        rejectReason: reason,
        rejectedBy: actorId,
        $push: {
          history: {
            at: new Date(),
            actor: actorName,
            action: "reject",
            reason,
          },
        },
      },
      { new: true },
    ),

  tabsCount: async (filter = {}) => {
    const rows = await CouncilTask.aggregate([
      { $match: filter },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const result = {
      new: 0,
      in_progress: 0,
      done: 0,
      approved: 0,
      rejected: 0,
      overdue: 0,
    };
    rows.forEach((r) => {
      if (r._id in result) result[r._id] = r.count;
    });
    return result;
  },
};
