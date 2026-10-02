const Joi = require("joi");
const { optionalString } = require("#validators/common");

const oneIdLoginSchema = Joi.object({
  oneIdPin: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  middleName: optionalString(),
  email: optionalString(Joi.string().email()),
  phone: optionalString(),
  photo: optionalString(),
  passportNumber: Joi.number().optional(),
  passportSeria: optionalString(),
});

module.exports = {
  oneIdLoginSchema,
  updateProfileSchema,
};
