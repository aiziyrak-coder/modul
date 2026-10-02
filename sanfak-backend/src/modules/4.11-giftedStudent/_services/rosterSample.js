"use strict";

const AcademicYear = require("#references/academicYear/academicYear.model");
const { COLUMNS, SAMPLE_ROW_COUNT } = require("./rosterColumns");
const { loadCatalog, norm } = require("./rosterImport");
const { resolveByTitle } = require("./academicYearRefPlugin");

const FILLED_ROWS = Math.max(SAMPLE_ROW_COUNT - 1, 1);

function pickUnique(rows, parentField, parentId) {
  const pool = parentField
    ? rows.filter((r) => String(r[parentField] || "") === String(parentId || ""))
    : rows;
  const seen = new Map();
  for (const r of pool) {
    const key = norm(r.title);
    if (key) seen.set(key, (seen.get(key) || 0) + 1);
  }
  return pool.find((r) => seen.get(norm(r.title)) === 1) || null;
}

function pickCourseNumber(courses) {
  const numberOf = (c) => parseInt(String(c.title).replace(/\D/g, ""), 10);
  const usable = courses.map(numberOf).filter((n) => Number.isFinite(n));
  if (!usable.length) return "";
  return String(Math.min(...usable));
}

async function pickAcademicYear() {
  const rows = await AcademicYear.find({}).select("title active").lean();
  const candidates = [...rows.filter((r) => r.active !== false), ...rows];
  for (const row of candidates) {
    if (!row.title) continue;
    if (await resolveByTitle(row.title)) return row.title;
  }
  return "";
}

async function resolveSampleRefs() {
  const catalog = await loadCatalog();

  const faculty = pickUnique(catalog.faculties);
  const direction = faculty
    ? pickUnique(catalog.directions, "faculty", faculty._id)
    : null;
  const group = direction ? pickUnique(catalog.groups, "direction", direction._id) : null;

  const course = pickCourseNumber(catalog.courses);
  const academicYear = await pickAcademicYear();

  const spread = (value) =>
    Array.from({ length: SAMPLE_ROW_COUNT }, (_, i) =>
      i < FILLED_ROWS && value ? value : "",
    );

  return {
    faculty: spread(faculty?.title),
    direction: spread(direction?.title),
    group: spread(group?.title),
    course: spread(course),
    academicYear: spread(academicYear),
  };
}

async function buildSampleRows() {
  const refs = await resolveSampleRefs();

  return Array.from({ length: SAMPLE_ROW_COUNT }, (_, i) => {
    const row = {};
    for (const col of COLUMNS) {
      const value = col.sampleFrom ? refs[col.sampleFrom]?.[i] : col.sample?.[i];
      row[col.key] = value ? String(value) : "";
    }
    return row;
  });
}

module.exports = {
  buildSampleRows,
  FILLED_ROWS,
  pickUnique,
  pickCourseNumber,
  resolveSampleRefs,
};
