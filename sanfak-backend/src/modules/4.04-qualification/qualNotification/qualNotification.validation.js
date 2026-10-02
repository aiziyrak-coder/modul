const Joi = require("joi");

const createSchema = Joi.object({
  title: Joi.string().required(),
});

const updateSchema = Joi.object({
  title: Joi.string().optional(),
});

module.exports = { createSchema, updateSchema };
