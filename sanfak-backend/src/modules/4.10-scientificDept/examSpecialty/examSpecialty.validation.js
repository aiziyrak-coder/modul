const Joi = require("joi");
const { optionalString } = require("#validators/common");

const EXAM_SPECIALTY_STATUSES = ["open", "closed"];

const createSpecialtySchema = Joi.object({
  code: Joi.string().trim().min(2).max(50).required(),
  name: Joi.string().trim().allow("").max(300),
  regStart: Joi.date().optional(),
  regEnd: Joi.date().optional(),
  status: Joi.string()
    .valid(...EXAM_SPECIALTY_STATUSES)
    .optional(),
});

const updateSpecialtySchema = Joi.object({
  code: Joi.string().trim().min(2).max(50),
  name: Joi.string().trim().allow("").max(300),
  regStart: Joi.date(),
  regEnd: Joi.date(),
  status: Joi.string().valid(...EXAM_SPECIALTY_STATUSES),
  active: Joi.boolean(),
}).min(1);

const specialtyQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid(...EXAM_SPECIALTY_STATUSES)),
  openNow: Joi.boolean().optional(),
});

const specialtyPaginateSchema = specialtyQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  EXAM_SPECIALTY_STATUSES,
  createSpecialtySchema,
  updateSpecialtySchema,
  specialtyQuerySchema,
  specialtyPaginateSchema,
};
