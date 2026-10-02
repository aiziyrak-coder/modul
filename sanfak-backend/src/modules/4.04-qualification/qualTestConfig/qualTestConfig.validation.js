const Joi = require("joi");
const { optionalString } = require("#validators/common");
const objectId = Joi.string().length(24).hex();

const findSchema = Joi.object({
  course: objectId.required(),
  kind: Joi.number().valid(1, 2, 3).required(),
  topic: objectId.optional(),
  language: optionalString(),
});

const upsertSchema = Joi.object({
  course: objectId.required(),
  kind: Joi.number().valid(1, 2, 3).required(),
  topic: objectId.optional(),
  timeLimit: Joi.number().min(0).required(),
  randomCount: Joi.number().min(0).required(),
  passPercentage: Joi.number().min(0).max(100).required(),
});

module.exports = { findSchema, upsertSchema };
