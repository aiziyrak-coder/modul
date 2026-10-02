const Joi = require("joi");
const { multiLangOptional } = require("#validators/common");

const COURSE_TITLE_PATTERN = /^([1-9]|10)-kurs$/;
const COURSE_TITLE_MESSAGE =
  "Kurs nomi formati noto'g'ri (N-kurs kutiladi, masalan: 1-kurs)";

const courseTitleSchema = Joi.string()
  .pattern(COURSE_TITLE_PATTERN)
  .messages({ "string.pattern.base": COURSE_TITLE_MESSAGE });

const createCourseSchema = Joi.object({
  title: courseTitleSchema.required(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

const updateCourseSchema = Joi.object({
  title: courseTitleSchema.optional(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createCourseSchema, updateCourseSchema };
