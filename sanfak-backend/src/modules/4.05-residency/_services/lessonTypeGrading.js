"use strict";

const { ErrorHandler } = require("#shared/error");

const UNGRADED_LESSON_TYPES = Object.freeze(["amaliy"]);
const LESSON_TYPE_NOT_GRADED = "lesson_type_not_graded";
const isGradedLessonType = (lessonType) => !UNGRADED_LESSON_TYPES.includes(lessonType);

const LESSON_TYPE_NOT_GRADED_MSG =
  "Amaliy mashg'ulotga har dars uchun ball qo'yilmaydi — oraliq nazorat orqali baholanadi";

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function lessonTypeScoreError(write, current = {}) {
  if (!has(write, "score") && !has(write, "lessonType")) return null;
  const lessonType = has(write, "lessonType") ? write.lessonType : current.lessonType;
  const score = has(write, "score") ? write.score : current.score;
  if (score === null || score === undefined || isGradedLessonType(lessonType)) return null;
  return new ErrorHandler(409, LESSON_TYPE_NOT_GRADED_MSG, LESSON_TYPE_NOT_GRADED, {
    reason: LESSON_TYPE_NOT_GRADED,
  });
}

function lessonTypeWriteGuard(write) {
  const writesScore = has(write, "score") && write.score !== null && write.score !== undefined;
  if (writesScore && !has(write, "lessonType")) {
    return { lessonType: { $nin: [...UNGRADED_LESSON_TYPES] } };
  }
  if (has(write, "lessonType") && !isGradedLessonType(write.lessonType) && !has(write, "score")) {
    return { score: null };
  }
  return {};
}

module.exports = {
  UNGRADED_LESSON_TYPES,
  LESSON_TYPE_NOT_GRADED,
  LESSON_TYPE_NOT_GRADED_MSG,
  isGradedLessonType,
  lessonTypeScoreError,
  lessonTypeWriteGuard,
};
