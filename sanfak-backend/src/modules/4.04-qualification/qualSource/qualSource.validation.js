const Joi = require("joi");

const createSchema = Joi.object({
  course: Joi.string().required(),
  title: Joi.string().required(),
  link: Joi.string().allow(null, "").optional(),
  file: Joi.string().required(),
});

const updateSchema = Joi.object({
  course: Joi.string().optional(),
  title: Joi.string().optional(),
  link: Joi.string().allow(null, "").optional(),
  file: Joi.string().optional(),
  fileDetails: Joi.object().optional(),
});

const byCourseNameQuery = Joi.object({
  course: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required(),
});

module.exports = { createSchema, updateSchema, byCourseNameQuery };
