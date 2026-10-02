"use strict";

const num = (v) => Number(v) || 0;

function rowInvariantError(row) {
  if (num(row.boys) + num(row.girls) !== num(row.total)) {
    return "o'g'il + qiz jami talabaga teng emas";
  }
  if (num(row.grant) + num(row.contract) !== num(row.total)) {
    return "grant + shartnoma jami talabaga teng emas";
  }
  if (num(row.grantBoys) + num(row.grantGirls) !== num(row.grant)) {
    return "grant o'g'il + qiz grant soniga teng emas";
  }
  if (num(row.contractBoys) + num(row.contractGirls) !== num(row.contract)) {
    return "shartnoma o'g'il + qiz shartnoma soniga teng emas";
  }
  return null;
}

function foreignRowInvariantError(row) {
  return num(row.boys) + num(row.girls) !== num(row.total)
    ? "o'g'il + qiz jami talabaga teng emas"
    : null;
}

const rowLabel = (row) =>
  `${row.directionTitle || row.direction || "?"} ${row.course}-kurs`;

function collectInvariantViolations(doc) {
  const out = [];
  for (const row of doc?.rows || []) {
    const message = rowInvariantError(row);
    if (message) out.push({ kind: "row", label: rowLabel(row), message });
  }
  for (const row of doc?.foreignByCountry || []) {
    const message = foreignRowInvariantError(row);
    if (message) out.push({ kind: "foreign", label: String(row.country || "?"), message });
  }
  return out;
}

module.exports = {
  rowInvariantError,
  foreignRowInvariantError,
  rowLabel,
  collectInvariantViolations,
};
