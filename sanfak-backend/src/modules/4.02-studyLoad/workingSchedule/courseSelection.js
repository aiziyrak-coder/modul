"use strict";

const COURSE_MIN = 1;
const COURSE_MAX = 12;
const SELECTION_MAX = 12;

const INVALID_MESSAGE =
  "courses noto'g'ri: 1 dan 12 gacha butun sonlar, vergul bilan (masalan courses=1,2,3,4)";

const COURSE_TOKEN = /^\d{1,2}$/;

const NONE = Object.freeze({ courses: null, error: null });
const INVALID = Object.freeze({ courses: null, error: INVALID_MESSAGE });

const toTokens = (raw) => {
  const parts = Array.isArray(raw) ? raw : [raw];
  if (!parts.every((p) => typeof p === "string")) return null;
  return parts
    .join(",")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
};

const toCourseNum = (token) => {
  if (!COURSE_TOKEN.test(token)) return null;
  const n = Number(token);
  return n >= COURSE_MIN && n <= COURSE_MAX ? n : null;
};

const parseCourseSelection = (raw) => {
  if (raw === undefined || raw === null) return NONE;
  const tokens = toTokens(raw);
  if (!tokens || tokens.length > SELECTION_MAX) return INVALID;
  if (tokens.length === 0) return NONE;

  const nums = tokens.map(toCourseNum);
  if (nums.includes(null)) return INVALID;
  return { courses: [...new Set(nums)].sort((a, b) => a - b), error: null };
};

const pickSelectedCourses = (courses, selected) => {
  const list = courses || [];
  if (!selected) return { courses: list, missing: [] };
  const wanted = new Set(selected);
  const present = new Set(list.map((c) => Number(c?.courseNum)));
  return {
    courses: list.filter((c) => wanted.has(Number(c?.courseNum))),
    missing: selected.filter((n) => !present.has(n)),
  };
};

module.exports = {
  COURSE_MAX,
  SELECTION_MAX,
  parseCourseSelection,
  pickSelectedCourses,
};
