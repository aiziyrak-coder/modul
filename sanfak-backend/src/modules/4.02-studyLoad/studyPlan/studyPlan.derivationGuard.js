const WorkingPlanModel = require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");

async function countDerivedWorkingPlans(studyPlanIds) {
  const ids = (
    Array.isArray(studyPlanIds) ? studyPlanIds : [studyPlanIds]
  ).filter(Boolean);
  if (ids.length === 0) return 0;

  return WorkingPlanModel.countDocuments({ studyPlan: { $in: ids } });
}

module.exports = { countDerivedWorkingPlans };
