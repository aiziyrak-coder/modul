const Joi = require("joi");
const { optionalString } = require("#validators/common");

const THESIS_TYPES = ["national", "international"];

const createCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(300).required(),
  type: Joi.string()
    .valid(...THESIS_TYPES)
    .required(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().trim().min(2).max(300),
  type: Joi.string().valid(...THESIS_TYPES),
  active: Joi.boolean(),
}).min(1);

const categoryQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  type: optionalString(Joi.string().valid(...THESIS_TYPES)),
  active: Joi.boolean().optional(),
});

const categoryPaginateSchema = categoryQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  THESIS_TYPES,
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
  categoryPaginateSchema,
};
