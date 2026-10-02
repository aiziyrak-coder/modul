const Joi = require("joi");

const createAcademicTitleSchema = Joi.object({
  title: Joi.string().required(),
  position: Joi.string().required(),
  rateTime: Joi.number().required(),
  active: Joi.boolean().optional(),
});

const updateAcademicTitleSchema = Joi.object({
  title: Joi.string().optional(),
  position: Joi.string().optional(),
  rateTime: Joi.number().optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createAcademicTitleSchema, updateAcademicTitleSchema };
