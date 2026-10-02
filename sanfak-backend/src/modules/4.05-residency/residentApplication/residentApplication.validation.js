const Joi = require("joi");
const {
  RESIDENT_APPLICATION_TYPES,
  RESIDENT_APPLICATION_STATUSES,
} = require("./residentApplication.model");
const { optionalString, optionalObjectId, optionalBoolean } = require("#validators/common");

const createApplicationSchema = Joi.object({
  resident: optionalObjectId(),
  type: Joi.string()
    .valid(...RESIDENT_APPLICATION_TYPES)
    .required(),
  reason: Joi.string().min(1).max(2000).required(),
  fileUrl: Joi.string().allow("", null).optional(),
  academicYear: Joi.string().allow("", null).optional(),
});

const reviewSchema = Joi.object({
  status: Joi.string()
    .valid("korib_chiqilmoqda", "tasdiqlangan", "rad_etilgan")
    .required(),
  comment: Joi.string().max(2000).allow("", null).optional(),
  fromDate: Joi.date().optional().allow(null),
  toDate: Joi.date().optional().allow(null),
});

const listQuery = Joi.object({
  search: Joi.string().trim().allow("").optional(),
  status: optionalString(Joi.string().valid(...RESIDENT_APPLICATION_STATUSES)),
  type: optionalString(Joi.string().valid(...RESIDENT_APPLICATION_TYPES)),
  academicYear: optionalString(),
  active: optionalBoolean(),
});

const paginateQuery = listQuery.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const idSchema = Joi.object({ id: Joi.string().required() });

module.exports = {
  createApplicationSchema,
  reviewSchema,
  listQuery,
  paginateQuery,
  idSchema,
};
