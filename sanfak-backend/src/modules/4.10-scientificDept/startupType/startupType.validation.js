const Joi = require("joi");

const createStartupTypeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required().messages({
    "any.required": "Loyiha turi nomi kiritilishi shart",
    "string.empty": "Loyiha turi nomi kiritilishi shart",
    "string.min": "Loyiha turi nomi juda qisqa",
  }),
  active: Joi.boolean().optional(),
});

const updateStartupTypeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  active: Joi.boolean(),
}).min(1);

const startupTypeQuerySchema = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  active: Joi.boolean().optional(),
  language: Joi.string().valid("uz", "ru", "en").optional(),
});

const startupTypePaginateSchema = startupTypeQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  createStartupTypeSchema,
  updateStartupTypeSchema,
  startupTypeQuerySchema,
  startupTypePaginateSchema,
};
