const Joi = require("joi");
const { optionalString } = require("#validators/common");

const createSchema = Joi.object({
  name: Joi.string().trim().min(1).required(),
  active: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).optional(),
  active: Joi.boolean().optional(),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: optionalString(),
  active: Joi.boolean().optional(),
});

const findAll = Joi.object({
  search: optionalString(),
  active: Joi.boolean().optional(),
});

const idSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createSchema,
  updateSchema,
  paginate,
  findAll,
  idSchema,
};
