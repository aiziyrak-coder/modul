const Joi = require("joi");

const code = Joi.string().trim().min(2).max(32);
const title = Joi.string().trim().min(2).max(300);
const branch = Joi.string().trim().min(2).max(200);

const createSpecialtySchema = Joi.object({
  title: title.required(),
  code: code.required(),
  branch: branch.required(),
  active: Joi.boolean().optional(),
});

const updateSpecialtySchema = Joi.object({
  title,
  code,
  branch,
  active: Joi.boolean(),
}).min(1);

const listSpecialtyQuery = Joi.object({
  search: Joi.string().allow("").optional(),
  active: Joi.boolean().optional(),
  all: Joi.boolean().optional(),
  free: Joi.boolean().optional(),
  exceptNumber: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});

module.exports = {
  createSpecialtySchema,
  updateSpecialtySchema,
  listSpecialtyQuery,
};
