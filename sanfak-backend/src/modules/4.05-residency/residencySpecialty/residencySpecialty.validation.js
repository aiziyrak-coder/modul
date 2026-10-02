const Joi = require("joi");
const { RESIDENCY_PROGRAMS } = require("./residencySpecialty.model");
const { optionalString, optionalBoolean } = require("#validators/common");

const createSchema = Joi.object({
  title: Joi.string().min(1).max(300).required(),
  code: Joi.string().allow("", null).optional(),
  program: Joi.string()
    .valid(...RESIDENCY_PROGRAMS)
    .required(),
  studyPeriod: Joi.number().integer().min(1).max(10).allow(null).optional(),
  department: Joi.string().allow(null, "").optional(),
  departmentTitle: Joi.string().allow(null, "").optional(),
  active: optionalBoolean(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1).max(300).optional(),
  code: Joi.string().allow("", null).optional(),
  program: Joi.string()
    .valid(...RESIDENCY_PROGRAMS)
    .optional(),
  studyPeriod: Joi.number().integer().min(1).max(10).allow(null).optional(),
  department: Joi.string().allow(null, "").optional(),
  departmentTitle: Joi.string().allow(null, "").optional(),
  active: optionalBoolean(),
});

const findAll = Joi.object({
  search: optionalString(Joi.string().trim()),
  program: optionalString(Joi.string().valid(...RESIDENCY_PROGRAMS)),
  active: optionalBoolean(),
});

const paginate = findAll.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const idSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = { createSchema, updateSchema, findAll, paginate, idSchema };
