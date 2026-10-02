const CourseModel = require("#references/course/course.model");

const _cache = {
  byTitle: null,
  byNum: null,
  loadedAt: 0,
};

const TTL_MS = 60 * 1000;

const ROMAN_TO_NUM = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
};

const numToRoman = (n) => {
  const arr = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return arr[n] || String(n);
};

const normalizeTitle = (s) => {
  if (s === null || s === undefined) return null;
  let t = String(s).trim().toUpperCase();
  t = t.replace(/[-_\s]?KURS$/i, "").trim();
  return t || null;
};

async function loadCache() {
  const now = Date.now();
  if (_cache.byTitle && now - _cache.loadedAt < TTL_MS) return;

  const docs = await CourseModel.find({ active: true })
    .select("title")
    .lean();

  const byTitle = new Map();
  const byNum = new Map();

  for (const c of docs) {
    const norm = normalizeTitle(c.title);
    if (norm) byTitle.set(norm, c._id);

    const asNum = parseInt(norm, 10);
    if (!isNaN(asNum)) byNum.set(asNum, c._id);

    if (norm in ROMAN_TO_NUM) byNum.set(ROMAN_TO_NUM[norm], c._id);
  }

  _cache.byTitle = byTitle;
  _cache.byNum = byNum;
  _cache.loadedAt = now;
}

async function resolveCourse(input) {
  if (input === null || input === undefined || input === "") return null;
  await loadCache();

  if (typeof input === "number") {
    return _cache.byNum.get(input) || null;
  }

  const norm = normalizeTitle(input);
  if (!norm) return null;

  const direct = _cache.byTitle.get(norm);
  if (direct) return direct;

  if (norm in ROMAN_TO_NUM) {
    const num = ROMAN_TO_NUM[norm];
    return _cache.byNum.get(num) || null;
  }

  const asNum = parseInt(norm, 10);
  if (!isNaN(asNum)) {
    return _cache.byNum.get(asNum) || _cache.byTitle.get(numToRoman(asNum)) || null;
  }

  return null;
}

async function resolveCourses(inputs) {
  if (!Array.isArray(inputs)) return [];
  await loadCache();
  const out = [];
  for (const input of inputs) {
    const id = await resolveCourse(input);
    out.push(id);
  }
  return out;
}

function clearCache() {
  _cache.byTitle = null;
  _cache.byNum = null;
  _cache.loadedAt = 0;
}

module.exports = {
  resolveCourse,
  resolveCourses,
  clearCache,
  normalizeTitle,
};
