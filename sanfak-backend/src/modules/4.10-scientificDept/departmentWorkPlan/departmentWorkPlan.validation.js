const Joi = require("joi");
const { optionalString } = require("#validators/common");

const objectId = Joi.string().hex().length(24);

const createPlanSchema = Joi.object({
  academicYear: objectId.required(),
  fileUrl: optionalString(),
  media: Joi.any().optional(),
});

const updatePlanSchema = Joi.object({
  academicYear: objectId,
  fileUrl: optionalString(),
  media: Joi.any(),
}).min(1);

const rejectPlanSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(1000).required(),
});

const planQuerySchema = Joi.object({
  status: optionalString(Joi.string().valid("new", "pending", "approved", "rejected")),
  academicYear: optionalString(objectId),
  faculty: optionalString(objectId),
  department: optionalString(objectId),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const planPaginateSchema = planQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  createPlanSchema,
  updatePlanSchema,
  rejectPlanSchema,
  planQuerySchema,
  planPaginateSchema,
};
