const Joi = require("joi");
const { optionalString } = require("#validators/common");

const objectId = Joi.string().length(24).hex();

const myQuery = Joi.object({
  course: objectId.required(),
  language: optionalString(),
});

const bankSchema = Joi.object({
  course: objectId.required(),
  amount: Joi.number().min(1).required(),
  file: optionalString(),
  fileDetails: Joi.object().optional(),
});

module.exports = { myQuery, bankSchema };
