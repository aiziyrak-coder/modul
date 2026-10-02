"use strict";

const mongoose = require("mongoose");
const { ErrorHandler } = require("#shared/error");
const { resolveCourse } = require("#references/_services/courseResolver");
const Model = require("./departmentContingent.model");
const {
  idStr,
  rowGroupIds,
  rowProblems,
  rowDerived,
  streamLanguages,
  suggestStreams,
} = require("./departmentContingent.derive");

const groupModel = () => require("#references/group/group.model");
const workloadModel = () => require("#modules/4.02-studyLoad/workload/workload.model");

const GROUP_FIELDS = "title direction course academicYear active lang studentNumber";

function writerDepartment(scope) {
  const department = scope?.department;
  if (!department || !mongoose.isValidObjectId(department)) {
    throw new ErrorHandler(403, "Kafedra kontingentini faqat kafedra kiritadi");
  }
  return department;
}

async function loadGroups(ids) {
  if (!ids.length) return new Map();
  const groups = await groupModel()
    .find({ _id: { $in: ids } })
    .select(GROUP_FIELDS)
    .populate("lang", "title")
    .lean();
  return new Map(groups.map((g) => [idStr(g._id), g]));
}

async function markWorkloadsForRecalc({ department, academicYear }) {
  const res = await workloadModel().updateMany(
    { department, academicYear, status: { $ne: "superseded" } },
    { $set: { needsRecalculation: true } },
  );
  return res?.modifiedCount ?? 0;
}

async function withCourseRefs(rows) {
  const out = [];
  for (const row of rows) {
    const course = await resolveCourse(Number(row.courseNum));
    if (!course) throw new ErrorHandler(400, `${row.courseNum}-kurs ma'lumotnomada topilmadi`);
    out.push({ ...row, course, note: row.note || null });
  }
  return out;
}

async function createContingent({ scope, academicYear, userId }) {
  const department = writerDepartment(scope);
  const exists = await Model.exists({ department, academicYear, active: true });
  if (exists) {
    throw new ErrorHandler(409, "Bu o'quv yili uchun kafedra kontingenti allaqachon bor");
  }
  return Model.create({ department, academicYear, rows: [], lastEditedBy: userId });
}

async function findScoped(id, scope) {
  const doc = await Model.findOne({ _id: id, active: true, ...scope });
  if (!doc) throw new ErrorHandler(404, "Kafedra kontingenti topilmadi");
  return doc;
}

async function assertRowsValid(rows, academicYear) {
  const groupsById = await loadGroups([...new Set(rows.flatMap(rowGroupIds))]);
  const problems = rows.flatMap((row) =>
    rowProblems(row, groupsById, academicYear).map((p) => `${row.courseNum}-kurs: ${p}`),
  );
  if (problems.length) {
    throw new ErrorHandler(400, "Kontingent qatorlarida xatolik", problems.join("; "));
  }
}

async function updateContingent({ id, scope, rows, userId }) {
  writerDepartment(scope);
  const doc = await findScoped(id, scope);
  const normalized = await withCourseRefs(rows);
  await assertRowsValid(normalized, doc.academicYear);
  doc.rows = normalized;
  doc.lastEditedBy = userId;
  await doc.save();
  const flagged = await markWorkloadsForRecalc(doc);
  return { doc, flaggedWorkloads: flagged };
}

async function removeContingent({ id, scope, userId }) {
  writerDepartment(scope);
  const doc = await findScoped(id, scope);
  doc.active = false;
  doc.lastEditedBy = userId;
  await doc.save();
  return { flaggedWorkloads: await markWorkloadsForRecalc(doc) };
}

function listFilter(scope, { academicYear, department }) {
  const filter = { active: true, ...scope };
  if (academicYear) filter.academicYear = academicYear;
  if (department && !("department" in scope)) filter.department = department;
  return filter;
}

const toListItem = (doc) => ({
  _id: doc._id,
  department: doc.department,
  academicYear: doc.academicYear,
  rowCount: (doc.rows || []).length,
  streamCount: (doc.rows || []).reduce((s, r) => s + (r.streams || []).length, 0),
  updatedAt: doc.updatedAt,
});

async function paginateContingents({ scope, query }) {
  const filter = listFilter(scope, query);
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const [docs, totalDocs] = await Promise.all([
    Model.find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("department academicYear rows.streams updatedAt")
      .populate("department", "title")
      .populate("academicYear", "title")
      .lean(),
    Model.countDocuments(filter),
  ]);
  return { docs: docs.map(toListItem), totalDocs, page, limit };
}

function detailRow(row, groupsById, academicYear) {
  return {
    ...row,
    streams: (row.streams || []).map((s) => ({
      number: s.number,
      groups: (s.groups || []).map((g) => groupsById.get(idStr(g)) || { _id: g, missing: true }),
      languages: streamLanguages(s, groupsById),
    })),
    derived: rowDerived(row, groupsById),
    problems: rowProblems(row, groupsById, academicYear),
  };
}

async function findContingent({ id, scope }) {
  const doc = await Model.findOne({ _id: id, active: true, ...scope })
    .populate("department", "title")
    .populate("academicYear", "title")
    .populate("rows.direction", "title code")
    .lean();
  if (!doc) throw new ErrorHandler(404, "Kafedra kontingenti topilmadi");
  const groupsById = await loadGroups([...new Set((doc.rows || []).flatMap(rowGroupIds))]);
  const yearId = doc.academicYear?._id ?? doc.academicYear;
  return { ...doc, rows: (doc.rows || []).map((r) => detailRow(r, groupsById, yearId)) };
}

async function prefillRow({ academicYear, direction, courseNum }) {
  const course = await resolveCourse(Number(courseNum));
  if (!course) throw new ErrorHandler(400, `${courseNum}-kurs ma'lumotnomada topilmadi`);
  const groups = await groupModel()
    .find({ direction, course, academicYear, active: true })
    .select("title lang studentNumber")
    .populate("lang", "title")
    .sort({ title: 1 })
    .lean();
  return { direction, courseNum: Number(courseNum), streams: suggestStreams(groups), groups };
}

module.exports = {
  createContingent,
  updateContingent,
  removeContingent,
  paginateContingents,
  findContingent,
  prefillRow,
  listFilter,
  writerDepartment,
  markWorkloadsForRecalc,
};
