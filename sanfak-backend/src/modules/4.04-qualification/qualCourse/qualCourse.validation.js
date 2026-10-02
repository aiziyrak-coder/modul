const Joi = require("joi");
const { optionalString } = require("#validators/common");

const createSchema = Joi.object({
  courseType: Joi.string().required(),
  title: Joi.string().required(),
  creditHours: Joi.number().required(),
  price: Joi.number().required(),
  form: Joi.number().valid(1, 2).required(),
  listenersLimit: Joi.number().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),
  address: Joi.string().when("form", {
    is: 2,
    then: Joi.required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  location: Joi.object({
    lat: Joi.string().required(),
    lng: Joi.string().required(),
  }).when("form", {
    is: 2,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  teachers: Joi.array()
    .items(Joi.string())
    .min(1)
    .required(),
  status: Joi.number().valid(1, 2, 3).optional(),
  accessTest: Joi.object({
    randomQuestions: Joi.number().required(),
    duration: Joi.number().required(),
  }).optional(),
  exitTest: Joi.object({
    passPercentage: Joi.number().min(0).max(100).required(),
    randomQuestions: Joi.number().required(),
    duration: Joi.number().required(),
  }).optional(),
  active: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  courseType: Joi.string().optional(),
  title: Joi.string().optional(),
  creditHours: Joi.number().optional(),
  price: Joi.number().optional(),
  form: Joi.number().valid(1, 2).optional(),
  listenersLimit: Joi.number().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  address: optionalString(),
  location: Joi.object({
    lat: Joi.string().required(),
    lng: Joi.string().required(),
  }).optional(),
  teachers: Joi.array().items(Joi.string()).min(1).optional(),
  status: Joi.number().valid(1, 2, 3).optional(),
  accessTest: Joi.object({
    passPercentage: Joi.number().min(0).max(100).required(),
    randomQuestions: Joi.number().required(),
    duration: Joi.number().required(),
  }).optional(),
  exitTest: Joi.object({
    passPercentage: Joi.number().min(0).max(100).required(),
    randomQuestions: Joi.number().required(),
    duration: Joi.number().required(),
  }).optional(),
  active: Joi.boolean().optional(),
});

module.exports = { createSchema, updateSchema };
