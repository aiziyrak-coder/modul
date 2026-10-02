"use strict";

const winston = require("#shared/winston.logger");
const {
  safeDispatch,
  safeDispatchMany,
  getDepartmentHeadUserIds,
} = require("#modules/4.02-studyLoad/_shared/chainNotify");
const Science = require("#references/science/science.model");

const personName = (user) =>
  [user?.lastName, user?.firstName].filter(Boolean).join(" ") || "O'qituvchi";

async function notifyTeacherAssigned({ teacherUserId, distributionId, science, hours }) {
  if (!teacherUserId) return;
  try {
    const sci = science
      ? await Science.findById(science).select("title scienceCode").lean()
      : null;
    const name = sci?.title || "Fan";
    await safeDispatch({
      userId: teacherUserId,
      eventType: "workload_assigned",
      title: "Sizga yuklama biriktirildi",
      body: `«${name}» — ${hours || 0} soat. Qabul qilish yoki rad etish uchun «O'quv yuklamalar» sahifasiga o'ting.`,
      link: "/study-load/my-workloads",
      metadata: { distributionId, science: science || null, hours: hours || 0 },
    });
  } catch (err) {
    winston.warn(`[WorkloadDistribution] workload_assigned notification xato: ${err.message}`);
  }
}

async function notifyHeadsTeacherResponded(p) {
  try {
    const heads = await getDepartmentHeadUserIds(p.dist?.department);
    if (!heads.length) return;
    await safeDispatchMany(heads, buildRespondedPayload(p));
  } catch (err) {
    winston.warn(`[WorkloadDistribution] teacher respond notification xato: ${err.message}`);
  }
}

function buildRespondedPayload({ dist, entry, action, reason, actor }) {
  const who = personName(actor);
  const byAction =
    action === "rejected"
      ? {
          eventType: "workload_rejected",
          title: `O'qituvchi yuklamani rad etdi — ${who}`,
          body: reason || "Sabab ko'rsatilmagan",
        }
      : {
          eventType: "workload_approved",
          title: `O'qituvchi yuklamani qabul qildi — ${who}`,
          body: `${dist.title || "Taqsimot"} — biriktirilgan fanlar qabul qilindi.`,
        };
  return {
    ...byAction,
    link: `/study-load/distributions/${dist._id}`,
    metadata: { distributionId: dist._id, entryId: entry._id, teacher: actor?._id, action },
  };
}

module.exports = { notifyTeacherAssigned, notifyHeadsTeacherResponded, personName };
