const Joi = require("joi");
const { optionalString } = require("#validators/common");

const METHODICAL_STATUSES = ["new", "pending", "approved", "rejected"];

const createMethodicalSchema = Joi.object({
  title: Joi.string().trim().min(3).max(500).required(),
  specialty: Joi.string().hex().length(24).required().messages({
    "any.required": "Ixtisoslik tanlanishi shart",
  }),
  academicYear: Joi.string()
    .pattern(/^\d{4}\/\d{4}$/)
    .required(),
  fileSlots: Joi.string().required(),
  media: Joi.any(),
});

const updateMethodicalSchema = Joi.object({
  title: Joi.string().trim().min(3).max(500),
  specialty: Joi.string().hex().length(24),
  academicYear: Joi.string().pattern(/^\d{4}\/\d{4}$/),
  fileSlots: optionalString(),
  media: Joi.any(),
}).min(1);

const signMethodicalSchema = Joi.object({
  eriKey: Joi.string().trim().max(100).allow("").optional(),
  eriSignature: optionalString(),
  eriData: optionalString(),
  registrationNumber: optionalString(Joi.string().max(100)),
  academicYear: Joi.string()
    .pattern(/^\d{4}\/\d{4}$/)
    .optional(),
});

const rejectMethodicalSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000).required(),
});

const methodicalQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid(...METHODICAL_STATUSES)),
  academicYear: optionalString(),
  specialty: optionalString(Joi.string().hex().length(24)),
  author: optionalString(Joi.string().hex().length(24)),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const methodicalPaginateSchema = methodicalQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  METHODICAL_STATUSES,
  createMethodicalSchema,
  updateMethodicalSchema,
  signMethodicalSchema,
  rejectMethodicalSchema,
  methodicalQuerySchema,
  methodicalPaginateSchema,
};
