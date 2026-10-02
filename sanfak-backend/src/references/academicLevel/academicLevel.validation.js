const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const createAcademicLevelSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

const updateAcademicLevelSchema = Joi.object({
  title: multiLangOptional.optional(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createAcademicLevelSchema, updateAcademicLevelSchema };
