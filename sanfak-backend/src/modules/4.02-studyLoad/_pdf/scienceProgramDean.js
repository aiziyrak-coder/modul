"use strict";

const { resolveSignatory } = require("#modules/4.02-studyLoad/_shared/signatories");

function san(v) {
  if (v == null) return "";
  if (typeof v === "object")
    return san(v.uz || v.ru || v.en || v.title || v.name || "");
  return String(v);
}

function resolveDeanFacultyName(sp) {
  const dirs = Array.isArray(sp && sp.directions) ? sp.directions : [];
  for (const d of dirs) {
    const f = d && d.faculty;
    if (f && typeof f === "object") {
      const name = san(f.title || f.name);
      if (name) return name;
    }
  }
  return "";
}

function facultyDekaniLabel(facultyName) {
  if (!facultyName) return "Fakultet dekani";
  return /fakult/i.test(facultyName)
    ? `${facultyName} dekani`
    : `${facultyName} fakulteti dekani`;
}

const BLANK_FACULTY = "____________________";
function facultyKengashiLabel(facultyName) {
  if (!facultyName) return `${BLANK_FACULTY} fakulteti Kengashining`;
  return /fakult/i.test(facultyName)
    ? `${facultyName} Kengashining`
    : `${facultyName} fakulteti Kengashining`;
}

function buildDeanConfirmationBlock(sp) {
  const facultyName = resolveDeanFacultyName(sp);
  const position = facultyDekaniLabel(facultyName);
  const sig = resolveSignatory(sp, { step: "dean", snapshot: sp.verify?.snapshot });
  return { position, name: sig.name, date: sig.dateText, source: sig.source };
}

module.exports = {
  resolveDeanFacultyName,
  facultyDekaniLabel,
  facultyKengashiLabel,
  buildDeanConfirmationBlock,
};
