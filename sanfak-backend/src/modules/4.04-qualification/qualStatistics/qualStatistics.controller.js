"use strict";

const winston = require("#shared/winston.logger");

const QualCourseModel = require("#modules/4.04-qualification/qualCourse/qualCourse.model");
const QualCourseSubscriptionModel = require("#modules/4.04-qualification/qualCourseSubscription/qualCourseSubscription.model");
const QualPaymentModel = require("#modules/4.04-qualification/qualPayment/qualPayment.model");
const QualEarnedCertificateModel = require("#modules/4.04-qualification/_shared/qualEarnedCertificate.model");

const PAYMENT_CONFIRMED = 2;
const FORM_ONLINE = 1;
const FORM_OFFLINE = 2;
const KIND_CERTIFICATE = 1;

async function paidSum(from, to) {
  const match = { status: PAYMENT_CONFIRMED };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = from;
    if (to) match.date.$lte = to;
  }
  const [row] = await QualPaymentModel.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$price" } } },
  ]);
  return row ? row.total : 0;
}

module.exports = {
  overview: async (req, res, next) => {
    try {
      const now = new Date();
      const year = Number(req.query.year) || now.getUTCFullYear();
      const month = Number(req.query.month) || now.getUTCMonth() + 1;

      if (month < 1 || month > 12) {
        return res.status(400).json({ message: "month 1..12 oralig'ida bo'lishi kerak" });
      }

      const monthFrom = new Date(Date.UTC(year, month - 1, 1));
      const monthTo = new Date(Date.UTC(year, month, 1) - 1);
      const yearFrom = new Date(Date.UTC(year, 0, 1));
      const yearTo = new Date(Date.UTC(year + 1, 0, 1) - 1);

      const [
        onlineCourses,
        offlineCourses,
        acceptedListeners,
        certificates,
        monthPaid,
        yearPaid,
        totalPaid,
      ] = await Promise.all([
        QualCourseModel.countDocuments({ form: FORM_ONLINE, active: true }),
        QualCourseModel.countDocuments({ form: FORM_OFFLINE, active: true }),
        QualCourseSubscriptionModel.countDocuments({}),
        QualEarnedCertificateModel.countDocuments({ kind: KIND_CERTIFICATE }),
        paidSum(monthFrom, monthTo),
        paidSum(yearFrom, yearTo),
        paidSum(null, null),
      ]);

      return res.status(200).json({
        onlineCourses,
        offlineCourses,
        acceptedListeners,
        certificates,
        payments: { month: monthPaid, year: yearPaid, total: totalPaid },
        period: { year, month },
      });
    } catch (error) {
      winston.error(error.message);
      return next(error);
    }
  },
};
