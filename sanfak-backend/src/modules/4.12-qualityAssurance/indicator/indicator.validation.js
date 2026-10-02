const Joi = require("joi");
const { multiLangSchema, multiLangOptional } = require("#validators/common");

const indicatorSchema = Joi.object({
  title: multiLangSchema.required(),
  desc: multiLangOptional.optional(),
  coefficient: Joi.number().optional(),
  dataFields: Joi.array().optional(),
  category: multiLangOptional.optional(),
  order: Joi.number().optional(),
});

const indicatorUpdateSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  desc: multiLangOptional.optional(),
  coefficient: Joi.number().optional(),
  dataFields: Joi.array().optional(),
  category: multiLangOptional.optional(),
  order: Joi.number().optional(),
  active: Joi.boolean().optional(),
});

module.exports = { indicatorSchema, indicatorUpdateSchema };
