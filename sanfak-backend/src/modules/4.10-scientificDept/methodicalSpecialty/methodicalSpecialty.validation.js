const Joi = require("joi");

const createSpecialtySchema = Joi.object({
  code: Joi.string().trim().min(1).max(50).required().messages({
    "any.required": "Ixtisoslik shifri kiritilishi shart",
    "string.empty": "Ixtisoslik shifri kiritilishi shart",
  }),
  name: Joi.string().trim().min(2).max(200).required().messages({
    "any.required": "Ixtisoslik nomi kiritilishi shart",
    "string.min": "Ixtisoslik nomi juda qisqa",
  }),
  active: Joi.boolean().optional(),
});

const updateSpecialtySchema = Joi.object({
  code: Joi.string().trim().min(1).max(50),
  name: Joi.string().trim().min(2).max(200),
  active: Joi.boolean(),
}).min(1);

const specialtyQuerySchema = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  active: Joi.boolean().optional(),
  language: Joi.string().valid("uz", "ru", "en").optional(),
});

const specialtyPaginateSchema = specialtyQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  createSpecialtySchema,
  updateSpecialtySchema,
  specialtyQuerySchema,
  specialtyPaginateSchema,
};
