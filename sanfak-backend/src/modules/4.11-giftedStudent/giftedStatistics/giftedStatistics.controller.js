"use strict";

const winston = require("#shared/winston.logger");

const GiftedStudent = require("#modules/4.11-giftedStudent/giftedStudent/giftedStudent.model");
const StudentAchievement = require("#modules/4.11-giftedStudent/studentAchievement/studentAchievement.model");
const ScholarshipApplication = require("#modules/4.11-giftedStudent/scholarshipApplication/scholarshipApplication.model");
const Scholarship = require("#modules/4.11-giftedStudent/scholarship/scholarship.model");
const { resolveOwnedGiftedStudentIds } = require("../_services/studentAccess");
const { currentAcademicYear } = require("../_services/academicYearWindow");
const { yearScoreOf, yearScorePath, rankingSort } = require("../_services/yearScore");

const LIVE = { active: true };
const ARIZA_HOLATLARI = ["pending", "approved", "rejected"];
const ARIZA_TURLARI = ["rektor_stipendiyasi", "nomdor_stipendiya", "davlat_granti", "other"];

const bosh = (kalitlar) => Object.fromEntries(kalitlar.map((k) => [k, 0]));
const kunFarq = (sana) => Math.floor((Date.now() - new Date(sana).getTime()) / 86_400_000);

module.exports = {
  overview: async (req, res, next) => {
    try {
      const ownedIds = await resolveOwnedGiftedStudentIds(req.user);
      const LIVE_STUDENT = ownedIds ? { ...LIVE, _id: { $in: ownedIds } } : LIVE;
      const LIVE_ACH = ownedIds ? { ...LIVE, student: { $in: ownedIds } } : LIVE;
      const LIVE_APP = ownedIds ? { ...LIVE, giftedStudent: { $in: ownedIds } } : LIVE;

      const YIL = currentAcademicYear();
      const YIL_YOLI = yearScorePath(YIL);

      const [
        studentsAgg,
        top,
        achByStatus,
        oldestPending,
        achByType,
        appAgg,
        rektorScholarships,
      ] = await Promise.all([
        GiftedStudent.aggregate([
          { $match: LIVE_STUDENT },
          {
            $facet: {
              total: [{ $count: "n" }],
              avgScore: [
                { $group: { _id: null, v: { $avg: { $ifNull: [`$${YIL_YOLI}`, 0] } } } },
              ],
              byFaculty: [
                { $match: { faculty: { $nin: [null, ""] } } },
                {
                  $group: {
                    _id: "$faculty",
                    n: { $sum: 1 },
                    avgScore: { $avg: { $ifNull: [`$${YIL_YOLI}`, 0] } },
                  },
                },
                { $sort: { n: -1 } },
                { $limit: 10 },
              ],
              byCourse: [
                { $match: { course: { $ne: null } } },
                { $group: { _id: "$course", n: { $sum: 1 } } },
                { $sort: { _id: 1 } },
              ],
            },
          },
        ]),

        GiftedStudent.find(LIVE_STUDENT)
          .sort(rankingSort(YIL))
          .limit(10)
          .select("fullName faculty course totalScore scoresByYear")
          .lean(),

        StudentAchievement.aggregate([
          { $match: LIVE_ACH },
          { $group: { _id: "$status", n: { $sum: 1 } } },
        ]),

        StudentAchievement.findOne({ ...LIVE_ACH, status: "pending" })
          .sort({ createdAt: 1 })
          .select("createdAt")
          .lean(),

        StudentAchievement.aggregate([
          { $match: { ...LIVE_ACH, documentType: { $ne: null } } },
          { $group: { _id: "$documentType", n: { $sum: 1 } } },
          { $sort: { n: -1 } },
          { $limit: 8 },
          {
            $lookup: {
              from: "documenttypes",
              localField: "_id",
              foreignField: "_id",
              as: "dt",
              pipeline: [{ $project: { title: 1 } }],
            },
          },
          { $unwind: { path: "$dt", preserveNullAndEmptyArrays: true } },
        ]),

        ScholarshipApplication.aggregate([
          { $match: LIVE_APP },
          {
            $facet: {
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
              byType: [
                {
                  $group: {
                    _id: { type: "$type", status: "$status" },
                    n: { $sum: 1 },
                  },
                },
              ],
            },
          },
        ]),

        Scholarship.find({ ...LIVE, type: "rektor" }).select("_id judges").lean(),
      ]);

      const sAgg = studentsAgg?.[0] ?? {};

      const achStatus = bosh(ARIZA_HOLATLARI);
      achByStatus.forEach((r) => {
        if (r._id in achStatus) achStatus[r._id] = r.n;
      });

      const appStatus = bosh(ARIZA_HOLATLARI);
      (appAgg?.[0]?.byStatus ?? []).forEach((r) => {
        if (r._id in appStatus) appStatus[r._id] = r.n;
      });

      const turMap = new Map(
        ARIZA_TURLARI.map((t) => [t, { type: t, total: 0, ...bosh(ARIZA_HOLATLARI) }]),
      );
      (appAgg?.[0]?.byType ?? []).forEach((r) => {
        const t = turMap.get(r._id?.type);
        if (!t) return;
        t.total += r.n;
        if (r._id?.status in t) t[r._id.status] += r.n;
      });

      const judgeCount = Math.max(0, ...rektorScholarships.map((s) => (s.judges ?? []).length));
      const rektorApps = await ScholarshipApplication.find({
        ...LIVE_APP,
        type: "rektor_stipendiyasi",
      })
        .select("judgeScores")
        .lean();
      const fullyScored = judgeCount
        ? rektorApps.filter((a) => (a.judgeScores ?? []).length >= judgeCount).length
        : 0;

      return res.status(200).json({
        students: {
          total: sAgg.total?.[0]?.n ?? 0,
          avgScore:
            sAgg.avgScore?.[0]?.v != null ? Math.round(sAgg.avgScore[0].v * 10) / 10 : null,
          byFaculty: (sAgg.byFaculty ?? []).map((f) => ({
            faculty: f._id,
            count: f.n,
            avgScore: f.avgScore != null ? Math.round(f.avgScore * 10) / 10 : null,
          })),
          byCourse: (sAgg.byCourse ?? []).map((c) => ({ course: c._id, count: c.n })),
          top: top.map((t) => ({
            fullName: t.fullName,
            faculty: t.faculty ?? null,
            course: t.course ?? null,
            yearScore: yearScoreOf(t, YIL),
            totalScore: t.totalScore ?? 0,
          })),
        },
        achievements: {
          byStatus: achStatus,
          pending: {
            count: achStatus.pending,
            oldestDays: oldestPending?.createdAt ? kunFarq(oldestPending.createdAt) : null,
          },
          byType: (achByType ?? [])
            .map((r) => ({ type: r.dt?.title ?? null, count: r.n }))
            .filter((r) => r.type),
        },
        scholarships: {
          byStatus: appStatus,
          byType: [...turMap.values()].filter((t) => t.total > 0),
        },
        rektorJudging: {
          total: rektorApps.length,
          fullyScored,
          awaiting: rektorApps.length - fullyScored,
          judgeCount,
        },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
