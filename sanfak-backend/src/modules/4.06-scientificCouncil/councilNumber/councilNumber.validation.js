const Joi = require("joi");

const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/);
const number = Joi.string().trim().min(2).max(120);

const specialties = Joi.array().items(objectId).max(50);

const createNumberSchema = Joi.object({
  number: number.required(),
  specialties: specialties.optional(),
  active: Joi.boolean().optional(),
});

const updateNumberSchema = Joi.object({
  number,
  specialties,
  active: Joi.boolean(),
}).min(1);

const listNumberQuery = Joi.object({
  search: Joi.string().allow("").optional(),
  active: Joi.boolean().optional(),
  all: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional(),
});

module.exports = { createNumberSchema, updateNumberSchema, listNumberQuery };
