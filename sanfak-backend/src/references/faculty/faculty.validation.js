const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const createFacultySchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

const updateFacultySchema = Joi.object({
  title: multiLangOptional.optional(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createFacultySchema, updateFacultySchema };
