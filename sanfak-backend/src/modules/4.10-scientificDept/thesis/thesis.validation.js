const Joi = require("joi");
const { optionalString } = require("#validators/common");

const THESIS_TYPES = ["national", "international"];
const objectId = Joi.string().hex().length(24);

const createThesisSchema = Joi.object({
  type: Joi.string()
    .valid(...THESIS_TYPES)
    .required(),
  conferenceName: Joi.string().trim().max(500).required(),
  title: Joi.string().trim().max(500).required(),
  academicYear: Joi.string()
    .pattern(/^\d{4}\/\d{4}$/)
    .required(),
  publishedDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  year: Joi.number().integer().min(1990).max(2100).optional(),
  pages: Joi.string().trim().max(50).required(),
  authorCount: Joi.number().integer().min(1).required(),
  url: Joi.string().uri().optional().allow(""),
  fileUrl: optionalString(),
  media: Joi.any().optional(),
});

const updateThesisSchema = Joi.object({
  type: Joi.string().valid(...THESIS_TYPES),
  conferenceName: Joi.string().trim().max(500),
  title: Joi.string().trim().max(500),
  academicYear: Joi.string().pattern(/^\d{4}\/\d{4}$/),
  publishedDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/),
  year: Joi.number().integer().min(1990).max(2100),
  pages: Joi.string().trim().max(50),
  authorCount: Joi.number().integer().min(1),
  url: Joi.string().uri().allow(""),
  fileUrl: optionalString(),
  media: Joi.any(),
}).min(1);

const rejectThesisSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(1000).required(),
});

const thesisQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid("new", "pending", "approved", "rejected")),
  type: optionalString(Joi.string().valid(...THESIS_TYPES)),
  academicYear: optionalString(Joi.string().pattern(/^\d{4}\/\d{4}$/)),
  faculty: optionalString(objectId),
  department: optionalString(objectId),
  author: optionalString(objectId),
  year: Joi.number().integer().optional(),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const thesisPaginateSchema = thesisQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  THESIS_TYPES,
  createThesisSchema,
  updateThesisSchema,
  rejectThesisSchema,
  thesisQuerySchema,
  thesisPaginateSchema,
};
