const Joi = require("joi");
const {
  EXPULSION_ORDER_STATUSES,
  ORDER_ORIGINS,
} = require("./residencyExpulsionOrder.model");

const objectId = Joi.string().hex().length(24);

const idSchema = Joi.object({ id: objectId.required() });

const paginateQuery = Joi.object({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(100).required(),
  status: Joi.string().valid(...EXPULSION_ORDER_STATUSES),
  origin: Joi.string().valid(...ORDER_ORIGINS),
  resident: objectId,
});

const signSchema = Joi.object({
  orderId: objectId.required(),
  paperOrderNumber: Joi.string().max(64).pattern(/^\S(?:.*\S)?$/).required(),
  paperOrderDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  scanSha256: Joi.string().pattern(/^[0-9a-f]{64}$/).required(),
  eriSignature: Joi.string().max(65536).allow("", null),
});

const rejectSchema = Joi.object({
  orderId: objectId.required(),
  reason: Joi.string().trim().min(3).max(1000).required().messages({
    "any.required": "Rad etish sababi ko'rsatilishi shart",
    "string.min": "Sabab juda qisqa",
  }),
});

module.exports = { idSchema, paginateQuery, signSchema, rejectSchema };
