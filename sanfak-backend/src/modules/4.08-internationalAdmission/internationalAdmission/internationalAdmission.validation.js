const Joi = require("joi");
const Applicant = require("./internationalAdmission.model");
const { optionalString } = require("#validators/common");

const { APPLICANT_STATUSES } = Applicant;

const createSchema = Joi.object({
  fullName: Joi.string().min(2).max(200).required(),
  birthDate: Joi.date().optional().allow(null),
  country: Joi.string().min(2).max(100).required(),
  phone: Joi.string().max(30).optional().allow(null, ""),
  parentPhone: Joi.string().max(30).optional().allow(null, ""),
  passportNumber: Joi.string().max(50).optional().allow(null, ""),
  passportExpiry: Joi.date().optional().allow(null),
  email: Joi.string().email().optional().allow(null, ""),
  direction: Joi.string().optional().allow(null, ""),
  educationForm: Joi.string().optional().allow(null, ""),
  educationLanguage: Joi.string().optional().allow(null, ""),
  season: Joi.string().optional().allow(null, ""),
  academicYear: Joi.string().max(20).optional().allow(null, ""),
  offerAccepted: Joi.boolean().optional(),
  notes: Joi.string().max(2000).optional().allow(null, ""),
  media: Joi.any().optional(),
});

const updateSchema = Joi.object({
  fullName: Joi.string().min(2).max(200),
  birthDate: Joi.date().allow(null),
  country: Joi.string().min(2).max(100),
  phone: Joi.string().max(30).allow(null, ""),
  parentPhone: Joi.string().max(30).allow(null, ""),
  passportNumber: Joi.string().max(50).allow(null, ""),
  passportExpiry: Joi.date().allow(null),
  email: Joi.string().email().allow(null, ""),
  direction: Joi.string().allow(null, ""),
  educationForm: Joi.string().allow(null, ""),
  educationLanguage: Joi.string().allow(null, ""),
  season: Joi.string().allow(null, ""),
  academicYear: Joi.string().max(20).allow(null, ""),
  offerAccepted: Joi.boolean(),
  notes: Joi.string().max(2000).allow(null, ""),
  media: Joi.any(),
}).min(1);

const rejectSchema = Joi.object({
  reason: Joi.string().trim().min(10).max(2000).required(),
});

const findAll = Joi.object({
  search: optionalString(),
  active: Joi.boolean().optional(),
  country: optionalString(),
  status: optionalString(Joi.string().valid(...APPLICANT_STATUSES)),
  academicYear: optionalString(),
  direction: optionalString(),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const paginate = findAll.keys({
  limit: Joi.number().integer().min(1).max(200).required(),
  page: Joi.number().integer().min(1).required(),
});

const statsSchema = Joi.object({
  from: Joi.date().optional(),
  to: Joi.date().optional(),
  academicYear: optionalString(Joi.string().trim().max(20)),
});

const readSchema = Joi.object({ id: Joi.string().required() });
const deleteSchema = Joi.object({ id: Joi.string().required() });

module.exports = {
  APPLICANT_STATUSES,
  createSchema,
  updateSchema,
  rejectSchema,
  statsSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
