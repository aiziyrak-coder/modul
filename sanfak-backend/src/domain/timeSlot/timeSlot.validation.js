const Joi = require("joi");
const { multiLangOptional } = require("#validators/common");

const createTimeSlotSchema = Joi.object({
  startTime: Joi.string().required(),
  endTime: Joi.string().required(),
  title: multiLangOptional.optional(),
  order: Joi.number().optional(),
});

module.exports = {
  createTimeSlotSchema,
};
