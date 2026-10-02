"use strict";

const { ROLES } = require("#config/constants");
const { STATUS_IN_STUDY } = require("#modules/4.05-residency/resident/resident.model");
const {
  applyAcademicYearFilter,
} = require("#modules/4.05-residency/_services/academicYearFilter");
const {
  applyCourseFilter,
} = require("#modules/4.05-residency/_services/courseFilter");
const { searchOr } = require("#modules/4.05-residency/_services/searchTerm");

function residentFilter(cut) {
  const f = {
    active: true,

    status: STATUS_IN_STUDY,

    expulsionOrderCreated: { $ne: true },
  };
  if (cut.specialty) f.specialty = cut.specialty;
  if (cut.program) f.program = cut.program;
  applyCourseFilter(f, cut.courseNumber);
  if (cut.group) f.group = cut.group;
  applyAcademicYearFilter(f, cut.academicYear);
  return f;
}

function buildListFilter(query) {
  const { search, academicYear, courseNumber, group, specialty, program } = query;
  const data = {};
  applyAcademicYearFilter(data, academicYear);
  applyCourseFilter(data, courseNumber);
  if (group) data.group = group;
  if (specialty) data.specialty = specialty;
  if (program) data.program = program;
  const or = searchOr(search, ["title", "scienceTitle", "specialtyTitle"]);
  if (or) data.$or = or;
  return data;
}

function joinResults(residents, assessments) {
  const byResident = new Map();
  for (const a of assessments) {
    if (a.resident) byResident.set(String(a.resident), a);
  }

  return residents.map((r) => {
    const a = byResident.get(String(r._id));
    return {
      resident: {
        _id: r._id,
        fullName: r.fullName,
        program: r.program,
        specialtyTitle: r.specialtyTitle,
        courseNumber: r.courseNumber,
        groupTitle: r.groupTitle,
      },
      assessmentId: a?._id ?? null,
      score: a && typeof a.score === "number" ? a.score : null,
      maxScore: a?.maxScore ?? null,
      gradedAt: a?.updatedAt ?? null,
    };
  });
}

function summarize(rows) {
  const scored = rows.filter((r) => typeof r.score === "number");
  return {
    total: rows.length,
    scored: scored.length,
    notScored: rows.length - scored.length,
    avgScore: scored.length
      ? Number((scored.reduce((s, r) => s + r.score, 0) / scored.length).toFixed(1))
      : null,
  };
}

function validateResults(results, inCut, inScope, maxScore) {
  const seen = new Set();

  for (const row of results) {
    const id = String(row.resident);

    if (seen.has(id)) {
      return { ok: false, status: 400, message: "Bir rezident ikki marta yuborilgan" };
    }
    seen.add(id);

    if (!inCut.has(id)) {
      return {
        ok: false,
        status: 400,
        message: "Rezident bu sinov kesimiga kirmaydi",
      };
    }

    if (inScope !== null && !inScope.has(id)) {
      return {
        ok: false,
        status: 403,
        message: "Bu rezidentga ball qo'yish huquqi yo'q",
      };
    }

    if (row.score !== null && row.score > maxScore) {
      return {
        ok: false,
        status: 400,
        message: `Ball 0 va ${maxScore} orasida bo'lishi kerak`,
      };
    }
  }

  return { ok: true };
}

function canManageTests(user) {
  const role = user?.role || {};
  return role.scopeLevel === "global" || role.title === ROLES.MAGISTRATURA_BOLIM;
}

module.exports = {
  canManageTests,
  residentFilter,
  buildListFilter,
  joinResults,
  summarize,
  validateResults,
};
