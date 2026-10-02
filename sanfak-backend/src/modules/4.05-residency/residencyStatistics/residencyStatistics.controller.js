"use strict";

const winston = require("#shared/winston.logger");
const {
  residentIdsFor,
} = require("#modules/4.05-residency/_services/residentScope");

const Resident = require("#modules/4.05-residency/resident/resident.model");
const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const AttestationResult = require("#modules/4.05-residency/residencyAttestation/residencyAttestationResult.model");
const ActivityPlan = require("#modules/4.05-residency/activityPlan/activityPlan.model");
const DissertationPlan = require("#modules/4.05-residency/dissertationPlan/dissertationPlan.model");

const LIVE = { active: true };

const PROGRAMS = ["magistratura", "ordinatura"];
const FUNDING = ["byudjet", "shartnoma"];
const DAVOMAT = ["present", "absent", "excused"];
const REJA_HOLATLARI = ["yangi", "yuborilgan", "jarayonda", "rad_etilgan", "bajarilgan"];
const OY = ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"];

const BAHO_CHEGARALARI = [
  { nom: "alo", min: 86 },
  { nom: "yaxshi", min: 71 },
  { nom: "qoniqarli", min: 56 },
  { nom: "qoniqarsiz", min: 0 },
];

const bosh = (kalitlar) => Object.fromEntries(kalitlar.map((k) => [k, 0]));
const foiz = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

