const Joi = require("joi");
const objectId = Joi.string().length(24).hex();

const optionSchema = Joi.object({
  text: Joi.string().required(),
  isCorrect: Joi.boolean().required(),
});

const createSchema = Joi.object({
  course: objectId.required(),
  testType: Joi.number().valid(1, 2).required(),
  question: Joi.string().required(),
  options: Joi.array().items(optionSchema).min(2).required(),
});

const updateSchema = Joi.object({
  testType: Joi.number().valid(1, 2).optional(),
  question: Joi.string().optional(),
  options: Joi.array().items(optionSchema).min(2).optional(),
});

const reorderSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        id: objectId.required(),
        order: Joi.number().integer().min(0).required(),
      }),
    )
    .min(1)
    .required(),
});

const bulkCreateSchema = Joi.object({
  course: objectId.required(),
  items: Joi.array()
    .items(
      Joi.object({
        testType: Joi.number().valid(1, 2).required(),
        question: Joi.string().required(),
        options: Joi.array().items(optionSchema).min(2).required(),
      }),
    )
    .min(1)
    .required(),
});

module.exports = { createSchema, updateSchema, reorderSchema, bulkCreateSchema };
