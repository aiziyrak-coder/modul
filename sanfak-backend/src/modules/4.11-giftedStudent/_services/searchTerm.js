const { escapeRegex } = require("#shared/searchFilter");

const normalizeSearchTerm = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const searchRegex = (value) => {
  const term = normalizeSearchTerm(value);
  if (!term) return null;
  return { $regex: escapeRegex(term), $options: "i" };
};

const searchOr = (value, fields) => {
  const rx = searchRegex(value);
  if (!rx || !fields.length) return null;
  return fields.map((field) => ({ [field]: rx }));
};

module.exports = { normalizeSearchTerm, searchRegex, searchOr };