async function rejaHolati(Model, byResident) {
  if (!byResident) throw new Error("rejaHolati: `byResident` majburiy");
  const rows = await Model.aggregate([
    { $match: { ...LIVE, ...byResident } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const out = bosh(REJA_HOLATLARI);
  let total = 0;
  rows.forEach((r) => {
    total += r.n;
    if (r._id in out) out[r._id] = r.n;
  });
  return { total, ...out };
}

module.exports = {
  overview: async (req, res, next) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();

      const ids = await residentIdsFor(req.user);
      const byId = ids === null ? {} : { _id: { $in: ids } };
      const byResident = ids === null ? {} : { resident: { $in: ids } };

      const [
        contingentAgg,
        attAgg,
        attestAgg,
        riskAgg,
        xavfTop,
        activity,
        dissertation,
      ] = await Promise.all([
        Resident.aggregate([
          { $match: { ...LIVE, ...byId } },
          {
            $facet: {
              total: [{ $count: "n" }],
              byProgram: [{ $group: { _id: "$program", n: { $sum: 1 } } }],
              byFunding: [{ $group: { _id: "$fundingType", n: { $sum: 1 } } }],
              bySpecialty: [
                { $match: { specialtyTitle: { $nin: [null, ""] } } },
                { $group: { _id: "$specialtyTitle", n: { $sum: 1 } } },
                { $sort: { n: -1 } },
                { $limit: 8 },
              ],
            },
          },
        ]),

        Attendance.aggregate([
          { $match: { ...LIVE, deletedAt: null, ...byResident } },
          {
            $facet: {
              total: [{ $count: "n" }],
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
              monthly: [
                {
                  $match: {
                    date: {
                      $gte: new Date(year, 0, 1),
                      $lte: new Date(year, 11, 31, 23, 59, 59, 999),
                    },
                  },
                },
                {
                  $group: {
                    _id: { $month: "$date" },
                    total: { $sum: 1 },
                    present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
                  },
                },
              ],
            },
          },
        ]),

        AttestationResult.aggregate([
          { $match: { ...LIVE, included: true, score: { $ne: null }, ...byResident } },
          {
            $group: {
              _id: null,
              n: { $sum: 1 },
              avg: { $avg: "$score" },
              alo: { $sum: { $cond: [{ $gte: ["$score", 86] }, 1, 0] } },
              yaxshi: {
                $sum: {
                  $cond: [{ $and: [{ $gte: ["$score", 71] }, { $lt: ["$score", 86] }] }, 1, 0],
                },
              },
              qoniqarli: {
                $sum: {
                  $cond: [{ $and: [{ $gte: ["$score", 56] }, { $lt: ["$score", 71] }] }, 1, 0],
                },
              },
              qoniqarsiz: { $sum: { $cond: [{ $lt: ["$score", 56] }, 1, 0] } },
            },
          },
        ]),

        Resident.aggregate([
          { $match: { ...LIVE, ...byId } },
          {
            $group: {
              _id: null,
              warned: { $sum: { $cond: ["$warningIssued", 1, 0] } },

              expelled: { $sum: { $cond: ["$expulsionOrderCreated", 1, 0] } },
              draftCount: { $sum: { $cond: ["$expulsionOrderCreated", 1, 0] } },
              expelledCount: {
                $sum: { $cond: [{ $eq: ["$status", "chetlatilgan"] }, 1, 0] },
              },
            },
          },
        ]),

        Resident.find({ ...LIVE, ...byId, totalUnexcusedHours: { $gt: 0 } })
          .sort({ totalUnexcusedHours: -1 })
          .limit(5)
          .select(
            "fullName totalUnexcusedHours warningIssued expulsionOrderCreated status",
          )
          .lean(),

        rejaHolati(ActivityPlan, byResident),
        rejaHolati(DissertationPlan, byResident),
      ]);

      const cAgg = contingentAgg?.[0] ?? {};
      const aAgg = attAgg?.[0] ?? {};
      const est = attestAgg?.[0] ?? null;
      const risk = riskAgg?.[0] ?? { warned: 0, expelled: 0 };

      const byProgram = bosh(PROGRAMS);
      (cAgg.byProgram ?? []).forEach((r) => {
        if (r._id in byProgram) byProgram[r._id] = r.n;
      });

      const byFunding = bosh(FUNDING);
      (cAgg.byFunding ?? []).forEach((r) => {
        if (r._id in byFunding) byFunding[r._id] = r.n;
      });

      const attStatus = bosh(DAVOMAT);
      (aAgg.byStatus ?? []).forEach((r) => {
        if (r._id in attStatus) attStatus[r._id] = r.n;
      });
      const attTotal = aAgg.total?.[0]?.n ?? 0;

      const oyMap = new Map((aAgg.monthly ?? []).map((r) => [r._id, r]));
      const monthly = OY.map((nom, i) => {
        const r = oyMap.get(i + 1);
        return {
          month: nom,
          total: r?.total ?? 0,
          presentPercent: r ? foiz(r.present, r.total) : 0,
        };
      });

      return res.status(200).json({
        contingent: {
          total: cAgg.total?.[0]?.n ?? 0,
          byProgram,
          byFunding,
          bySpecialty: (cAgg.bySpecialty ?? []).map((s) => ({ specialty: s._id, count: s.n })),
        },
        attendance: {
          total: attTotal,
          byStatus: attStatus,
          presentPercent: foiz(attStatus.present, attTotal),
          monthly,
        },
        attestation: {
          count: est?.n ?? 0,
          avgScore: est?.avg != null ? Math.round(est.avg * 10) / 10 : null,
          byGrade: {
            alo: est?.alo ?? 0,
            yaxshi: est?.yaxshi ?? 0,
            qoniqarli: est?.qoniqarli ?? 0,
            qoniqarsiz: est?.qoniqarsiz ?? 0,
          },
          thresholds: BAHO_CHEGARALARI,
        },
        risk: {
          warned: risk.warned ?? 0,
          expelled: risk.expelled ?? 0,
          draftCount: risk.draftCount ?? 0,
          expelledCount: risk.expelledCount ?? 0,
          top: xavfTop.map((r) => ({
            fullName: r.fullName,
            hours: r.totalUnexcusedHours ?? 0,
            warned: !!r.warningIssued,
            expelled: !!r.expulsionOrderCreated,
            hasDraft: !!r.expulsionOrderCreated,
            status: r.status ?? null,
          })),
        },
        plans: { activity, dissertation },
        period: { year },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
