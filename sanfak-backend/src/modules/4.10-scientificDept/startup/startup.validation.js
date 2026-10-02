const Joi = require("joi");
const { optionalString } = require("#validators/common");

const objectId = Joi.string().hex().length(24);

const createStartupSchema = Joi.object({
  type: objectId.required().messages({
    "any.required": "Loyiha turi tanlanishi shart",
  }),
  title: Joi.string().trim().min(2).max(500).required().messages({
    "any.required": "Loyiha nomi kiritilishi shart",
    "string.empty": "Loyiha nomi kiritilishi shart",
  }),
  fileSlots: optionalString(),
  media: Joi.any().optional(),
});

const updateStartupSchema = Joi.object({
  type: objectId,
  title: Joi.string().trim().min(2).max(500),
  fileSlots: optionalString(),
  media: Joi.any(),
}).min(1);

const startupQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  type: optionalString(objectId),
  faculty: optionalString(objectId),
  department: optionalString(objectId),
  author: optionalString(objectId),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  language: Joi.string().valid("uz", "ru", "en").optional(),
});

const startupPaginateSchema = startupQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  createStartupSchema,
  updateStartupSchema,
  startupQuerySchema,
  startupPaginateSchema,
};
