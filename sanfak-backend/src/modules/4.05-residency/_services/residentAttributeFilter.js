"use strict";

const Resident = require("#modules/4.05-residency/resident/resident.model");
const { applyAcademicYearFilter } = require("./academicYearFilter");
const { applyCourseFilter } = require("./courseFilter");

const isSet = (v) => v !== undefined && v !== null && v !== "";

const residentIdsByAttributes = async ({ academicYear, course } = {}) => {
  const sub = {};
  if (isSet(academicYear)) applyAcademicYearFilter(sub, academicYear);
  if (isSet(course)) applyCourseFilter(sub, course);

  if (Object.keys(sub).length === 0) return null;
  const rows = await Resident.find(sub).select("_id").lean();
  return rows.map((r) => r._id);
};

const intersectResidentIds = (filter, ids) => {
  const wanted = new Set(ids.map(String));
  if (wanted.size === 0) return false;

  const current = filter.resident;

  if (current === undefined || current === null) {
    filter.resident = { $in: ids };
    return true;
  }

  if (current && Array.isArray(current.$in)) {
    const both = current.$in.filter((id) => wanted.has(String(id)));
    if (both.length === 0) return false;
    filter.resident = { $in: both };
    return true;
  }

  if (current && Array.isArray(current.$nin)) {
    const blocked = new Set(current.$nin.map(String));
    const both = ids.filter((id) => !blocked.has(String(id)));
    if (both.length === 0) return false;
    filter.resident = { $in: both };
    return true;
  }

  return wanted.has(String(current));
};

module.exports = { residentIdsByAttributes, intersectResidentIds };
