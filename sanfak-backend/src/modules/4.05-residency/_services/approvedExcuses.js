"use strict";

const Attendance = require("#modules/4.05-residency/attendance/attendance.model");
const ResidentApplication = require("#modules/4.05-residency/residentApplication/residentApplication.model");

const APPROVED = "tasdiqlangan";
const EXCUSE_FALLBACK_REASON = "Ariza asosida";

function approvedExcuseQuery(residentIds) {
  return {
    resident: { $in: residentIds },
    status: APPROVED,
    fromDate: { $ne: null },
    toDate: { $ne: null },
  };
}

function excusePatch(app) {
  return {
    status: "excused",
    excuseReason: app.reason || EXCUSE_FALLBACK_REASON,
    excuseApprovedBy: app.reviewedBy,
    fromDate: app.fromDate,
    toDate: app.toDate,
    application: app._id,
  };
}

const timeOf = (value) => (value === null || value === undefined ? NaN : new Date(value).getTime());

function coveringExcuse(apps, date) {
  const t = timeOf(date);
  if (Number.isNaN(t)) return null;
  return (apps || []).find((a) => timeOf(a.fromDate) <= t && t <= timeOf(a.toDate)) ?? null;
}

async function applyApprovedExcuses(residentId) {
  const approved = await ResidentApplication.find(approvedExcuseQuery([residentId]))
    .select("reason fromDate toDate reviewedBy")
    .sort({ createdAt: 1 });

  for (const app of approved) {
    await Attendance.updateMany(
      {
        resident: residentId,
        status: "absent",
        active: true,
        date: { $gte: app.fromDate, $lte: app.toDate },
      },
      excusePatch(app),
    );
  }
}

module.exports = {
  APPROVED,
  approvedExcuseQuery,
  excusePatch,
  coveringExcuse,
  applyApprovedExcuses,
};
