const Joi = require("joi");
const { optionalString } = require("#validators/common");

const MONOGRAPH_STATUSES = ["new", "pending", "approved", "rejected"];

const objectId = Joi.string().hex().length(24);

const createMonographSchema = Joi.object({
  fileSlots: Joi.string().required(),
  media: Joi.any(),
});

const updateMonographSchema = Joi.object({
  fileSlots: optionalString(),
  media: Joi.any(),
}).min(1);

const signMonographSchema = Joi.object({
  eriKey: Joi.string().trim().max(100).allow("").optional(),
  eriSignature: optionalString(),
  eriData: optionalString(),
});

const rejectMonographSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000).required(),
});

const ssvDecisionSchema = Joi.object({
  decision: Joi.string().valid("approve", "reject").required(),
  reason: Joi.string().trim().min(3).max(2000).when("decision", {
    is: "reject",
    then: Joi.required(),
    otherwise: Joi.optional().allow(""),
  }),
  file: Joi.any(),
});

const fillDataSchema = Joi.object({
  title: Joi.string().trim().min(3).max(500).required(),
  ssvNumber: Joi.string().trim().min(1).max(100).required(),
  ssvDate: Joi.string().trim().min(1).max(50).required(),
  isbn: Joi.string().trim().min(3).max(100).required(),
  publisher: Joi.string().trim().min(2).max(300).required(),
  file: Joi.any(),
});

const monographQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid(...MONOGRAPH_STATUSES)),
  faculty: optionalString(objectId),
  department: optionalString(objectId),
  author: optionalString(objectId),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const monographPaginateSchema = monographQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  MONOGRAPH_STATUSES,
  createMonographSchema,
  updateMonographSchema,
  signMonographSchema,
  rejectMonographSchema,
  ssvDecisionSchema,
  fillDataSchema,
  monographQuerySchema,
  monographPaginateSchema,
};
