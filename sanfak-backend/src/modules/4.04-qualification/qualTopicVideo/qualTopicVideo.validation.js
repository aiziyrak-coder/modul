const Joi = require("joi");
const { optionalString } = require("#validators/common");
const objectId = Joi.string().length(24).hex();

const findSchema = Joi.object({
  course: objectId.optional(),
  topic: objectId.optional(),
  language: optionalString(),
});

const createSchema = Joi.object({
  course: objectId.required(),
  topic: objectId.required(),
  title: Joi.string().required(),
  videoRaw: Joi.string().required(),
});

const updateSchema = Joi.object({
  title: Joi.string().optional(),
  videoRaw: Joi.string().optional(),
}).min(1);

module.exports = { findSchema, createSchema, updateSchema };
