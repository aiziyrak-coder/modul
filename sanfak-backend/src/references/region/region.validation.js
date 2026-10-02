const Joi = require("joi");

const createSchema = Joi.object({
  title: Joi.string().min(1).required(),
  province: Joi.string().required(),
  active: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  province: Joi.string().optional(),
  active: Joi.boolean().optional(),
});

const findAll = Joi.object({
  search: Joi.string().optional(),
  active: Joi.boolean().optional(),
  province: Joi.string().optional(),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: Joi.string().optional(),
  active: Joi.boolean().optional(),
  province: Joi.string().optional(),
});

const readSchema = Joi.object({ id: Joi.string().required() });
const deleteSchema = Joi.object({ id: Joi.string().required() });

module.exports = {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
