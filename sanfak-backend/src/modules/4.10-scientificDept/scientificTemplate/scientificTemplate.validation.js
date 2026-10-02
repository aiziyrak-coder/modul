const Joi = require("joi");
const { optionalString } = require("#validators/common");

const TEMPLATE_CATEGORIES = ["methodical", "monograph"];

const createTemplateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(300).required(),
  description: Joi.string().trim().allow("").max(1000).optional(),
  category: Joi.string()
    .valid(...TEMPLATE_CATEGORIES)
    .required(),
  file: Joi.any(),
});

const updateTemplateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(300),
  description: Joi.string().trim().allow("").max(1000),
  category: Joi.string().valid(...TEMPLATE_CATEGORIES),
  active: Joi.boolean(),
  file: Joi.any(),
}).min(1);

const templateQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  category: optionalString(Joi.string().valid(...TEMPLATE_CATEGORIES)),
  active: Joi.boolean().optional(),
});

const templatePaginateSchema = templateQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  TEMPLATE_CATEGORIES,
  createTemplateSchema,
  updateTemplateSchema,
  templateQuerySchema,
  templatePaginateSchema,
};
