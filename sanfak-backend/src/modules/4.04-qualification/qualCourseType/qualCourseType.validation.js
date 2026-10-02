const Joi = require("joi");
const { optionalString } = require("#validators/common");

const createSchema = Joi.object({
  title: Joi.string().required(),
  kind: Joi.number().required(),
  template: Joi.number().valid(1, 2, 3).optional(),
  file: optionalString(),
});

const updateSchema = Joi.object({
  title: Joi.string().optional(),
  kind: Joi.number().optional(),
  template: Joi.number().valid(1, 2, 3).optional(),
  file: optionalString(),
  fileDetails: Joi.object().optional(),
});

module.exports = { createSchema, updateSchema };
