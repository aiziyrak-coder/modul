const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const createEducationFormSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
  isInternational: Joi.boolean().optional(),
});

const updateEducationFormSchema = Joi.object({
  title: multiLangOptional.optional(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
  isInternational: Joi.boolean().optional(),
});

module.exports = { createEducationFormSchema, updateEducationFormSchema };
