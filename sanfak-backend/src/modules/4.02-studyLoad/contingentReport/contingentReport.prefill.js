"use strict";

const DirectionModel = require("#references/direction/direction.model");
const GroupModel = require("#references/group/group.model");
const CourseModel = require("#references/course/course.model");
const { normalizeTitle } = require("#references/_services/courseResolver");
const { MAX_COURSE } = require("./contingentReport.model");

const PREFILL_CELLS = ["total", "groupCount", "streamCount"];

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

function courseNumberFromTitle(title) {
  const norm = normalizeTitle(title);
  if (!norm) return null;
  if (ROMAN[norm]) return ROMAN[norm];
  const asNum = parseInt(norm, 10);
  return Number.isInteger(asNum) && asNum >= 1 && asNum <= MAX_COURSE ? asNum : null;
}

async function loadCourseNumbers() {
  const courses = await CourseModel.find({ active: true }).select("title").lean();
  const map = new Map();
  for (const c of courses) {
    const num = courseNumberFromTitle(c.title);
    if (num) map.set(String(c._id), num);
  }
  return map;
}

function aggregateGroups(groups, courseNumbers) {
  const acc = new Map();
  let groupsWithoutYear = 0;
  let unresolvedCourse = 0;
  for (const g of groups) {
    if (!g.academicYear) {
      groupsWithoutYear += 1;
      continue;
    }
    const course = courseNumbers.get(String(g.course));
    if (!course) {
      unresolvedCourse += 1;
      continue;
    }
    const key = `${String(g.direction)}|${course}`;
    if (!acc.has(key)) acc.set(key, { total: 0, groupCount: 0, langs: new Set() });
    const s = acc.get(key);
    s.total += g.studentNumber || 0;
    s.groupCount += 1;
    if (g.lang) s.langs.add(String(g.lang));
  }
  const stats = new Map();
  for (const [key, s] of acc) {
    stats.set(key, { total: s.total, groupCount: s.groupCount, streamCount: s.langs.size });
  }
  return { stats, groupsWithoutYear, unresolvedCourse };
}

async function loadGroupStats({ directionIds, academicYearId }) {
  const groups = await GroupModel.find({
    direction: { $in: directionIds },
    active: true,
    $or: [{ academicYear: academicYearId }, { academicYear: null }],
  })
    .select("direction course lang studentNumber academicYear")
    .lean();
  const courseNumbers = await loadCourseNumbers();
  return aggregateGroups(groups, courseNumbers);
}

async function loadFacultyDirections(facultyId) {
  return DirectionModel.find({ faculty: facultyId, active: true })
    .select("title directionCode studyPeriod international")
    .sort({ title: 1 })
    .lean();
}

const defaultCategory = (direction) => (direction.international ? "xorijiy" : "milliy");
const rowKey = (row) => `${String(row.direction)}|${row.course}`;
const EMPTY_STAT = { total: 0, groupCount: 0, streamCount: 0 };

async function buildPrefillRows({ facultyId, academicYearId }) {
  const directions = await loadFacultyDirections(facultyId);
  const { stats, groupsWithoutYear, unresolvedCourse } = await loadGroupStats({
    directionIds: directions.map((d) => d._id),
    academicYearId,
  });

  const rows = [];
  for (const d of directions) {
    const courses = Math.min(Math.max(Number(d.studyPeriod) || MAX_COURSE, 1), MAX_COURSE);
    for (let course = 1; course <= courses; course++) {
      const s = stats.get(`${String(d._id)}|${course}`) || EMPTY_STAT;
      rows.push({
        direction: d._id,
        directionCode: d.directionCode || "",
        directionTitle: d.title || "",
        category: defaultCategory(d),
        course,
        total: s.total,
        groupCount: s.groupCount,
        streamCount: s.streamCount,
        source: { total: "groups", groupCount: "groups", streamCount: "groups" },
      });
    }
  }
  return {
    rows,
    directions,
    meta: {
      directionCount: directions.length,
      groupsCounted: [...stats.values()].reduce((a, s) => a + s.groupCount, 0),
      groupsWithoutYear,
      unresolvedCourse,
    },
  };
}

function mergeFreshRow(target, fresh, force, counters) {
  target.directionCode = fresh.directionCode;
  target.directionTitle = fresh.directionTitle;
  let touched = false;
  for (const cell of PREFILL_CELLS) {
    const isManual = target.source && target.source[cell] === "manual";
    if (isManual && !force) {
      counters.skippedManual += 1;
      continue;
    }
    if (target[cell] !== fresh[cell]) touched = true;
    target[cell] = fresh[cell];
    target.source = target.source || {};
    target.source[cell] = "groups";
  }
  if (touched) counters.updated += 1;
}

function mergePrefill(doc, built, { force = false } = {}) {
  const dirById = new Map(built.directions.map((d) => [String(d._id), d]));
  const byKey = new Map();
  for (const row of doc.rows) {
    const key = rowKey(row);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(row);
  }

  const counters = { updated: 0, added: 0, skippedManual: 0 };
  for (const fresh of built.rows) {
    const candidates = byKey.get(rowKey(fresh)) || [];
    const d = dirById.get(String(fresh.direction));
    const wanted = d ? defaultCategory(d) : "milliy";
    const target = candidates.find((r) => r.category === wanted) || candidates[0];
    if (!target) {
      doc.rows.push(fresh);
      counters.added += 1;
      continue;
    }
    mergeFreshRow(target, fresh, force, counters);
  }
  return counters;
}

module.exports = {
  PREFILL_CELLS,
  courseNumberFromTitle,
  aggregateGroups,
  loadGroupStats,
  buildPrefillRows,
  mergePrefill,
  rowKey,
};
