"use strict";

const AcademicYear = require("#references/academicYear/academicYear.model");
const { COLUMNS, SAMPLE_ROW_COUNT } = require("./rosterColumns");
const { loadCatalog, norm } = require("./rosterImport");
const { resolveByTitle } = require("./academicYearRefPlugin");

const FILLED_ROWS = Math.max(SAMPLE_ROW_COUNT - 1, 1);

const PROGRAM_SAMPLE = COLUMNS.find((c) => c.key === "program")?.sample ?? [];

function pickUnique(rows, filter) {
  const pool = filter ? rows.filter(filter) : rows;
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

  const department = pickUnique(catalog.departments)?.title ?? "";
  const group = pickUnique(catalog.groups)?.title ?? "";
  const course = pickCourseNumber(catalog.courses);
  const academicYear = await pickAcademicYear();

  const specialty = Array.from({ length: SAMPLE_ROW_COUNT }, (_, i) => {
    if (i >= FILLED_ROWS) return "";
    const program = PROGRAM_SAMPLE[i];
    if (!program) return "";
    return pickUnique(catalog.specialties, (r) => r.program === program)?.title ?? "";
  });

  const spread = (value) =>
    Array.from({ length: SAMPLE_ROW_COUNT }, (_, i) => (i < FILLED_ROWS ? value : ""));

  return {
    department: spread(department),
    group: spread(group),
    course: spread(course),
    academicYear: spread(academicYear),
    specialty,
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
