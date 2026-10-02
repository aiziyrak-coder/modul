const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const createPositionSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

const updatePositionSchema = Joi.object({
  title: multiLangSchema.optional(),
  desc: multiLangOptional.optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createPositionSchema, updatePositionSchema };
