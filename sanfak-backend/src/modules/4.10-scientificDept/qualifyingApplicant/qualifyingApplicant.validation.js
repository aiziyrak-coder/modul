const Joi = require("joi");
const { optionalString } = require("#validators/common");

const RESEARCHER_TYPES = ["mustaqil", "tayanch"];
const APPLICANT_STATUSES = ["new", "approved", "rejected", "passed", "failed"];

const mediaKeys = {
  media: Joi.any(),
  fileSlots: optionalString(),
};

const createApplicantSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).optional().allow("", null),
  researcherType: Joi.string()
    .valid(...RESEARCHER_TYPES)
    .optional()
    .allow("", null),
  course: Joi.number().integer().min(1).optional().allow("", null),
  specialization: Joi.string().trim().required(),
  university: Joi.string().trim().min(2).max(200).optional().allow("", null),
  phone: Joi.string().trim().min(5).max(30).optional().allow("", null),
  ...mediaKeys,
});

const updateApplicantSchema = Joi.object({
  name: optionalString(Joi.string().trim().min(2).max(200)),
  researcherType: Joi.string().valid(...RESEARCHER_TYPES),
  course: Joi.number().integer().min(1).allow("", null),
  specialization: Joi.string().trim(),
  university: optionalString(Joi.string().trim().min(2).max(200)),
  phone: optionalString(Joi.string().trim().min(5).max(30)),
  ...mediaKeys,
}).min(1);

const rejectSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).required(),
});

const examDateSchema = Joi.object({
  ids: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
  examDate: Joi.date().required(),
});

const resultSchema = Joi.object({
  result: Joi.string().valid("passed", "failed").required(),
  ...mediaKeys,
});

const applicantQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid(...APPLICANT_STATUSES)),
  specialization: optionalString(),
  course: Joi.number().integer().min(1).optional(),
  examDate: optionalString(Joi.string().valid("assigned", "unassigned")),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const applicantPaginateSchema = applicantQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  RESEARCHER_TYPES,
  APPLICANT_STATUSES,
  createApplicantSchema,
  updateApplicantSchema,
  rejectSchema,
  examDateSchema,
  resultSchema,
  applicantQuerySchema,
  applicantPaginateSchema,
};
