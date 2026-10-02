const Joi = require("joi");
const { optionalString } = require("#validators/common");
const {
  JOURNAL_TYPES,
} = require("#modules/4.10-scientificDept/oakJournal/oakJournal.validation");

const objectId = Joi.string().hex().length(24);

const createArticleSchema = Joi.object({
  type: Joi.string()
    .valid(...JOURNAL_TYPES)
    .required(),
  journal: objectId.required(),
  title: Joi.string()
    .trim()
    .max(500)
    .when("type", {
      is: "nationalOak",
      then: Joi.optional().allow(""),
      otherwise: Joi.required(),
    }),
  academicYear: Joi.string()
    .pattern(/^\d{4}\/\d{4}$/)
    .required(),
  publishedDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  year: Joi.number().integer().min(1990).max(2100).optional(),
  pages: Joi.string().trim().max(50).required(),
  authorCount: Joi.number().integer().min(1).required(),
  url: Joi.string().uri().required(),
  fileUrl: optionalString(),
  media: Joi.any().optional(),
});

const updateArticleSchema = Joi.object({
  type: Joi.string().valid(...JOURNAL_TYPES),
  journal: objectId,
  title: Joi.string().trim().max(500).allow(""),
  academicYear: Joi.string().pattern(/^\d{4}\/\d{4}$/),
  publishedDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/),
  year: Joi.number().integer().min(1990).max(2100),
  pages: Joi.string().trim().max(50),
  authorCount: Joi.number().integer().min(1),
  url: Joi.string().uri(),
  fileUrl: optionalString(),
  media: Joi.any(),
}).min(1);

const rejectArticleSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(1000).required(),
});

const articleQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid("new", "pending", "approved", "rejected")),
  type: optionalString(Joi.string().valid(...JOURNAL_TYPES)),
  academicYear: optionalString(Joi.string().pattern(/^\d{4}\/\d{4}$/)),
  faculty: optionalString(objectId),
  department: optionalString(objectId),
  author: optionalString(objectId),
  year: Joi.number().integer().optional(),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const articlePaginateSchema = articleQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  createArticleSchema,
  updateArticleSchema,
  rejectArticleSchema,
  articleQuerySchema,
  articlePaginateSchema,
};
