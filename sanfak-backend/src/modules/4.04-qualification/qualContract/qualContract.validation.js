const Joi = require("joi");
const { optionalString } = require("#validators/common");

const createSchema = Joi.object({
  course: Joi.string().required(),
  listener: Joi.string().required(),
  petition: Joi.string().required(),
  totalPrice: Joi.number().required(),
  debitPrice: Joi.number().required(),
  file: Joi.string().required(),
});

const updateSchema = Joi.object({
  course: Joi.string().optional(),
  listener: Joi.string().optional(),
  petition: Joi.string().optional(),
  totalPrice: Joi.number().optional(),
  debitPrice: Joi.number().optional(),
  file: optionalString(),
  fileDetails: Joi.object().optional(),
});

module.exports = { createSchema, updateSchema };
