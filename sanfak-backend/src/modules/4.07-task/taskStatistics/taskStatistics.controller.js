"use strict";

const winston = require("#shared/winston.logger");
const { ROLES } = require("#config/constants");

const Task = require("#modules/4.07-task/task/task.model");
const { TERMINAL_STATUSES } = require("#modules/4.07-task/task/task.model");
const { MONTHS_SHORT_UZ: OY } = require("#modules/4.07-task/_services/taskLabels");

const seesAll = (user) =>
  user?.role?.title === ROLES.SUPER_ADMIN ||
  user?.role?.title === ROLES.ADMIN ||
  user?.role?.scopeLevel === "global";

const {
  TASK_STATUSES: STATUSES,
  TASK_PRIORITIES: PRIORITIES,
} = require("#modules/4.07-task/task/task.model");

const OVERDUE_COND = {
  $and: [
    { $ne: ["$deadline", null] },
    { $lt: ["$deadline", "$$NOW"] },
    { $not: [{ $in: ["$status", TERMINAL_STATUSES] }] },
  ],
};

const foiz = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

module.exports = {
  overview: async (req, res, next) => {
    try {
      const user = req.user;
      const year = Number(req.query.year) || new Date().getFullYear();

      const match = { deletedAt: null };
      if (!seesAll(user)) {
        match.$or = [{ createdBy: user._id }, { assignee: user._id }];
      }

      const [agg] = await Task.aggregate([
        { $match: match },
        {
          $facet: {
            total: [{ $count: "n" }],
            byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
            byPriority: [{ $group: { _id: "$priority", n: { $sum: 1 } } }],
            overdue: [{ $match: { $expr: OVERDUE_COND } }, { $count: "n" }],
            highOverdue: [
              { $match: { $expr: { $and: [OVERDUE_COND, { $eq: ["$priority", "high"] }] } } },
              { $count: "n" },
            ],
            discipline: [
              { $match: { status: "completed", completedAt: { $ne: null } } },
              {
                $group: {
                  _id: null,
                  completed: { $sum: 1 },
                  onTime: {
                    $sum: {
                      $cond: [
                        { $or: [{ $eq: ["$deadline", null] }, { $lte: ["$completedAt", "$deadline"] }] },
                        1,
                        0,
                      ],
                    },
                  },
                  avgMs: { $avg: { $subtract: ["$completedAt", "$createdAt"] } },
                },
              },
            ],
            byCategory: [
              { $match: { category: { $ne: null } } },
              { $group: { _id: "$category", n: { $sum: 1 } } },
              { $sort: { n: -1 } },
              { $limit: 10 },
            ],
            byDepartment: [
              {
                $lookup: {
                  from: "users",
                  localField: "assignee",
                  foreignField: "_id",
                  as: "u",
                  pipeline: [{ $project: { department: 1 } }],
                },
              },
              { $unwind: { path: "$u", preserveNullAndEmptyArrays: false } },
              { $match: { "u.department": { $ne: null } } },
              {
                $group: {
                  _id: "$u.department",
                  total: { $sum: 1 },
                  completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                  overdue: { $sum: { $cond: [OVERDUE_COND, 1, 0] } },
                  onTime: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$status", "completed"] },
                            { $ne: ["$completedAt", null] },
                            {
                              $or: [
                                { $eq: ["$deadline", null] },
                                { $lte: ["$completedAt", "$deadline"] },
                              ],
                            },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
              { $sort: { total: -1 } },
            ],
            monthly: [
              {
                $match: {
                  createdAt: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59, 999) },
                },
              },
              {
                $group: {
                  _id: { $month: "$createdAt" },
                  berilgan: { $sum: 1 },
                  bajarilgan: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                },
              },
            ],
          },
        },
      ]);

      const total = agg?.total?.[0]?.n ?? 0;
      const overdueCount = agg?.overdue?.[0]?.n ?? 0;
      const disc = agg?.discipline?.[0] ?? { completed: 0, onTime: 0, avgMs: null };

      const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      (agg?.byStatus ?? []).forEach((r) => {
        if (r._id in byStatus) byStatus[r._id] = r.n;
      });

      const byPriority = Object.fromEntries(PRIORITIES.map((p) => [p, 0]));
      (agg?.byPriority ?? []).forEach((r) => {
        if (r._id in byPriority) byPriority[r._id] = r.n;
      });

      const oyMap = new Map((agg?.monthly ?? []).map((r) => [r._id, r]));
      const monthly = OY.map((nom, i) => ({
        month: nom,
        berilgan: oyMap.get(i + 1)?.berilgan ?? 0,
        bajarilgan: oyMap.get(i + 1)?.bajarilgan ?? 0,
      }));

      const depIds = (agg?.byDepartment ?? []).map((d) => d._id).filter(Boolean);
      const catIds = (agg?.byCategory ?? []).map((c) => c._id).filter(Boolean);

      const [deps, cats] = await Promise.all([
        depIds.length
          ? require("#references/department/department.model").find({ _id: { $in: depIds } }).select("title").lean()
          : [],
        catIds.length
          ? require("#modules/4.07-task/taskCategory/taskCategory.model").find({ _id: { $in: catIds } }).select("name").lean()
          : [],
      ]);
      const depName = new Map(deps.map((d) => [String(d._id), d.title]));
      const catName = new Map(cats.map((c) => [String(c._id), c.name]));

      return res.status(200).json({
        total,
        byStatus,
        overdue: { count: overdueCount, share: foiz(overdueCount, total) },
        discipline: {
          completed: disc.completed ?? 0,
          onTime: disc.onTime ?? 0,
          percent: foiz(disc.onTime ?? 0, disc.completed ?? 0),
        },
        avgCompletionDays:
          disc.avgMs != null ? Math.round((disc.avgMs / 86_400_000) * 10) / 10 : null,
        byDepartment: (agg?.byDepartment ?? [])
          .map((d) => ({
            department: depName.get(String(d._id)) ?? null,
            total: d.total,
            completed: d.completed,
            overdue: d.overdue,
            onTimePercent: foiz(d.onTime, d.completed),
          }))
          .filter((d) => d.department),
        monthly,
        byCategory: (agg?.byCategory ?? [])
          .map((c) => ({ category: catName.get(String(c._id)) ?? null, count: c.n }))
          .filter((c) => c.category),
        byPriority,
        highOverdue: agg?.highOverdue?.[0]?.n ?? 0,
        period: { year },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
