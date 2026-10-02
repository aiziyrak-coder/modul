const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const createReadingFormSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

const updateReadingFormSchema = Joi.object({
  title: multiLangOptional.optional(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createReadingFormSchema, updateReadingFormSchema };
