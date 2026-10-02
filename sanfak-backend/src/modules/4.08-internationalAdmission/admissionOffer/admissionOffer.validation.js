const Joi = require("joi");

const blockSchema = Joi.object({
  titleUz: Joi.string().trim().min(1).max(300).required(),
  titleRu: Joi.string().trim().max(300).allow("", null),
  titleEn: Joi.string().trim().max(300).allow("", null),
  bodyUz: Joi.string().trim().max(10000).allow("", null),
  bodyRu: Joi.string().trim().max(10000).allow("", null),
  bodyEn: Joi.string().trim().max(10000).allow("", null),
});

const saveSchema = Joi.object({
  blocks: Joi.array().items(blockSchema).min(1).max(100).required(),
});

module.exports = { saveSchema, blockSchema };
