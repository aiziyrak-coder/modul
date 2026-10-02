"use strict";

const { ErrorHandler } = require("#shared/error");
const WorkingScheduleModel = require("./workingSchedule.model");
const { isLocked, lockedMessage } = require("#modules/4.02-studyLoad/_shared/editableStatus");
const {
  planCourses,
  buildCoursesUpdate,
  monthCounts,
} = require("#modules/4.02-studyLoad/_shared/monthWeeks");

const updateWorkingScheduleMonthWeeks = async ({ id, filter, counts }) => {
  const doc = await WorkingScheduleModel.findOne({ _id: id, ...(filter || {}) })
    .select("status courses")
    .lean();
  if (!doc) throw new ErrorHandler(404, "Topilmadi");
  if (isLocked(doc.status)) {
    throw new ErrorHandler(400, lockedMessage("Ishchi o'quv reja", doc.status));
  }
  const plans = planCourses(doc.courses, counts);
  if (!plans.length) throw new ErrorHandler(400, "Hujjatda kurs yo'q");
  const { update, arrayFilters } = buildCoursesUpdate(plans);
  await WorkingScheduleModel.updateOne({ _id: id }, update, { arrayFilters });
  return { months: monthCounts(plans[0]), updatedCourses: plans.length };
};

module.exports = { updateWorkingScheduleMonthWeeks };
