const Joi = require("joi");
const { optionalString } = require("#validators/common");

const docTypeSchema = Joi.object({
  title: Joi.string().required(),
  desc: Joi.string().allow(null, "").optional(),
  active: Joi.boolean().optional(),
  personal: Joi.boolean().optional(),
});

const updateSchema = docTypeSchema.fork(["title"], (s) => s.optional());

const findAll = Joi.object({
  search: optionalString(Joi.string().trim()),
  active: Joi.boolean().optional(),
});

const readSchema = Joi.object({ id: Joi.string().required() });
const deleteSchema = Joi.object({ id: Joi.string().required() });

module.exports = { docTypeSchema, updateSchema, findAll, readSchema, deleteSchema };
