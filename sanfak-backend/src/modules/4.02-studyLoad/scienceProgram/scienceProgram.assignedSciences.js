"use strict";

const mongoose = require("mongoose");
const WorkloadDistModel = require("#modules/4.02-studyLoad/workloadDistribution/workloadDistribution.model");

async function resolveAssignedScienceIds(userId) {
  if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) return [];
  const me = new mongoose.Types.ObjectId(String(userId));
  const rows = await WorkloadDistModel.aggregate([
    { $match: { "teachers.teacher": me } },
    { $unwind: "$teachers" },
    {
      $match: {
        "teachers.teacher": me,
        "teachers.isVacant": { $ne: true },
        "teachers.acceptanceStatus": { $in: ["accepted", "pending"] },
      },
    },
    { $unwind: "$teachers.blocks" },
    {
      $match: {
        "teachers.blocks.type": "lesson",
        "teachers.blocks.science": { $ne: null },
      },
    },
    { $group: { _id: null, ids: { $addToSet: "$teachers.blocks.science" } } },
  ]);
  return rows.length && Array.isArray(rows[0].ids) ? rows[0].ids : [];
}

module.exports = { resolveAssignedScienceIds };
