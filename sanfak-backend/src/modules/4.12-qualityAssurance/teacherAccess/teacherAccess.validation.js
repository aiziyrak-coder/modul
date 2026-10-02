const Joi = require("joi");

const teacherAccessSchema = Joi.object({
  active: Joi.boolean().required(),
  activeFrom: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null, "")
    .optional(),
});

module.exports = { teacherAccessSchema };
