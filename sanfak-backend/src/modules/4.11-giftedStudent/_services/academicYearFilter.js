const HEX24 = /^[0-9a-fA-F]{24}$/;

const isUnset = (value) =>
  value === undefined || value === null || value === "" || value === "all";

const titleVariants = (raw) => {
  const m = String(raw).trim().match(/^(\d{4})\s*[-/]\s*(\d{4})$/);
  if (!m) return [raw];
  return [`${m[1]}/${m[2]}`, `${m[1]}-${m[2]}`];
};

const applyAcademicYearFilter = (filter, value) => {
  if (isUnset(value)) return filter;
  const raw = String(value);
  if (HEX24.test(raw)) {
    filter.academicYearId = raw;
    return filter;
  }
  const variants = titleVariants(raw);
  filter.academicYear = variants.length > 1 ? { $in: variants } : variants[0];
  return filter;
};

module.exports = { applyAcademicYearFilter, isUnset, HEX24, titleVariants };
