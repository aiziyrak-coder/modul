"use strict";

const { CATEGORY_LABELS } = require("#modules/4.02-studyLoad/contingentReport/contingentReport.model");

const NUM_FIELDS = [
  "total",
  "boys",
  "girls",
  "grant",
  "contract",
  "grantBoys",
  "grantGirls",
  "contractBoys",
  "contractGirls",
  "groupCount",
  "streamCount",
  "mobilityOut",
  "mobilityIn",
];

const MAX_COURSE = 6;

const zeroTotals = () => Object.fromEntries(NUM_FIELDS.map((f) => [f, 0]));

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function addInto(acc, row) {
  for (const f of NUM_FIELDS) acc[f] += n(row[f]);
  return acc;
}

function directionLabel(row) {
  const code = row.directionCode ? String(row.directionCode).trim() : "";
  const title = row.directionTitle ? String(row.directionTitle).trim() : "";
  const cat = CATEGORY_LABELS[row.category] || row.category || "";
  const head = code ? `${code}-${title}` : title;
  return cat ? `${head} (${cat})` : head;
}

function facultyShortName(title) {
  return String(title || "")
    .replace(/\s+fakulteti\s*$/i, "")
    .trim();
}

const idOf = (v) => (v && typeof v === "object" && v._id ? String(v._id) : String(v || ""));

function buildFacultyBlock(report) {
  const blocks = new Map();
  for (const row of report.rows || []) {
    const key = `${idOf(row.direction)}|${row.category || "milliy"}`;
    if (!blocks.has(key)) {
      blocks.set(key, {
        key,
        direction: idOf(row.direction),
        directionCode: row.directionCode || "",
        directionTitle: row.directionTitle || "",
        category: row.category || "milliy",
        label: directionLabel(row),
        rows: [],
        total: zeroTotals(),
      });
    }
    const block = blocks.get(key);
    const clean = { course: n(row.course) };
    for (const f of NUM_FIELDS) clean[f] = n(row[f]);
    block.rows.push(clean);
    addInto(block.total, clean);
  }
  const directions = [...blocks.values()].map((b) => ({
    ...b,
    rows: [...b.rows].sort((a, c) => a.course - c.course),
  }));
  const total = directions.reduce((acc, b) => addInto(acc, b.total), zeroTotals());
  return {
    facultyId: idOf(report.faculty),
    facultyTitle: report.facultyTitle || "",
    facultyShort: facultyShortName(report.facultyTitle),
    directions,
    total,
  };
}

function buildByCourse(facultyBlocks) {
  const byCourse = new Map();
  for (let c = 1; c <= MAX_COURSE; c++) byCourse.set(c, { course: c, ...zeroTotals() });
  for (const fb of facultyBlocks) {
    for (const d of fb.directions) {
      for (const r of d.rows) {
        const acc = byCourse.get(r.course);
        if (acc) addInto(acc, r);
      }
    }
  }
  const rows = [...byCourse.values()];
  const total = rows.reduce((acc, r) => addInto(acc, r), zeroTotals());
  return { rows, total };
}

function buildFacultyByCourse(facultyBlocks) {
  const rows = facultyBlocks.map((fb) => {
    const courses = Array.from({ length: MAX_COURSE }, () => 0);
    for (const d of fb.directions) {
      for (const r of d.rows) {
        if (r.course >= 1 && r.course <= MAX_COURSE) courses[r.course - 1] += r.total;
      }
    }
    return {
      facultyTitle: fb.facultyTitle,
      facultyShort: fb.facultyShort,
      courses,
      total: courses.reduce((a, b) => a + b, 0),
    };
  });
  const totalCourses = Array.from({ length: MAX_COURSE }, (_, i) =>
    rows.reduce((a, r) => a + r.courses[i], 0),
  );
  return {
    rows,
    total: { courses: totalCourses, total: totalCourses.reduce((a, b) => a + b, 0) },
  };
}

const countryKey = (s) => String(s || "").trim().toLocaleLowerCase("uz");

function buildCountries(reports) {
  const map = new Map();
  for (const rep of reports) {
    for (const fr of rep.foreignByCountry || []) {
      const key = countryKey(fr.country);
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, { country: String(fr.country).trim(), total: 0, boys: 0, girls: 0 });
      }
      const acc = map.get(key);
      acc.total += n(fr.total);
      acc.boys += n(fr.boys);
      acc.girls += n(fr.girls);
    }
  }
  const rows = [...map.values()].sort((a, b) => a.country.localeCompare(b.country, "uz"));
  const total = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, boys: acc.boys + r.boys, girls: acc.girls + r.girls }),
    { total: 0, boys: 0, girls: 0 },
  );
  return { rows, total };
}

function buildSummary({ reports = [], faculties = null } = {}) {
  let blocks = reports.map(buildFacultyBlock);

  let pendingFaculties = [];
  if (Array.isArray(faculties)) {
    const order = new Map(faculties.map((f, i) => [String(f._id), i]));
    blocks = [...blocks].sort(
      (a, b) => (order.get(a.facultyId) ?? 1e9) - (order.get(b.facultyId) ?? 1e9),
    );
    const covered = new Set(blocks.map((b) => b.facultyId));
    pendingFaculties = faculties
      .filter((f) => !covered.has(String(f._id)))
      .map((f) => f.title)
      .filter(Boolean);
  }

  const grandTotal = blocks.reduce((acc, b) => addInto(acc, b.total), zeroTotals());

  return {
    facultyBlocks: blocks,
    grandTotal,
    byCourse: buildByCourse(blocks),
    facultyByCourse: buildFacultyByCourse(blocks),
    countries: buildCountries(reports),
    pendingFaculties,
  };
}

module.exports = {
  buildSummary,
  buildFacultyBlock,
  directionLabel,
  facultyShortName,
  NUM_FIELDS,
  MAX_COURSE,
  zeroTotals,
};
