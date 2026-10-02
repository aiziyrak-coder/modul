const Joi = require("joi");

const key = Joi.string().trim().min(2).max(64);
const labelUz = Joi.string().trim().min(1).max(300);
const labelRu = Joi.string().trim().max(300).allow("", null);
const format = Joi.string().trim().min(1).max(64);

const createWorkDocumentTypeSchema = Joi.object({
  key: key.required(),
  labelUz: labelUz.required(),
  labelRu: labelRu.optional(),
  format: format.required(),
  required: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
  order: Joi.number().integer().min(0).optional(),
});

const updateWorkDocumentTypeSchema = Joi.object({
  key,
  labelUz,
  labelRu,
  format,
  required: Joi.boolean(),
  active: Joi.boolean(),
  order: Joi.number().integer().min(0),
}).min(1);

const listWorkDocumentTypeQuery = Joi.object({
  search: Joi.string().allow("").optional(),
  active: Joi.boolean().optional(),
  all: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});

module.exports = {
  createWorkDocumentTypeSchema,
  updateWorkDocumentTypeSchema,
  listWorkDocumentTypeQuery,
};
