"use strict";

const mongoose = require("mongoose");
const Model = require("./departmentContingent.model");
const { idStr, rowGroupIds, rowDerived } = require("./departmentContingent.derive");

const groupModel = () => require("#references/group/group.model");
const scheduleModel = () =>
  require("#modules/4.02-studyLoad/workingSchedule/workingSchedule.model");
const planModel = () => require("#modules/4.02-studyLoad/workingPlan/workingPlan.model");
const departmentModel = () => require("#references/department/department.model");

const oid = (v) => new mongoose.Types.ObjectId(String(v));

function loadCohorts(academicYear) {
  return groupModel().aggregate([
    { $match: { academicYear: oid(academicYear), active: true } },
    {
      $group: {
        _id: { direction: "$direction", course: "$course" },
        groupCount: { $sum: 1 },
        studentCount: { $sum: { $ifNull: ["$studentNumber", 0] } },
      },
    },
    { $lookup: { from: "directions", localField: "_id.direction", foreignField: "_id", as: "dir" } },
    { $lookup: { from: "courses", localField: "_id.course", foreignField: "_id", as: "crs" } },
    {
      $project: {
        _id: 0,
        direction: "$_id.direction",
        directionTitle: { $first: "$dir.title" },
        course: "$_id.course",
        courseId: "$_id.course",
        courseTitle: { $first: "$crs.title" },
        groupCount: 1,
        studentCount: 1,
      },
    },
    { $sort: { directionTitle: 1, courseTitle: 1 } },
  ]);
}

const sciencesOf = (plan) =>
  Object.values(plan?.semesters || {})
    .flatMap((sem) => sem?.blocks || [])
    .flatMap((block) => block?.sciences || []);

async function expectedDepartmentIds(academicYear) {
  const schedules = await scheduleModel()
    .find({ academicYear, status: "approved", active: true })
    .select("_id")
    .lean();
  if (!schedules.length) return [];
  const plans = await planModel()
    .find({ workingSchedule: { $in: schedules.map((s) => s._id) } })
    .select("semesters")
    .lean();
  return [...new Set(plans.flatMap(sciencesOf).map((s) => idStr(s?.department)).filter(Boolean))];
}

function departmentBlock(doc, groupsById) {
  return {
    department: doc.department,
    updatedAt: doc.updatedAt,
    rows: (doc.rows || []).map((row) => ({
      direction: row.direction,
      courseNum: row.courseNum,
      courseId: row.course,
      ...rowDerived(row, groupsById),
    })),
  };
}

async function loadStudentCounts(docs) {
  const ids = [...new Set(docs.flatMap((d) => (d.rows || []).flatMap(rowGroupIds)))];
  if (!ids.length) return new Map();
  const groups = await groupModel().find({ _id: { $in: ids } }).select("studentNumber").lean();
  return new Map(groups.map((g) => [idStr(g._id), g]));
}

async function missingDepartments(expectedIds, presentIds) {
  const present = new Set(presentIds.map(idStr));
  const missing = expectedIds.filter((id) => !present.has(id));
  if (!missing.length) return [];
  return departmentModel().find({ _id: { $in: missing } }).select("title").sort({ title: 1 }).lean();
}

async function buildSummary({ academicYear }) {
  const docs = await Model.find({ academicYear, active: true })
    .populate("department", "title")
    .populate("rows.direction", "title")
    .lean();
  const [groupsById, cohorts, expected] = await Promise.all([
    loadStudentCounts(docs),
    loadCohorts(academicYear),
    expectedDepartmentIds(academicYear),
  ]);
  const presentIds = docs.map((d) => d.department?._id ?? d.department);
  return {
    departments: docs.map((d) => departmentBlock(d, groupsById)),
    cohorts,
    missingDepartments: await missingDepartments(expected, presentIds),
    totals: { withContingent: docs.length, expected: expected.length },
  };
}

module.exports = { buildSummary, expectedDepartmentIds, sciencesOf, departmentBlock, loadCohorts };
