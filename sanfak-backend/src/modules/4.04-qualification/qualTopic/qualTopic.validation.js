const Joi = require("joi");
const objectId = Joi.string().length(24).hex();

const createSchema = Joi.object({
  title: Joi.string().required(),
  code: Joi.string().trim().max(50).allow("").optional(),
  orderNumber: Joi.number().integer().min(1).optional(),
  kind: Joi.number().valid(1, 2).required(),
  duration: Joi.number().integer().min(1).required(),
  course: objectId.required(),
  finalTest: Joi.object({
    passPercentage: Joi.number().min(0).max(100).optional(),
    totalQuestions: Joi.number().integer().min(1).optional(),
    duration: Joi.number().integer().min(1).optional(),
  }).optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().optional(),
  code: Joi.string().trim().max(50).allow("").optional(),
  orderNumber: Joi.number().integer().min(1).optional(),
  kind: Joi.number().valid(1, 2).optional(),
  duration: Joi.number().integer().min(1).optional(),
  course: objectId.optional(),
  finalTest: Joi.object({
    passPercentage: Joi.number().min(0).max(100).required(),
    totalQuestions: Joi.number().integer().min(1).required(),
    duration: Joi.number().integer().min(1).required(),
  }).optional(),
});

module.exports = { createSchema, updateSchema };
