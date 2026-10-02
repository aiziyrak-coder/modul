const Joi = require("joi");

const externalMemberSchema = Joi.object({
  name: Joi.string().required(),
  workplace: Joi.string().required(),
  position: Joi.string().required(),
  passportSeries: Joi.string().allow("", null),
  passportNumber: Joi.string().allow("", null),
  email: Joi.string().email({ tlds: false }).allow("", null),
  phone: Joi.string().allow("", null),
});

const createMemberSchema = Joi.object({
  type: Joi.string().valid("internal", "external").default("internal"),
  user: Joi.string().when("type", {
    is: "internal",
    then: Joi.string().required(),
    otherwise: Joi.string().allow(null).empty(""),
  }),
  external: Joi.when("type", {
    is: "external",
    then: externalMemberSchema.required(),
    otherwise: Joi.any().strip(),
  }),
  academicTitle: Joi.string().allow("", null),
  degree: Joi.string().allow("", null),
  specialties: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
  organization: Joi.string().allow("", null),
  active: Joi.boolean().optional(),
});

const updateMemberSchema = Joi.object({
  external: externalMemberSchema.optional(),
  academicTitle: Joi.string().allow("", null),
  degree: Joi.string().allow("", null),
  specialties: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
  organization: Joi.string().allow("", null),
  active: Joi.boolean().optional(),
  assignedCount: Joi.number().integer().min(0).optional(),
});

module.exports = { createMemberSchema, updateMemberSchema };
