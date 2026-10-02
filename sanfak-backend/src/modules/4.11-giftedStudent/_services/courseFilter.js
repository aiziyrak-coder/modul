const HEX24 = /^[0-9a-fA-F]{24}$/;

const isUnset = (value) =>
  value === undefined || value === null || value === "" || value === "all";

const applyCourseFilter = (filter, value) => {
  if (isUnset(value)) return filter;
  const raw = String(value);
  if (HEX24.test(raw)) {
    filter.courseId = raw;
    return filter;
  }
  const n = Number(raw);
  filter.course = Number.isFinite(n) ? n : raw;
  return filter;
};

module.exports = { applyCourseFilter, isUnset, HEX24 };
