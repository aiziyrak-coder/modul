"use strict";

const winston = require("#shared/winston.logger");

const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const PersonalWorkPlan = require("#modules/4.03-teacher/personalWorkPlan/personalWorkPlan.model");

const LIVE = { active: true };

const DARAJA = ["fan_nomzodi", "fan_doktori", "falsafa_doktori"];
const UNVON = ["dotsent", "professor", "katta_ilmiy_xodim"];
const BANDLIK = ["asosiy", "ichki_sovmestitel", "tashqi_sovmestitel", "soatbay"];
const REJA_HOLATLARI = ["draft", "submitted", "approved", "rejected", "completed"];
const BOLIMLAR = ["methodicalWork", "researchWork", "mentoringWork", "organizationalWork", "extraWork"];

const bosh = (k) => Object.fromEntries(k.map((x) => [x, 0]));
const foiz = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

module.exports = {
  overview: async (req, res, next) => {
    try {
      const [tAgg, planAgg, rejaEgalari, ishAgg] = await Promise.all([
        TeacherProfile.aggregate([
          { $match: LIVE },
          {
            $facet: {
              total: [{ $count: "n" }],
              byDegree: [{ $group: { _id: "$academicDegree", n: { $sum: 1 } } }],
              byTitle: [{ $group: { _id: "$academicTitle", n: { $sum: 1 } } }],
              byEmployment: [{ $group: { _id: "$employmentType", n: { $sum: 1 } } }],
              pending: [{ $match: { hrApprovalStatus: { $ne: "approved" } } }, { $count: "n" }],
              hIndex: [{ $group: { _id: null, v: { $avg: "$hIndex" } } }],
            },
          },
        ]),

        PersonalWorkPlan.aggregate([
          { $match: LIVE },
          {
            $facet: {
              total: [{ $count: "n" }],
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
            },
          },
        ]),

        PersonalWorkPlan.distinct("teacher", LIVE),

        PersonalWorkPlan.aggregate([
          { $match: LIVE },
          {
            $project: {
              items: {
                $concatArrays: BOLIMLAR.map((b) => ({ $ifNull: [`$${b}`, []] })),
              },
            },
          },
          { $unwind: "$items" },
          { $group: { _id: "$items.status", n: { $sum: 1 } } },
        ]),
      ]);

      const t = tAgg?.[0] ?? {};
      const p = planAgg?.[0] ?? {};

      const total = t.total?.[0]?.n ?? 0;

      const byDegree = { ...bosh(DARAJA), none: 0 };
      (t.byDegree ?? []).forEach((r) => {
        if (r._id && r._id in byDegree) byDegree[r._id] = r.n;
        else byDegree.none += r.n;
      });
      const darajali = DARAJA.reduce((s, k) => s + byDegree[k], 0);

      const byTitle = { ...bosh(UNVON), none: 0 };
      (t.byTitle ?? []).forEach((r) => {
        if (r._id && r._id in byTitle) byTitle[r._id] = r.n;
        else byTitle.none += r.n;
      });

      const byEmployment = bosh(BANDLIK);
      (t.byEmployment ?? []).forEach((r) => {
        if (r._id in byEmployment) byEmployment[r._id] = r.n;
      });

      const byStatus = bosh(REJA_HOLATLARI);
      (p.byStatus ?? []).forEach((r) => {
        if (r._id in byStatus) byStatus[r._id] = r.n;
      });

      const ish = { planned: 0, completed: 0, overdue: 0, cancelled: 0 };
      (ishAgg ?? []).forEach((r) => {
        if (r._id in ish) ish[r._id] = r.n;
      });
      const ishJami = ish.planned + ish.completed + ish.overdue + ish.cancelled;

      return res.status(200).json({
        teachers: {
          total,
          byDegree,
          byTitle,
          byEmployment,
          degreeRatio: foiz(darajali, total),
          profilePending: t.pending?.[0]?.n ?? 0,
          avgHIndex: t.hIndex?.[0]?.v != null ? Math.round(t.hIndex[0].v * 10) / 10 : 0,
        },
        workPlans: {
          total: p.total?.[0]?.n ?? 0,
          byStatus,
          missing: Math.max(0, total - (rejaEgalari?.length ?? 0)),
          overdueItems: ish.overdue,
          completedItems: ish.completed,
          itemsTotal: ishJami,
          completionPercent: foiz(ish.completed, ishJami),
        },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
