"use strict";

const {
  buildResidentScope,
} = require("#modules/4.05-residency/_services/residentScope");
const {
  residentIdsByAttributes,
  intersectResidentIds,
} = require("#modules/4.05-residency/_services/residentAttributeFilter");

async function buildAttendanceFilter(user, query = {}) {
  const {
    resident,
    status,
    science,
    lessonType,
    group,
    date,
    startDate,
    endDate,
    academicYear,
    course,
  } = query;

  const { filter: scoped, denied } = await buildResidentScope(user, resident);
  if (denied) return { filter: null, denied: true };

  const filter = { ...scoped };

  const byAttributes = await residentIdsByAttributes({ academicYear, course });
  if (byAttributes && !intersectResidentIds(filter, byAttributes)) {
    return { filter: null, denied: true };
  }

  if (status) filter.status = status;
  if (science) filter.science = science;
  if (lessonType) filter.lessonType = lessonType;
  if (group) filter.group = group;
  if (date) {
    const from = new Date(date);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    filter.date = { $gte: from, $lt: to };
  } else if (startDate && endDate) {
    filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  return { filter, denied: false };
}

module.exports = { buildAttendanceFilter };
