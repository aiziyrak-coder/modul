const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const createDivisionSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  faculty: Joi.string().optional(),
  department: Joi.string().optional(),
  active: Joi.boolean().optional(),
});

const updateDivisionSchema = Joi.object({
  title: multiLangSchema.optional(),
  desc: multiLangOptional.optional(),
  faculty: Joi.string().optional(),
  department: Joi.string().optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createDivisionSchema, updateDivisionSchema };
