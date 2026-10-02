"use strict";

const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const { workingPlanYearTotals } = require("#modules/4.02-studyLoad/_pdf/workingPlan.pdf");

async function workingPlanTotalHoursBySchedule(scheduleIds) {
  const out = new Map();
  if (!scheduleIds.length) return out;
  const plans = await WorkingPlanModel.find({ workingSchedule: { $in: scheduleIds } })
    .select("workingSchedule semesters")
    .lean()
    .exec();
  for (const plan of plans || []) {
    const key = String(plan.workingSchedule);
    if (out.has(key)) continue;
    out.set(key, workingPlanYearTotals(plan.semesters).umu);
  }
  return out;
}

module.exports = { workingPlanTotalHoursBySchedule };
