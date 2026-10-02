const Joi = require("joi");
const { optionalString } = require("#validators/common");

const permissionSchema = Joi.object({
  title: optionalString(),
  section: Joi.string().required(),
  actionKeys: Joi.array().items(Joi.string()),
  active: Joi.boolean().optional(),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
});

const updatedSchema = Joi.object({
  title: optionalString(),
  section: Joi.string().optional(),
  actionKeys: Joi.array().items(Joi.string()),
  active: Joi.boolean().optional(),
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = { permissionSchema, readSchema, updatedSchema, deleteSchema };
