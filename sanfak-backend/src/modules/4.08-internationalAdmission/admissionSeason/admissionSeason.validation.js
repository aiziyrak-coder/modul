const Joi = require("joi");
const AdmissionSeason = require("./admissionSeason.model");
const { optionalString } = require("#validators/common");
const {
  langFields,
  langFieldsOptional,
  idParam,
  baseQuery,
  withPagination,
} = require("../lib/commonValidation");

const { SEASON_NAMES, SEASON_STATUSES } = AdmissionSeason;

const objectId = Joi.string().hex().length(24);

const academicYear = Joi.string()
  .trim()
  .pattern(/^\d{4}\/\d{4}$/)
  .message("O'quv yili \"2025/2026\" ko'rinishida bo'lishi kerak");

const itemSchema = Joi.object({
  direction: objectId.required(),
  educationForms: Joi.array().items(objectId).default([]),
  educationLanguages: Joi.array().items(objectId).default([]),
});

const createSchema = Joi.object({
  ...langFields("title", { min: 2, max: 300 }),
  ...langFields("description", { required: false, max: 2000 }),
  academicYear: academicYear.required(),
  season: Joi.string().valid(...SEASON_NAMES).required(),
  items: Joi.array().items(itemSchema).min(1).required(),
  openDate: Joi.date().required(),
  closeDate: Joi.date().required(),
});

const updateSchema = Joi.object({
  ...langFieldsOptional("title", { max: 300 }),
  ...langFieldsOptional("description", { max: 2000 }),
  academicYear,
  season: Joi.string().valid(...SEASON_NAMES),
  items: Joi.array().items(itemSchema).min(1),
  openDate: Joi.date(),
  closeDate: Joi.date(),
}).min(1);

const findAll = baseQuery.keys({
  academicYear: optionalString(),
  season: optionalString(Joi.string().valid(...SEASON_NAMES)),
  status: optionalString(Joi.string().valid(...SEASON_STATUSES)),
});

module.exports = {
  SEASON_NAMES,
  SEASON_STATUSES,
  createSchema,
  updateSchema,
  findAll,
  paginate: withPagination(findAll),
  readSchema: idParam,
  deleteSchema: idParam,
};
