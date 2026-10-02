"use strict";

const isEmpty = (v) => v === null || v === undefined || v === "";

const MATCH_NOTHING = { $in: [] };

const applyScopedEquals = (filter, scope, key, value) => {
  if (isEmpty(value)) return true;

  const scoped = scope ? scope[key] : undefined;

  if (isEmpty(scoped)) {
    filter[key] = value;
    return true;
  }

  if (typeof scoped === "object" && Array.isArray(scoped.$in)) {
    const allowed = scoped.$in.some((v) => String(v) === String(value));
    filter[key] = allowed ? value : MATCH_NOTHING;
    return allowed;
  }

  const allowed = String(scoped) === String(value);
  filter[key] = allowed ? value : MATCH_NOTHING;
  return allowed;
};

module.exports = { applyScopedEquals, MATCH_NOTHING };
