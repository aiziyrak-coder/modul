"use strict";

const winston = require("#shared/winston.logger");

async function resolveScheduleGroups(schedule, { persist = true } = {}) {
  if (!schedule) return [];

  const snapshot = schedule.groups || [];
  if (snapshot.length) return snapshot;

  if (!schedule.direction || !schedule.courseRef || !schedule.academicYear) {
    return [];
  }

  const GroupModel = require("#references/group/group.model");

  const groupIds = await GroupModel.find({
    direction: schedule.direction,
    course: schedule.courseRef,
    academicYear: schedule.academicYear,
    active: true,
  }).distinct("_id");

  if (!groupIds.length) return [];

  winston.info(
    `[scheduleGroups] bo'sh surat tiklandi: schedule=${schedule._id} ` +
      `guruh=${groupIds.length} (kontingent ishchi rejadan KEYIN kiritilgan)`,
  );

  if (persist && schedule._id) {
    try {
      const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
      await WorkingScheduleModel.updateOne(
        { _id: schedule._id },
        { $set: { groups: groupIds } },
      );
    } catch (err) {
      winston.warn(
        `[scheduleGroups] suratni yozib bo'lmadi (schedule=${schedule._id}): ${err.message}`,
      );
    }
  }

  return groupIds;
}

module.exports = { resolveScheduleGroups };
