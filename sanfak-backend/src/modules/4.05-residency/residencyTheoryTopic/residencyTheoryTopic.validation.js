const Joi = require("joi");
const { optionalBoolean } = require("#validators/common");

const createSchema = Joi.object({
  title: Joi.string().min(1).required(),
  active: optionalBoolean(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  active: optionalBoolean(),
});

const listQuery = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  active: optionalBoolean(),
});

const paginateQuery = listQuery.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const idSchema = Joi.object({ id: Joi.string().required() });

module.exports = { createSchema, updateSchema, listQuery, paginateQuery, idSchema };
