const Joi = require("joi");
const { optionalString } = require("#validators/common");

const objectId = Joi.string().length(24).hex();

const createSchema = Joi.object({
  course: objectId.required(),
  topic: objectId.required(),
  listener: objectId.required(),
  startedAt: Joi.date().required(),
  status: Joi.number().valid(1, 2, 3, 4, 5).required(),
  isLocked: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  startedAt: Joi.date().optional(),
  status: Joi.number().valid(1, 2, 3, 4, 5).optional(),
  isLocked: Joi.boolean().optional(),
});

const masteryGridSchema = Joi.object({
  course: objectId.required(),
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).optional(),
  language: optionalString(),
});

const myProgressSchema = Joi.object({
  course: objectId.required(),
  language: optionalString(),
});

const topicActionSchema = Joi.object({
  course: objectId.required(),
  topic: objectId.required(),
});

const scenarioSubmitSchema = Joi.object({
  course: objectId.required(),
  topic: objectId.required(),
  answer: Joi.string().allow("").optional(),
  file: Joi.string().allow("").optional(),
});

module.exports = {
  createSchema,
  updateSchema,
  masteryGridSchema,
  myProgressSchema,
  topicActionSchema,
  scenarioSubmitSchema,
};
