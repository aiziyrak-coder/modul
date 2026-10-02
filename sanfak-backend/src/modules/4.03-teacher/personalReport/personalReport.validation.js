const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");
const { safeLink } = require("#modules/4.03-teacher/_shared/safeLink");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ObjectId formatida bo'lishi kerak");

const APPROVAL_STEP_KEYS = ["dekan", "kotib"];

const createSchema = Joi.object({
  plan: objectId.required(),
  academicYear: objectId.required(),
  semester: Joi.number().valid(1, 2).required(),
  text: Joi.string().min(1).required(),
  councilDecisionFile: safeLink(),
});

const updateSchema = Joi.object({
  semester: Joi.number().valid(1, 2).optional(),
  text: Joi.string().min(1).optional(),
  councilDecisionFile: safeLink(),
});

const listFilters = {
  plan: optionalObjectId(objectId),
  teacher: optionalObjectId(objectId),
  academicYear: optionalObjectId(objectId),
  semester: Joi.number().valid(1, 2).optional(),
  status: optionalString(Joi.string().valid("draft", "submitted", "approved", "rejected")),
};

const findAll = Joi.object(listFilters);

const paginate = Joi.object({
  page: Joi.number().integer().required(),
  limit: Joi.number().integer().required(),
  ...listFilters,
});

const exportQuery = Joi.object(listFilters);

const idSchema = Joi.object({ id: objectId.required() });

const approveSchema = Joi.object({
  comment: Joi.string().allow(null, "").optional(),
  step: Joi.string().valid(...APPROVAL_STEP_KEYS).optional(),
  eriSignature: Joi.string().allow(null, "").optional(),
  eriSerial: Joi.string().allow(null, "").optional(),
});

const rejectSchema = Joi.object({
  comment: Joi.string().required(),
  step: Joi.string().valid(...APPROVAL_STEP_KEYS).optional(),
});

module.exports = {
  createSchema,
  updateSchema,
  findAll,
  paginate,
  exportQuery,
  idSchema,
  approveSchema,
  rejectSchema,
  APPROVAL_STEP_KEYS,
};
