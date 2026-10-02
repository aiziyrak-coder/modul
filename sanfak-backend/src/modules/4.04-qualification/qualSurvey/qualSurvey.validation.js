const Joi = require("joi");
const { QUESTION_TYPES } = require("#modules/4.04-qualification/_shared/qualSurvey.model");

const objectId = Joi.string().hex().length(24);

const option = Joi.object({
  text: Joi.string().trim().min(1).max(500).required(),
});

const optionsRule = Joi.when("type", {
  is: QUESTION_TYPES.CHOICE,
  then: Joi.array().items(option).min(2).max(10).required(),
  otherwise: Joi.array().max(0).default([]),
});

const createSchema = Joi.object({
  question: Joi.string().trim().min(1).max(1000).required(),
  type: Joi.number()
    .valid(...Object.values(QUESTION_TYPES))
    .default(QUESTION_TYPES.CHOICE),
  options: optionsRule,
  required: Joi.boolean().default(true),
  order: Joi.number().integer().default(0),
  active: Joi.boolean().default(true),
});

const updateSchema = Joi.object({
  question: Joi.string().trim().min(1).max(1000),
  type: Joi.number().valid(...Object.values(QUESTION_TYPES)),
  options: Joi.array().items(option).max(10),
  required: Joi.boolean(),
  order: Joi.number().integer(),
  active: Joi.boolean(),
}).min(1);

const bulkSchema = Joi.object({
  items: Joi.array()
    .items(createSchema)
    .min(1)
    .max(100)
    .required(),
});

const reorderSchema = Joi.array()
  .items(Joi.object({ _id: objectId.required(), order: Joi.number().integer().required() }))
  .min(1)
  .required();

const submitSchema = Joi.object({
  course: objectId.required(),
  answers: Joi.array()
    .items(
      Joi.object({
        question: objectId.required(),
        optionIndex: Joi.number().integer().min(0),
        rating: Joi.number().integer().min(1).max(5),
        text: Joi.string().allow("").max(2000),
      }).or("optionIndex", "rating", "text"),
    )
    .min(1)
    .max(100)
    .required(),
});

module.exports = { createSchema, updateSchema, bulkSchema, reorderSchema, submitSchema };
