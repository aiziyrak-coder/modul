
const Joi = require("joi");
const { optionalString } = require("#validators/common");

const createAuditoriumHourSchema = Joi.object({
  auditoriumHour: Joi.number().required(),
  date: optionalString(),
  allowedStakes: Joi.array()
    .items(Joi.number().min(0).max(2))
    .unique()
    .min(1)
    .optional(),
});

const updateAuditoriumHourSchema = Joi.object({
  auditoriumHour: Joi.number().optional(),
  date: optionalString(),
  allowedStakes: Joi.array()
    .items(Joi.number().min(0).max(2))
    .unique()
    .min(1)
    .optional(),
});

module.exports = { createAuditoriumHourSchema, updateAuditoriumHourSchema };
