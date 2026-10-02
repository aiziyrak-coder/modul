const Joi = require("joi");

const ACADEMIC_YEAR_PATTERN = /^\d{4}\/\d{4}$/;
const ACADEMIC_YEAR_MESSAGE =
  "O'quv yili formati noto'g'ri (YYYY/YYYY kutiladi, masalan: 2024/2025)";

const createAcademicYearSchema = Joi.object({
  title: Joi.string()
    .min(9)
    .max(9)
    .pattern(ACADEMIC_YEAR_PATTERN)
    .required()
    .messages({ "string.pattern.base": ACADEMIC_YEAR_MESSAGE }),
  active: Joi.boolean().optional(),
});

const updateAcademicYearSchema = Joi.object({
  title: Joi.string()
    .min(9)
    .max(9)
    .pattern(ACADEMIC_YEAR_PATTERN)
    .optional()
    .messages({ "string.pattern.base": ACADEMIC_YEAR_MESSAGE }),
  active: Joi.boolean().optional(),
});

module.exports = { createAcademicYearSchema, updateAcademicYearSchema };
