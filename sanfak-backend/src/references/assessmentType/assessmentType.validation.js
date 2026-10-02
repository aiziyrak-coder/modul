const Joi = require("joi");
const {
  multiLangSchema,
  multiLangOptional,
  optionalString,
} = require("#validators/common");

const createAssessmentTypeSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  date: optionalString(),
  active: Joi.boolean().optional(),
});

const updateAssessmentTypeSchema = Joi.object({
  title: multiLangOptional.optional(),
  desc: multiLangOptional.optional(),
  date: optionalString(),
  active: Joi.boolean().optional(),
});

module.exports = { createAssessmentTypeSchema, updateAssessmentTypeSchema };
