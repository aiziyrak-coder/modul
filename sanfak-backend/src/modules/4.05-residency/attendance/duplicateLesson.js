"use strict";

const { ErrorHandler } = require("#shared/error");

const DUPLICATE_LESSON_MESSAGE = "Bu dars uchun davomat allaqachon kiritilgan";
const DUPLICATE_LESSON_REASON = "duplicate_lesson";

const isDuplicateLessonError = (err) => err?.code === 11000;

const duplicateLessonError = () =>
  new ErrorHandler(400, DUPLICATE_LESSON_MESSAGE, "", {
    reason: DUPLICATE_LESSON_REASON,
  });

const attendanceWriteError = (err, fallbackMessage) =>
  isDuplicateLessonError(err)
    ? duplicateLessonError()
    : new ErrorHandler(400, fallbackMessage, err?.message);

module.exports = {
  DUPLICATE_LESSON_MESSAGE,
  DUPLICATE_LESSON_REASON,
  isDuplicateLessonError,
  duplicateLessonError,
  attendanceWriteError,
};
