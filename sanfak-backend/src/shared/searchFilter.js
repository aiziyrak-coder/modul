const escapeRegex = (str = "") =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildMultiLangSearch = (searchField, _lang, term) => {
  if (!term) return {};
  const safeTerm = escapeRegex(term.trim());
  if (!safeTerm) return {};
  return { [searchField]: { $regex: new RegExp(safeTerm, "i") } };
};

const buildPlainSearch = (searchField, term) => {
  if (!term) return {};
  const safeTerm = escapeRegex(term.trim());
  if (!safeTerm) return {};
  return { [searchField]: { $regex: new RegExp(safeTerm, "i") } };
};

const toBool = (v) => {
  if (v === true || v === "true") return true;
  if (v === false || v === "false") return false;
  return undefined;
};

const BOOLEAN_FIELDS = new Set(["active", "international"]);

const ARRAY_FIELDS = new Set(["teachingLanguages"]);

const applyFilters = (query = {}, allowedFields = []) => {
  const data = {};
  for (const field of allowedFields) {
    const value = query[field];
    if (value === undefined || value === null || value === "") continue;

    if (BOOLEAN_FIELDS.has(field)) {
      const b = toBool(value);
      if (b !== undefined) data[field] = b;
      continue;
    }

    if (ARRAY_FIELDS.has(field)) {
      const list = Array.isArray(value)
        ? value
        : String(value)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
      if (list.length === 1) {
        data[field] = list[0];
      } else if (list.length > 1) {
        data[field] = { $in: list };
      }
      continue;
    }

    data[field] = value;
  }
  return data;
};

module.exports = {
  escapeRegex,
  buildMultiLangSearch,
  buildPlainSearch,
  applyFilters,
};
