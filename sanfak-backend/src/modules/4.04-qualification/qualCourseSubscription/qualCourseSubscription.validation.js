const Joi = require("joi");
const objectId = Joi.string().length(24).hex();

const createSchema = Joi.object({
  fullName: Joi.string().required(),
  passport: Joi.string().required(),
  bachelorDiploma: Joi.string().required(),
  mastersDiploma: Joi.string().optional(),
  moCertificate: Joi.string().required(),
  status: Joi.number().valid(1, 2, 3).optional(),
  course: objectId.required(),
  province: objectId.required(),
  region: objectId.required(),
});

const updateSchema = Joi.object({
  educationType: Joi.number().valid(1, 2).optional(),
});

const studentsMonitoringQuery = Joi.object({
  page: Joi.number().integer().required(),
  limit: Joi.number().integer().required(),
  search: Joi.string().allow("").optional(),
  course: objectId.optional(),
  performance: Joi.string().valid("high", "medium", "low").allow("").optional(),
});

const progressReportQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).optional(),
  course: objectId.optional(),
  dateFrom: Joi.string().isoDate().allow("").optional(),
  dateTo: Joi.string().isoDate().allow("").optional(),
});

module.exports = {
  createSchema,
  updateSchema,
  studentsMonitoringQuery,
  progressReportQuery,
};
