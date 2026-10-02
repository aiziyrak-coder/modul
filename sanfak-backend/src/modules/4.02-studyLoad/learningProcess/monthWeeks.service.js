"use strict";

const { ErrorHandler } = require("#shared/error");
const LearningProcess = require("./learningProcess.model");
const WorkingScheduleModel = require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const { isLocked } = require("#modules/4.02-studyLoad/_shared/editableStatus");
const {
  planCourses,
  buildCoursesUpdate,
  monthCounts,
} = require("#modules/4.02-studyLoad/_shared/monthWeeks");

const applyToSchedules = async (learningProcessId, counts) => {
  const out = { updated: 0, skippedLocked: 0, errors: [] };
  const list = await WorkingScheduleModel.find({ learningProcess: learningProcessId })
    .select("status courses title")
    .lean();
  for (const ws of list) {
    if (isLocked(ws.status)) {
      out.skippedLocked += 1;
      continue;
    }
    try {
      const plans = planCourses(ws.courses, counts);
      if (!plans.length) continue;
      const { update, arrayFilters } = buildCoursesUpdate(plans);
      await WorkingScheduleModel.updateOne({ _id: ws._id }, update, { arrayFilters });
      out.updated += 1;
    } catch (e) {
      out.errors.push(`${ws.title || ws._id}: ${e.message}`);
    }
  }
  return out;
};

const updateLearningProcessMonthWeeks = async ({
  id,
  scope,
  counts,
  applyToDraftSchedules = true,
}) => {
  const doc = await LearningProcess.findOne({ _id: id, ...(scope || {}) })
    .select("courses")
    .lean();
  if (!doc) throw new ErrorHandler(404, "Topilmadi");
  const plans = planCourses(doc.courses, counts);
  if (!plans.length) throw new ErrorHandler(400, "Hujjatda kurslar yo'q");
  const { update, arrayFilters } = buildCoursesUpdate(plans);
  await LearningProcess.updateOne({ _id: id }, update, { arrayFilters });

  const schedules = applyToDraftSchedules
    ? await applyToSchedules(id, counts)
    : { updated: 0, skippedLocked: 0, errors: [] };

  return { months: monthCounts(plans[0]), updatedCourses: plans.length, schedules };
};

module.exports = { updateLearningProcessMonthWeeks, applyToSchedules };
