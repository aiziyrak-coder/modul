"use strict";

const {
  academicYearRange,
} = require("#modules/4.05-residency/residencyReport/residencyReport.service");

const START_MONTH = 9;

function currentAcademicYearTitle(now = new Date()) {
  const year = now.getUTCFullYear();
  return now.getUTCMonth() + 1 >= START_MONTH
    ? `${year}/${year + 1}`
    : `${year - 1}/${year}`;
}

function currentAcademicYearWindow(now = new Date()) {
  return academicYearRange(currentAcademicYearTitle(now), now);
}

function unexcusedDateFilter(now = new Date()) {
  const { from, to } = currentAcademicYearWindow(now);
  return { $gte: from, $lte: to };
}

const sumUnexcusedHours = (absences) =>
  absences.reduce((sum, a) => sum + (a.hours || 2), 0);

module.exports = {
  START_MONTH,
  currentAcademicYearTitle,
  currentAcademicYearWindow,
  unexcusedDateFilter,
  sumUnexcusedHours,
};
