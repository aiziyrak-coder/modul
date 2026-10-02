"use strict";

const winston = require("#shared/winston.logger");

const Indicator = require("#modules/4.12-qualityAssurance/indicator/indicator.model");
const Submission = require("#modules/4.12-qualityAssurance/indicatorSubmission/indicatorSubmission.model");

const LIVE = { active: true };
const HOLATLAR = ["pending", "approved", "rejected"];

const bosh = (kalitlar) => Object.fromEntries(kalitlar.map((k) => [k, 0]));

module.exports = {
  overview: async (req, res, next) => {
    try {
      const [indTotal, indActive, subAgg, facultyRows] = await Promise.all([
        Indicator.countDocuments({}),
        Indicator.countDocuments(LIVE),

        Submission.aggregate([
          { $match: LIVE },
          {
            $facet: {
              total: [{ $count: "n" }],
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
              score: [
                { $match: { status: "approved" } },
                { $group: { _id: null, v: { $sum: "$score" } } },
              ],
            },
          },
        ]),

        Submission.aggregate([
          { $match: { ...LIVE, status: "approved" } },
          {
            $group: {
              _id: "$teacher",
              totalScore: { $sum: "$score" },
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "u",
              pipeline: [{ $project: { division: 1 } }],
            },
          },
          { $unwind: "$u" },
          {
            $lookup: {
              from: "divisions",
              localField: "u.division",
              foreignField: "_id",
              as: "d",
              pipeline: [{ $project: { faculty: 1 } }],
            },
          },
          { $unwind: { path: "$d", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "faculties",
              localField: "d.faculty",
              foreignField: "_id",
              as: "f",
              pipeline: [{ $project: { title: 1 } }],
            },
          },
          { $unwind: { path: "$f", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: "$f._id",
              faculty: { $first: "$f.title" },
              teachers: { $sum: 1 },
              totalScore: { $sum: "$totalScore" },
            },
          },
          {
            $project: {
              _id: 0,
              faculty: { $ifNull: ["$faculty", "Belgilanmagan"] },
              teachers: 1,
              totalScore: 1,
              avgScore: {
                $cond: [
                  { $gt: ["$teachers", 0] },
                  { $round: [{ $divide: ["$totalScore", "$teachers"] }, 2] },
                  0,
                ],
              },
            },
          },
          { $sort: { avgScore: -1 } },
          { $limit: 8 },
        ]),
      ]);

      const sAgg = subAgg?.[0] ?? {};
      const byStatus = bosh(HOLATLAR);
      (sAgg.byStatus ?? []).forEach((r) => {
        if (r._id in byStatus) byStatus[r._id] = r.n;
      });

      return res.status(200).json({
        indicators: { total: indTotal, active: indActive },
        submissions: {
          total: sAgg.total?.[0]?.n ?? 0,
          byStatus,
          totalScore: sAgg.score?.[0]?.v ?? 0,
        },
        faculties: facultyRows,
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
