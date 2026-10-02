const mongoose = require("mongoose");
const AcademicYearModel = require("#references/academicYear/academicYear.model");

const _cache = {
  byId: null,
  loadedAt: 0,
};

const TTL_MS = 60 * 1000;

const normalizeTitle = (s) => {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (!t) return null;
  if (/^\d{4}\/\d{4}$/.test(t)) return t;
  let m = t.match(/^(\d{4})\s*[-/–—]\s*(\d{4})$/);
  if (m) return `${m[1]}/${m[2]}`;
  m = t.match(/^(\d{4})\s*[-/–—]\s*(\d{2})$/);
  if (m) {
    const start = parseInt(m[1], 10);
    const endShort = parseInt(m[2], 10);
    const startShort = start % 100;
    const endFull =
      endShort < startShort
        ? Math.floor(start / 100 + 1) * 100 + endShort
        : Math.floor(start / 100) * 100 + endShort;
    return `${start}/${endFull}`;
  }
  m = t.match(/^(\d{4})$/);
  if (m) {
    const start = parseInt(m[1], 10);
    return `${start}/${start + 1}`;
  }
  return null;
};

async function loadCacheById() {
  const now = Date.now();
  if (_cache.byId && now - _cache.loadedAt < TTL_MS) return;

  const docs = await AcademicYearModel.find({ active: true })
    .select("title")
    .lean();
  const byId = new Map();
  for (const ay of docs) byId.set(String(ay._id), ay.title);
  _cache.byId = byId;
  _cache.loadedAt = now;
}

function resolveAcademicYearId(input) {
  if (!input) return null;
  if (input instanceof mongoose.Types.ObjectId) return input;
  if (typeof input === "string" && /^[a-f0-9]{24}$/i.test(input)) {
    return new mongoose.Types.ObjectId(input);
  }
  return null;
}

async function getAcademicYearTitle(yearId) {
  if (!yearId) return null;
  await loadCacheById();
  const cached = _cache.byId.get(String(yearId));
  if (cached) return cached;
  const doc = await AcademicYearModel.findById(yearId).select("title").lean();
  if (!doc) return null;
  _cache.byId.set(String(yearId), doc.title);
  return doc.title;
}

async function getYearPrefix(yearId) {
  const title = await getAcademicYearTitle(yearId);
  return title ? title.slice(0, 4) : null;
}

function clearCache() {
  _cache.byId = null;
  _cache.loadedAt = 0;
}

module.exports = {
  resolveAcademicYearId,
  getAcademicYearTitle,
  getYearPrefix,
  normalizeTitle,
  clearCache,
};
