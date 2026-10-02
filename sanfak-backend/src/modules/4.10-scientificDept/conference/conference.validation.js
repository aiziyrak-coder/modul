const Joi = require("joi");
const { optionalString } = require("#validators/common");

const CONFERENCE_TYPES = ["national", "international"];

const requiredDocItem = Joi.object({
  label: Joi.string().trim().min(1).max(500).required(),
  fileType: Joi.string().valid("pdf", "word", "excel", "image").required(),
});

const createConferenceSchema = Joi.object({
  title: Joi.string().trim().min(2).max(500).required(),
  type: Joi.string()
    .valid(...CONFERENCE_TYPES)
    .optional(),
  description: Joi.string().trim().allow("").max(2000).optional(),
  deadline: Joi.date().required(),
  beforeDeadline: Joi.date().optional(),
  afterDeadline: Joi.date().optional(),
  requiredInfo: Joi.array().items(Joi.string().trim().max(500)).optional(),
  requiredDocs: Joi.array().items(requiredDocItem).optional(),
  kafedras: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
});

const updateConferenceSchema = Joi.object({
  title: Joi.string().trim().min(2).max(500),
  type: Joi.string().valid(...CONFERENCE_TYPES),
  description: Joi.string().trim().allow("").max(2000),
  deadline: Joi.date(),
  beforeDeadline: Joi.date(),
  afterDeadline: Joi.date(),
  requiredInfo: Joi.array().items(Joi.string().trim().max(500)),
  requiredDocs: Joi.array().items(requiredDocItem),
  kafedras: Joi.array().items(Joi.string().hex().length(24)).min(1),
  status: Joi.string().valid("active", "closed"),
}).min(1);

const acceptConferenceSchema = Joi.object({
  fileSlots: Joi.string().required(),
  media: Joi.any(),
});

const conferenceQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  type: optionalString(Joi.string().valid(...CONFERENCE_TYPES)),
  status: optionalString(Joi.string().valid("active", "closed")),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const conferencePaginateSchema = conferenceQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  CONFERENCE_TYPES,
  createConferenceSchema,
  updateConferenceSchema,
  acceptConferenceSchema,
  conferenceQuerySchema,
  conferencePaginateSchema,
};
