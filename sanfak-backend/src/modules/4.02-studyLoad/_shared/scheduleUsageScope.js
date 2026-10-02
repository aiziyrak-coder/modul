"use strict";

const startYearOf = (value) => {
  if (value === null || value === undefined) return null;
  const m = String(value).match(/\d{4}/);
  return m ? Number(m[0]) : null;
};

const usageScopeOfSchedule = (schedule) => ({
  academicYear: (schedule && schedule.academicYear) || null,
  year: startYearOf(schedule && schedule.year),
  direction: (schedule && schedule.direction) || null,
});

module.exports = { startYearOf, usageScopeOfSchedule };
