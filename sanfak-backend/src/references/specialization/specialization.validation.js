const Joi = require("joi");
const {
  multiLangSchema,
  multiLangOptional,
  optionalString,
} = require("#validators/common");

const createSpecializationSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  date: optionalString(),
  active: Joi.boolean().optional(),
});

const updateSpecializationSchema = Joi.object({
  title: multiLangOptional.optional(),
  desc: multiLangOptional.optional(),
  date: optionalString(),
  active: Joi.boolean().optional(),
});

module.exports = { createSpecializationSchema, updateSpecializationSchema };
