const Joi = require("joi");
const {
  multiLangSchema,
  multiLangOptional,
  optionalObjectId,
} = require("#validators/common");

const createDepartmentSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  faculty: Joi.string().optional(),
  head: optionalObjectId(),
  active: Joi.boolean().optional(),
});

const updateDepartmentSchema = Joi.object({
  title: multiLangSchema.optional(),
  desc: multiLangOptional.optional(),
  faculty: Joi.string().optional(),
  head: optionalObjectId(),
  active: Joi.boolean().optional(),
});

module.exports = { createDepartmentSchema, updateDepartmentSchema };
