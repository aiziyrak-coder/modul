const Joi = require("joi");
const { optionalString } = require("#validators/common");
const objectId = Joi.string().length(24).hex();

const createSchema = Joi.object({
  fullName: Joi.any().strip(),
  passport: Joi.any().strip(),
  bachelorDiploma: Joi.string().required(),
  mastersDiploma: optionalString(),
  moCertificate: optionalString(),
  status: Joi.number().valid(1, 2, 3).optional(),
  course: objectId.required(),
  province: objectId.required(),
  region: objectId.required(),
  institution: Joi.string().allow("", null).optional(),
  phone: Joi.string().allow("", null).optional(),
});

const updateSchema = Joi.object({
  fullName: Joi.string().optional(),
  passport: Joi.string().optional(),
  bachelorDiploma: Joi.string().optional(),
  mastersDiploma: optionalString(),
  moCertificate: optionalString(),
  status: Joi.number().valid(1, 2, 3).optional(),
  course: objectId.optional(),
  province: objectId.optional(),
  region: objectId.optional(),
});

module.exports = { createSchema, updateSchema };
