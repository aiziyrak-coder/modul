const Joi = require("joi");
const { optionalString } = require("#validators/common");

const upsertHIndexSchema = Joi.object({
  scopusUrl: Joi.string().uri().allow("").optional(),
  scholarUrl: Joi.string().uri().allow("").optional(),
  scholarHIndex: Joi.number().integer().min(0).optional(),
  scholarCitations: Joi.number().integer().min(0).optional(),
}).min(1);

const hIndexQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  faculty: optionalString(Joi.string().hex().length(24)),
  department: optionalString(Joi.string().hex().length(24)),
});

const hIndexPaginateSchema = hIndexQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  upsertHIndexSchema,
  hIndexQuerySchema,
  hIndexPaginateSchema,
};
