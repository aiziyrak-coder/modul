const Joi = require("joi");

const createReviewSchema = Joi.object({
  work: Joi.string().required(),
  docKey: Joi.string().required(),
  type: Joi.string().valid("positive", "neutral", "negative").required(),
  text: Joi.string().max(3000).allow("", null),
});

const updateReviewSchema = Joi.object({
  type: Joi.string().valid("positive", "neutral", "negative").optional(),
  text: Joi.string().max(3000).allow("", null),
});

module.exports = { createReviewSchema, updateReviewSchema };
