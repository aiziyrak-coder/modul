const Joi = require("joi");

const objectId = Joi.string().length(24).hex();

const optionSchema = Joi.object({
  text: Joi.string().required(),
  isCorrect: Joi.boolean().optional(),
  isSelected: Joi.boolean().optional(),
});

const questionSchema = Joi.object({
  isSelectedCorrect: Joi.boolean().required(),
  testType: Joi.number().valid(1, 2).optional(),
  question: Joi.string().required(),
  options: Joi.array().items(optionSchema).min(1).required(),
});

const createSchema = Joi.object({
  course: objectId.required(),
  listener: objectId.required(),
  passPercentage: Joi.number().min(0).max(100).required(),
  percentage: Joi.number().min(0).max(100).required(),
  totalQuestions: Joi.number().integer().min(1).required(),
  totalCorrects: Joi.number()
    .integer()
    .min(0)
    .max(Joi.ref("totalQuestions"))
    .required(),
  isPassed: Joi.boolean().required(),
  questions: Joi.array().items(questionSchema).min(1).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),
  finishedDate: Joi.date().optional(),
  status: Joi.number().valid(1, 2).optional(),
});

const updateSchema = Joi.object({
  course: objectId.optional(),
  listener: objectId.optional(),
  passPercentage: Joi.number().min(0).max(100).optional(),
  percentage: Joi.number().min(0).max(100).optional(),
  totalQuestions: Joi.number().integer().min(1).optional(),
  totalCorrects: Joi.number()
    .integer()
    .min(0)
    .when("totalQuestions", {
      is: Joi.exist(),
      then: Joi.number().max(Joi.ref("totalQuestions")),
      otherwise: Joi.number(),
    })
    .optional(),
  isPassed: Joi.boolean().optional(),
  questions: Joi.array().items(questionSchema).min(1).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().when("startDate", {
    is: Joi.exist(),
    then: Joi.date().greater(Joi.ref("startDate")),
    otherwise: Joi.date().optional(),
  }),
  finishedDate: Joi.date().optional(),
  status: Joi.number().valid(1, 2).optional(),
});

module.exports = { createSchema, updateSchema };
