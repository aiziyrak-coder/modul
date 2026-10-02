const Joi = require("joi");

const createEducationActivityTypeSchema = Joi.object({
  title: Joi.string().required().trim(),
  desc: Joi.string().optional().allow(null, ""),
  flow: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
});

const updateEducationActivityTypeSchema = Joi.object({
  title: Joi.string().optional().trim(),
  desc: Joi.string().optional().allow(null, ""),
  flow: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
});

module.exports = {
  createEducationActivityTypeSchema,
  updateEducationActivityTypeSchema,
};
