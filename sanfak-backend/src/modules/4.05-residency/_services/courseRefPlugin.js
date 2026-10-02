"use strict";

const {
  resolveCourse,
  resolveCourses,
} = require("#references/_services/courseResolver");
const winston = require("#shared/winston.logger");

const normalizeCourse = async (value) => {
  if (value === null || value === undefined || value === "") {
    return { number: null, ref: null };
  }
  const num = Number(value);
  return {
    number: Number.isFinite(num) ? num : null,
    ref: await resolveCourse(value),
  };
};

const normalizeCourseList = async (values) => {
  if (!Array.isArray(values)) return null;
  if (!values.length) return { numbers: [], refs: [] };

  const numbers = [];
  const refs = [];
  for (const v of values) {
    const norm = await normalizeCourse(v);
    if (!norm) continue;
    if (norm.number !== null) numbers.push(norm.number);
    if (norm.ref) refs.push(norm.ref);
  }
  return { numbers: [...new Set(numbers)], refs };
};

const courseRefPlugin = (schema) => {
  schema.pre("save", async function preSaveCourseRef(next) {
    if (!this.isModified("courseNumber")) return next();
    try {
      const norm = await normalizeCourse(this.courseNumber);
      if (norm) {
        this.courseNumber = norm.number;
        this.courseRef = norm.ref;
      }
    } catch (err) {
      winston.warn(`[4.5 courseRef] pre-save: ${err.message}`);
    }
    return next();
  });

  schema.pre(
    ["findOneAndUpdate", "updateOne", "updateMany"],
    async function preUpdateCourseRef(next) {
      const update = this.getUpdate();
      if (!update) return next();
      const has = (o) => o && Object.hasOwn(o, "courseNumber");
      const target = has(update.$set) ? update.$set : has(update) ? update : null;
      if (!target) return next();

      try {
        const norm = await normalizeCourse(target.courseNumber);
        if (norm) {
          target.courseNumber = norm.number;
          target.courseRef = norm.ref;
          this.setUpdate(update);
        }
      } catch (err) {
        winston.warn(`[4.5 courseRef] pre-update: ${err.message}`);
      }
      return next();
    },
  );
};

const targetCoursesRefPlugin = (schema) => {
  const sync = async (target) => {
    const norm = await normalizeCourseList(target.targetCourses);
    if (!norm) return;
    target.targetCourses = norm.numbers;
    target.targetCoursesRef = norm.refs;
  };

  schema.pre("save", async function preSaveTargetCourses(next) {
    if (!this.isModified("targetCourses")) return next();
    try {
      await sync(this);
    } catch (err) {
      winston.warn(`[4.5 targetCoursesRef] pre-save: ${err.message}`);
    }
    return next();
  });

  schema.pre(
    ["findOneAndUpdate", "updateOne", "updateMany"],
    async function preUpdateTargetCourses(next) {
      const update = this.getUpdate();
      if (!update) return next();
      const has = (o) => o && Object.hasOwn(o, "targetCourses");
      const target = has(update.$set) ? update.$set : has(update) ? update : null;
      if (!target) return next();
      try {
        await sync(target);
        this.setUpdate(update);
      } catch (err) {
        winston.warn(`[4.5 targetCoursesRef] pre-update: ${err.message}`);
      }
      return next();
    },
  );
};

module.exports = courseRefPlugin;
module.exports.targetCoursesRefPlugin = targetCoursesRefPlugin;
module.exports.normalizeCourse = normalizeCourse;
module.exports.normalizeCourseList = normalizeCourseList;
module.exports.resolveCourses = resolveCourses;
