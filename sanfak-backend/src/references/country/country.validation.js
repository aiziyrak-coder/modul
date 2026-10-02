const Joi = require("joi");

const createCountrySchema = Joi.object({
  title: Joi.string().optional().allow("", null),
  code: Joi.string().optional().allow("", null),
  active: Joi.boolean().optional(),
}).unknown(true);

const updateCountrySchema = Joi.object({
  title: Joi.string().optional().allow("", null),
  code: Joi.string().optional().allow("", null),
  active: Joi.boolean().optional(),
}).unknown(true);

module.exports = {
  createCountrySchema,
  updateCountrySchema,
};
