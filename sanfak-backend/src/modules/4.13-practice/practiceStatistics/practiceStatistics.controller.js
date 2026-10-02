"use strict";

const winston = require("#shared/winston.logger");

const Practice = require("#modules/4.13-practice/practice/practice.model");
const MedicalOrganization = require("#modules/4.13-practice/medicalOrganization/medicalOrganization.model");
const PracticeStudent = require("#modules/4.13-practice/student/student.model");

const LIVE = { active: true };
const STATUSLAR = ["draft", "in_progress", "rektor_approved", "both_approved", "rejected"];

const bosh = (kalitlar) => Object.fromEntries(kalitlar.map((k) => [k, 0]));

module.exports = {
  overview: async (req, res, next) => {
    try {
      const now = new Date();
      const oyOxiri = new Date(now.getTime() + 30 * 86_400_000);

      const [agg, orgTotal, studentTotal] = await Promise.all([
        Practice.aggregate([
          { $match: LIVE },
          {
            $facet: {
              total: [{ $count: "n" }],
              byStatus: [{ $group: { _id: "$status", n: { $sum: 1 } } }],
              endingSoon: [
                {
                  $match: {
                    status: "both_approved",
                    endDate: { $gte: now, $lte: oyOxiri },
                  },
                },
                { $count: "n" },
              ],
            },
          },
        ]),
        MedicalOrganization.countDocuments(LIVE),
        PracticeStudent.countDocuments(LIVE),
      ]);

      const a = agg?.[0] ?? {};
      const byStatus = bosh(STATUSLAR);
      (a.byStatus ?? []).forEach((r) => {
        if (r._id in byStatus) byStatus[r._id] = r.n;
      });

      return res.status(200).json({
        contracts: {
          total: a.total?.[0]?.n ?? 0,
          byStatus,
          awaitingRector: byStatus.in_progress,
          endingSoon: a.endingSoon?.[0]?.n ?? 0,
        },
        organizations: { total: orgTotal },
        students: { total: studentTotal },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
