const Joi = require("joi");

const objectId = Joi.string().hex().length(24);

const idsSchema = Joi.object({
  ids: Joi.array().items(objectId).min(1).max(100).required(),
});

const rejectSchema = Joi.object({
  ids: Joi.array().items(objectId).min(1).max(100).required(),
  reason: Joi.string().trim().min(1).max(500).required(),
});

module.exports = { idsSchema, rejectSchema };
