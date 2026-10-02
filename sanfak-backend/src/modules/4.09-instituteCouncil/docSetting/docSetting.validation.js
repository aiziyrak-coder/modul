const Joi = require("joi");

const docItemSchema = Joi.object({
  name: Joi.string().required(),
  required: Joi.boolean().optional(),
  order: Joi.number().integer().optional(),
  maxFiles: Joi.number().integer().min(1).max(20).optional(),
});

const categoriesSchema = Joi.object({
  rank: Joi.array().items(docItemSchema).optional(),
  position: Joi.array().items(docItemSchema).optional(),
});

const updateSettingsSchema = Joi.object({
  categories: categoriesSchema.optional(),
  rankTypes: Joi.array().items(Joi.string().trim().min(1)).min(1).optional(),
  positionTypes: Joi.array().items(Joi.string().trim().min(1)).min(1).optional(),
  passingPercent: Joi.number().integer().min(0).max(100).optional(),
});

module.exports = {
  updateSettingsSchema,
};
