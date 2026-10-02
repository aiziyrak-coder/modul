const Joi = require("joi");

const listQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(200),
  user: Joi.string().hex().length(24),
  targetId: Joi.string().hex().length(24),
  module: Joi.string().max(64),
  method: Joi.string().valid("GET", "POST", "PUT", "PATCH", "DELETE"),
  statusCode: Joi.number().integer().min(100).max(599),
  dateFrom: Joi.date(),
  dateTo: Joi.date(),
  search: Joi.string().max(120).allow(""),
  onlyMutations: Joi.boolean(),
});

const exportQuerySchema = listQuerySchema.keys({
  page: Joi.forbidden(),
  limit: Joi.forbidden(),
});

module.exports = { listQuerySchema, exportQuerySchema };
