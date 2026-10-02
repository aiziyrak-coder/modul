const Joi = require("joi");

const createPermissionGroupSchema = Joi.object({
  code: Joi.string().required().trim(),
  title: Joi.string().required().trim(),
  desc: Joi.string().optional().allow(null, ""),
  active: Joi.boolean().optional(),
});

const updatePermissionGroupSchema = Joi.object({
  code: Joi.string().optional().trim(),
  title: Joi.string().optional().trim(),
  desc: Joi.string().optional().allow(null, ""),
  active: Joi.boolean().optional(),
});

module.exports = {
  createPermissionGroupSchema,
  updatePermissionGroupSchema,
};
