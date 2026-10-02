const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const STATUS = ["active", "approved", "rejected"];

const candidateSchema = Joi.object({
  user: Joi.string().required(),
  diplomaFile: Joi.string().allow("", null).optional(),
  diplomaDate: Joi.date().optional(),
});

const votingSessionSchema = Joi.object({
  title: Joi.any().strip(),
  desc: Joi.any().strip(),
  department: optionalObjectId(),
  rankType: Joi.string().min(1).required(),
  candidates: Joi.array().items(candidateSchema).min(1).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  passingPercent: Joi.number().optional(),
});

const updateSessionSchema = Joi.object({
  title: Joi.any().strip(),
  desc: Joi.any().strip(),
  department: optionalObjectId(),
  rankType: Joi.string().allow("", null).optional(),
  candidates: Joi.array().items(candidateSchema).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  passingPercent: Joi.number().optional(),
  active: Joi.boolean().optional(),
});

const diplomaSchema = Joi.object({
  diplomaFile: optionalString(),
  diplomaDate: Joi.date().required(),
  media: Joi.any().optional(),
});

const findSessionsSchema = Joi.object({
  search: optionalString(),
  status: optionalString(Joi.string().valid(...STATUS)),
  department: optionalObjectId(),
});

const paginateSessionsSchema = findSessionsSchema.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

const paginateReportSchema = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  status: optionalString(Joi.string().valid("approved", "rejected")),
  rankType: optionalString(),
  department: optionalObjectId(),
});

const reportPdfSchema = Joi.object({
  status: optionalString(Joi.string().valid("approved", "rejected")),
  rankType: optionalString(),
  department: optionalObjectId(),
  intro: optionalString(Joi.string().max(600)),
});

module.exports = {
  votingSessionSchema,
  updateSessionSchema,
  findSessionsSchema,
  paginateSessionsSchema,
  paginateReportSchema,
  reportPdfSchema,
  diplomaSchema,
};
