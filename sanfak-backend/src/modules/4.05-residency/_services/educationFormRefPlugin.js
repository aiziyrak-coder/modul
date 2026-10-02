"use strict";

const mongoose = require("mongoose");
const EducationForm = require("#references/educationForm/educationForm.model");
const winston = require("#shared/winston.logger");

const TTL_MS = 60 * 1000;
const cache = { byTitle: null, loadedAt: 0 };

const key = (s) => String(s).trim().toLowerCase();

const loadIndex = async () => {
  const now = Date.now();
  if (cache.byTitle && now - cache.loadedAt < TTL_MS) return cache.byTitle;
  const rows = await EducationForm.find({}).select("title").lean();
  const byTitle = new Map();
  for (const r of rows) byTitle.set(key(r.title), r._id);
  cache.byTitle = byTitle;
  cache.loadedAt = now;
  return byTitle;
};

const resolveEducationForm = async (value) => {
  if (value === null || value === undefined || value === "") return null;
  const byTitle = await loadIndex();
  return byTitle.get(key(value)) ?? null;
};

const clearCache = () => {
  cache.byTitle = null;
  cache.loadedAt = 0;
};

const unknownForm = (value) => {
  const err = new mongoose.Error.ValidationError();
  err.addError(
    "educationForm",
    new mongoose.Error.ValidatorError({
      path: "educationForm",
      message: `"${value}" ta'lim shakli ma'lumotnomada topilmadi`,
      value,
    }),
  );
  return err;
};

const educationFormRefPlugin = (schema) => {
  schema.pre("save", async function preSaveEducationFormRef(next) {
    if (!this.isNew && !this.isModified("educationForm")) return next();
    try {
      const ref = await resolveEducationForm(this.educationForm);
      if (!ref && this.educationForm) return next(unknownForm(this.educationForm));
      this.educationFormRef = ref;
    } catch (err) {
      winston.warn(`[4.5 educationFormRef] pre-save: ${err.message}`);
    }
    return next();
  });

  schema.pre(
    ["findOneAndUpdate", "updateOne", "updateMany"],
    async function preUpdateEducationFormRef(next) {
      const update = this.getUpdate();
      if (!update) return next();
      const has = (o) => o && Object.hasOwn(o, "educationForm");
      const target = has(update.$set) ? update.$set : has(update) ? update : null;
      if (!target) return next();
      try {
        const ref = await resolveEducationForm(target.educationForm);
        if (!ref && target.educationForm) {
          return next(unknownForm(target.educationForm));
        }
        target.educationFormRef = ref;
        this.setUpdate(update);
      } catch (err) {
        winston.warn(`[4.5 educationFormRef] pre-update: ${err.message}`);
      }
      return next();
    },
  );
};

module.exports = educationFormRefPlugin;
module.exports.resolveEducationForm = resolveEducationForm;
module.exports.clearCache = clearCache;
