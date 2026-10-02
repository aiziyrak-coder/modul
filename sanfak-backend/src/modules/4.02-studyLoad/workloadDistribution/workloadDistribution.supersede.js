"use strict";

const Workload = require("#modules/4.02-studyLoad/workload/workload.model");
const WorkloadDistribution = require("./workloadDistribution.model");

async function supersedePreviousDistributions(dist) {
  const workload = await Workload.findById(dist.workload, "_id department academicYear", {
    lean: true,
  });
  if (!workload) return 0;

  const oldWorkloadIds = await Workload.distinct("_id", {
    _id: { $ne: workload._id },
    department: workload.department,
    academicYear: workload.academicYear,
    status: "superseded",
  });
  if (!Array.isArray(oldWorkloadIds) || oldWorkloadIds.length === 0) return 0;

  const res = await WorkloadDistribution.updateMany(
    {
      _id: { $ne: dist._id },
      workload: { $in: oldWorkloadIds },
      status: { $ne: "superseded" },
    },
    {
      $set: {
        status: "superseded",
        active: false,
        supersededBy: dist._id,
        supersededAt: new Date(),
      },
    },
  );
  return res?.modifiedCount ?? res?.nModified ?? 0;
}

module.exports = { supersedePreviousDistributions };
