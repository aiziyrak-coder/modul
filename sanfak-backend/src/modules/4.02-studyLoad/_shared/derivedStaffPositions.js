"use strict";

const NORM_TO_TABLE_SLUG = Object.freeze({
  professor: "professor",
  docent: "docent",
  senior_teacher: "seniorTeacher",
  assistant: "assistant",
  trainee: "trainee",
});

const round2 = (n) => Math.round(n * 100) / 100;

function sumBlocksHours(blocks) {
  return (Array.isArray(blocks) ? blocks : []).reduce(
    (sum, b) => sum + (Number(b && b.totalHour) || 0),
    0,
  );
}

function deriveStaffPositions({ teachers, positionNorms, manualItems } = {}) {
  const list = Array.isArray(teachers) ? teachers : [];
  const assignable = list.filter(
    (t) => t && !t.isVacant && Array.isArray(t.blocks) && t.blocks.length > 0,
  );

  if (!assignable.length) return null;

  const norms = positionNorms || {};

  const bucket = {};
  let unclassifiedPositions = 0;
  let unclassifiedHours = 0;

  for (const t of assignable) {
    const hours = sumBlocksHours(t.blocks);
    const tableSlug = t.position ? NORM_TO_TABLE_SLUG[t.position] : undefined;
    if (!tableSlug) {
      unclassifiedPositions += Number(t.stavka) || 0;
      unclassifiedHours += hours;
      continue;
    }
    if (!bucket[tableSlug]) bucket[tableSlug] = { positions: 0, totalHours: 0 };
    bucket[tableSlug].positions += Number(t.stavka) || 0;
    bucket[tableSlug].totalHours += hours;
  }

  let vacantHours = 0;
  for (const t of list) {
    if (t && t.isVacant) vacantHours += sumBlocksHours(t.blocks);
  }

  const items = [];
  let teachingTotalPositions = 0;
  for (const normSlug of Object.keys(NORM_TO_TABLE_SLUG)) {
    const tableSlug = NORM_TO_TABLE_SLUG[normSlug];
    const agg = bucket[tableSlug];
    if (!agg) continue;
    const positions = round2(agg.positions);
    teachingTotalPositions += positions;
    items.push({
      category: "teachingStaff",
      slug: tableSlug,
      title: "",
      positions,
      load: Number(norms[normSlug]) || 0,
      totalHours: Math.round(agg.totalHours),
    });
  }

  let manualTotalPositions = 0;
  for (const it of Array.isArray(manualItems) ? manualItems : []) {
    if (!it || (it.category !== "departmentHead" && it.category !== "supportStaff")) continue;
    items.push(it);
    manualTotalPositions += Number(it.positions) || 0;
  }

  return {
    items,
    totalPositions: round2(teachingTotalPositions + manualTotalPositions),
    hourly: 0,
    meta: {
      unclassified: {
        positions: round2(unclassifiedPositions),
        totalHours: Math.round(unclassifiedHours),
      },
      vacantHours: Math.round(vacantHours),
      derived: true,
    },
  };
}

module.exports = { deriveStaffPositions, NORM_TO_TABLE_SLUG };
