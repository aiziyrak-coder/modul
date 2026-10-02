const Joi = require("joi");
const { optionalString } = require("#validators/common");

const createSchema = Joi.object({
  title: Joi.string().min(1).required(),
  active: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  active: Joi.boolean().optional(),
});

const findAll = Joi.object({
  search: optionalString(),
  active: Joi.boolean().optional(),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: optionalString(),
  active: Joi.boolean().optional(),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
