"use strict";

const idStr = (v) => (v == null ? null : String(v._id ?? v));

function rowGroupIds(row) {
  const out = new Set();
  for (const stream of row?.streams || []) {
    for (const g of stream?.groups || []) out.add(idStr(g));
  }
  out.delete(null);
  return [...out];
}

function duplicateGroupIds(row) {
  const seen = new Set();
  const dup = new Set();
  for (const stream of row?.streams || []) {
    for (const g of stream?.groups || []) {
      const id = idStr(g);
      if (seen.has(id)) dup.add(id);
      seen.add(id);
    }
  }
  return [...dup];
}

function sameIdSet(a, b) {
  const left = new Set((a || []).map(idStr));
  const right = new Set((b || []).map(idStr));
  if (left.size !== right.size) return false;
  for (const id of left) if (!right.has(id)) return false;
  return true;
}

const nonEmptyStreams = (row) =>
  (row?.streams || []).filter((s) => (s?.groups || []).length > 0);

function applyStreamPartition(base, row, activeGroupIds) {
  if (!row) return { ...base, contingent: { source: "none" } };
  const streams = nonEmptyStreams(row);
  if (streams.length > 0 && sameIdSet(rowGroupIds(row), activeGroupIds)) {
    return { ...base, streamCount: streams.length, contingent: { source: "contingent" } };
  }
  return { ...base, contingent: { source: "stale" } };
}

const rowKey = (direction, course) => `${idStr(direction)}|${idStr(course)}`;

function findRow(doc, direction, course) {
  const key = rowKey(direction, course);
  return (doc?.rows || []).find((r) => rowKey(r.direction, r.course) === key) || null;
}

function groupProblem(group, row, academicYear) {
  if (!group) return "guruh topilmadi";
  const label = `«${group.title || idStr(group._id)}»`;
  if (group.active === false) return `${label} faol emas`;
  if (!group.academicYear) return `${label} o'quv yiliga biriktirilmagan`;
  if (idStr(group.academicYear) !== idStr(academicYear)) return `${label} boshqa o'quv yiliga tegishli`;
  if (idStr(group.direction) !== idStr(row.direction)) return `${label} boshqa yo'nalishga tegishli`;
  if (idStr(group.course) !== idStr(row.course)) return `${label} boshqa kursga tegishli`;
  return null;
}

function rowProblems(row, groupsById, academicYear) {
  const problems = [];
  if (nonEmptyStreams(row).length === 0) problems.push("kamida bitta oqim guruhlari bilan kerak");
  if (duplicateGroupIds(row).length > 0) problems.push("bitta guruh bir necha oqimda turibdi");
  for (const id of rowGroupIds(row)) {
    const problem = groupProblem(groupsById.get(id), row, academicYear);
    if (problem) problems.push(problem);
  }
  return problems;
}

function streamLanguages(stream, groupsById) {
  const langs = new Set();
  for (const g of stream?.groups || []) {
    const lang = groupsById.get(idStr(g))?.lang;
    if (lang) langs.add(idStr(lang));
  }
  return [...langs];
}

function rowDerived(row, groupsById) {
  const ids = rowGroupIds(row);
  const studentCount = ids.reduce(
    (sum, id) => sum + (Number(groupsById.get(id)?.studentNumber) || 0),
    0,
  );
  return { groupCount: ids.length, studentCount, streamCount: nonEmptyStreams(row).length };
}

function suggestStreams(groups) {
  const byLang = new Map();
  for (const g of groups || []) {
    const key = g.lang ? idStr(g.lang) : "—";
    if (!byLang.has(key)) byLang.set(key, []);
    byLang.get(key).push(idStr(g._id));
  }
  return [...byLang.values()].map((ids, i) => ({ number: i + 1, groups: ids }));
}

module.exports = {
  idStr,
  rowGroupIds,
  duplicateGroupIds,
  sameIdSet,
  applyStreamPartition,
  rowKey,
  findRow,
  groupProblem,
  rowProblems,
  streamLanguages,
  rowDerived,
  suggestStreams,
};
