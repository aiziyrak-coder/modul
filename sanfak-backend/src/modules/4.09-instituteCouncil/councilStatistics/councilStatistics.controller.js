"use strict";

const winston = require("#shared/winston.logger");

const CouncilTask = require("#modules/4.09-instituteCouncil/councilTask/councilTask.model");
const RankApplication = require("#modules/4.09-instituteCouncil/rankApplication/rankApplication.model");
const VotingSession = require("#modules/4.09-instituteCouncil/votingSession/votingSession.model");
const CouncilMember = require("#modules/4.09-instituteCouncil/councilMember/councilMember.model");

const LIVE = { active: true };

const TASK_STATUSLAR = ["new", "in_progress", "done", "approved", "rejected", "overdue"];
const RANK_STATUSLAR = ["new", "accepted", "returned"];
const VOTE_STATUSLAR = ["active", "approved", "rejected"];

const TASK_TERMINAL = ["done", "approved", "rejected"];

const bosh = (kalitlar) => Object.fromEntries(kalitlar.map((k) => [k, 0]));

module.exports = {
  overview: async (req, res, next) => {
    try {
      const [taskAgg, rankAgg, voteAgg, memberTotal] = await Promise.all([
        CouncilTask.aggregate([
          { $match: LIVE },
          {
            $facet: {
              total: [{ $count: "n" }],
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
              overdue: [
                {
                  $match: {
                    $or: [
                      { status: "overdue" },
                      {
                        $and: [
                          { deadline: { $ne: null, $lt: new Date() } },
                          { status: { $nin: TASK_TERMINAL } },
                        ],
                      },
                    ],
                  },
                },
                { $count: "n" },
              ],
            },
          },
        ]),

        RankApplication.aggregate([
          { $match: LIVE },
          {
            $facet: {
              total: [{ $count: "n" }],
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
            },
          },
        ]),

        VotingSession.aggregate([
          { $match: LIVE },
          {
            $facet: {
              total: [{ $count: "n" }],
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
              passed: [{ $match: { passed: true } }, { $count: "n" }],
            },
          },
        ]),

        CouncilMember.countDocuments(LIVE),
      ]);

      const t = taskAgg?.[0] ?? {};
      const r = rankAgg?.[0] ?? {};
      const v = voteAgg?.[0] ?? {};

      const taskStatus = bosh(TASK_STATUSLAR);
      (t.byStatus ?? []).forEach((x) => {
        if (x._id in taskStatus) taskStatus[x._id] = x.n;
      });

      const rankStatus = bosh(RANK_STATUSLAR);
      (r.byStatus ?? []).forEach((x) => {
        if (x._id in rankStatus) rankStatus[x._id] = x.n;
      });

      const voteStatus = bosh(VOTE_STATUSLAR);
      (v.byStatus ?? []).forEach((x) => {
        if (x._id in voteStatus) voteStatus[x._id] = x.n;
      });

      return res.status(200).json({
        tasks: {
          total: t.total?.[0]?.n ?? 0,
          byStatus: taskStatus,
          overdue: t.overdue?.[0]?.n ?? 0,
        },
        ranks: { total: r.total?.[0]?.n ?? 0, byStatus: rankStatus },
        votings: {
          total: v.total?.[0]?.n ?? 0,
          byStatus: voteStatus,
          active: voteStatus.active,
          passed: v.passed?.[0]?.n ?? 0,
        },
        members: { total: memberTotal },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
