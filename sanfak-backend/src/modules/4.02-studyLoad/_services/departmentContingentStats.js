"use strict";

const winston = require("#shared/winston.logger");
const { getGroupStats } = require("./groupStatsResolver");
const { resolveScheduleGroups } = require("./scheduleGroupsResolver");
const {
  applyStreamPartition,
  findRow,
} = require("#modules/4.02-studyLoad/departmentContingent/departmentContingent.derive");

const contingentModel = () =>
  require("#modules/4.02-studyLoad/departmentContingent/departmentContingent.model");
const groupModel = () => require("#references/group/group.model");

async function activeGroupIds(groupIds) {
  if (!groupIds || groupIds.length === 0) return [];
  return groupModel().find({ _id: { $in: groupIds }, active: true }).distinct("_id");
}

function loadContingent({ department, academicYear }) {
  if (!department || !academicYear) return Promise.resolve(null);
  return contingentModel()
    .findOne({ department, academicYear, active: true })
    .select("rows")
    .lean();
}

function createScheduleStatsResolver(ctx) {
  let docPromise = null;
  const doc = () => {
    if (!docPromise) docPromise = loadContingent(ctx);
    return docPromise;
  };
  return async (schedule) => {
    const groupIds = await resolveScheduleGroups(schedule);
    const base = await getGroupStats(groupIds);
    const row = findRow(await doc(), schedule.direction, schedule.courseRef);
    if (!row) return { ...base, contingent: { source: "none" } };
    const stats = applyStreamPartition(base, row, await activeGroupIds(groupIds));
    if (stats.contingent.source === "stale") {
      winston.warn(
        `[departmentContingent] eskirgan qator: kafedra=${ctx.department} yil=${ctx.academicYear} ` +
          `yo'nalish=${schedule.direction} kurs=${schedule.currentCourse} — hozirgi qoida qo'llandi`,
      );
    }
    return stats;
  };
}

function contingentWarnings(stats, schedule, extra = {}) {
  if (stats?.contingent?.source !== "stale") return [];
  return [
    {
      code: "CONTINGENT_STALE",
      message:
        `Kafedra kontingentidagi ${schedule.currentCourse}-kurs qatori guruhlar ` +
        `ro'yxatiga mos emas (guruh qo'shilgan yoki o'chirilgan) — oqimlar soni ` +
        `hozirgi qoida («1 til = 1 oqim») bo'yicha olindi. Kontingentni yangilang.`,
      ...extra,
    },
  ];
}

module.exports = { createScheduleStatsResolver, activeGroupIds, contingentWarnings };
