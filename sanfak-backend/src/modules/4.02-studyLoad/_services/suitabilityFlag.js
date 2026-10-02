"use strict";

const TeacherProfile = require("#modules/4.03-teacher/teacher/teacher.model");
const Science = require("#references/science/science.model");
const winston = require("#shared/winston.logger");

function evaluateSuitability({ teacherDepartmentId, scienceDepartmentId }) {
  if (!teacherDepartmentId || !scienceDepartmentId) return "unknown";
  return String(teacherDepartmentId) === String(scienceDepartmentId)
    ? "match"
    : "crossDepartment";
}

async function buildSuitability({ teacherUserId, scienceId }) {
  let teacherDepartment = null;
  let scienceDepartment = null;

  try {
    const [profile, science] = await Promise.all([
      teacherUserId
        ? TeacherProfile.findOne({ user: teacherUserId }).select("department").lean()
        : null,
      scienceId
        ? Science.findById(scienceId).select("department").lean()
        : null,
    ]);
    teacherDepartment = profile?.department || null;
    scienceDepartment = science?.department || null;
  } catch (err) {
    winston.error(
      `[suitabilityFlag] hisoblab bo'lmadi (teacher=${teacherUserId || "null"} science=${scienceId || "null"}): ${err.message}`,
    );
  }

  return {
    flag: evaluateSuitability({
      teacherDepartmentId: teacherDepartment,
      scienceDepartmentId: scienceDepartment,
    }),
    teacherDepartment,
    scienceDepartment,
    computedAt: new Date(),
  };
}

async function buildSuitabilityFromDepartment({ teacherDepartmentId, scienceId }) {
  let scienceDepartment = null;

  try {
    const science = scienceId
      ? await Science.findById(scienceId).select("department").lean()
      : null;
    scienceDepartment = science?.department || null;
  } catch (err) {
    winston.error(
      `[suitabilityFlag] hisoblab bo'lmadi (science=${scienceId || "null"}): ${err.message}`,
    );
  }

  return {
    flag: evaluateSuitability({
      teacherDepartmentId: teacherDepartmentId || null,
      scienceDepartmentId: scienceDepartment,
    }),
    teacherDepartment: teacherDepartmentId || null,
    scienceDepartment,
    computedAt: new Date(),
  };
}

function requiresJustification(flag) {
  return flag === "crossDepartment";
}

function emptyJustification() {
  return { basis: null, note: null, declaredBy: null, declaredAt: null };
}

function collectCrossDepartmentBlocks(doc) {
  const out = [];
  for (const entry of doc?.teachers || []) {
    for (const block of entry.blocks || []) {
      if (block?.suitability?.flag !== "crossDepartment") continue;
      out.push({
        type: "suitability",
        severity: "warning",
        teacherEntryId: String(entry._id),
        blockId: String(block._id),
        flag: "crossDepartment",
        declared: Boolean(block.justification?.basis),
        basis: block.justification?.basis || null,
      });
    }
  }
  return out;
}

module.exports = {
  evaluateSuitability,
  buildSuitability,
  buildSuitabilityFromDepartment,
  requiresJustification,
  collectCrossDepartmentBlocks,
  emptyJustification,
};
