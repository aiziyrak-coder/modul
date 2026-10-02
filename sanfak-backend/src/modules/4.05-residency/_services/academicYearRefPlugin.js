"use strict";

const AcademicYear = require("#references/academicYear/academicYear.model");
const {
  normalizeTitle,
} = require("#references/_services/academicYearResolver");
const winston = require("#shared/winston.logger");

const TTL_MS = 60 * 1000;
const cache = { byTitle: null, loadedAt: 0 };

const loadIndex = async () => {
  const now = Date.now();
  if (cache.byTitle && now - cache.loadedAt < TTL_MS) return cache.byTitle;

  const rows = await AcademicYear.find({}).select("title").lean();
  const byTitle = new Map();
  for (const r of rows) {
    const key = normalizeTitle(r.title);
    if (key) byTitle.set(key, { id: r._id, title: r.title });
  }
  cache.byTitle = byTitle;
  cache.loadedAt = now;
  return byTitle;
};

const resolveByTitle = async (value) => {
  if (value === null || value === undefined || value === "") return null;
  const key = normalizeTitle(value);
  if (!key) return null;
  const byTitle = await loadIndex();
  return byTitle.get(key) ?? null;
};

const HEX24 = /^[0-9a-fA-F]{24}$/;

const normalizeInput = async (value) => {
  if (value === null || value === undefined || value === "") {
    return { title: value ?? null, ref: null };
  }
  const raw = String(value);

  if (HEX24.test(raw)) {
    const row = await AcademicYear.findById(raw).select("title").lean();
    if (!row) return null;
    return { title: row.title, ref: row._id };
  }

  const row = await resolveByTitle(raw);
  return row ? { title: row.title, ref: row.id } : { title: raw, ref: null };
};

const clearCache = () => {
  cache.byTitle = null;
  cache.loadedAt = 0;
};

const academicYearRefPlugin = (schema) => {
  schema.pre("save", async function preSaveAcademicYearRef(next) {
    if (!this.isModified("academicYear")) return next();
    try {
      const norm = await normalizeInput(this.academicYear);
      if (norm) {
        this.academicYear = norm.title;
        this.academicYearRef = norm.ref;
      }
    } catch (err) {
      winston.warn(`[4.5 academicYearRef] pre-save: ${err.message}`);
    }
    return next();
  });

  schema.pre(
    ["findOneAndUpdate", "updateOne", "updateMany"],
    async function preUpdateAcademicYearRef(next) {
      const update = this.getUpdate();
      if (!update) return next();

      const has = (o) => o && Object.hasOwn(o, "academicYear");
      const target = has(update.$set) ? update.$set : has(update) ? update : null;
      if (!target) return next();

      try {
        const norm = await normalizeInput(target.academicYear);
        if (norm) {
          target.academicYear = norm.title;
          target.academicYearRef = norm.ref;
          this.setUpdate(update);
        }
      } catch (err) {
        winston.warn(`[4.5 academicYearRef] pre-update: ${err.message}`);
      }
      return next();
    },
  );
};

module.exports = academicYearRefPlugin;
module.exports.resolveByTitle = resolveByTitle;
module.exports.normalizeInput = normalizeInput;
module.exports.HEX24 = HEX24;
module.exports.clearCache = clearCache;
