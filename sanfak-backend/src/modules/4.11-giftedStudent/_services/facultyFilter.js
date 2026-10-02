const HEX24 = /^[0-9a-fA-F]{24}$/;

const isUnset = (value) =>
  value === undefined || value === null || value === "" || value === "all";

const applyFacultyFilter = (filter, value) => {
  if (isUnset(value)) return filter;
  const raw = String(value);
  if (HEX24.test(raw)) filter.facultyId = raw;
  else filter.faculty = raw;
  return filter;
};

module.exports = { applyFacultyFilter, isUnset, HEX24 };
