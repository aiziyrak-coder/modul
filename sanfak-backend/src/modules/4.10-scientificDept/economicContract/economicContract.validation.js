const Joi = require("joi");
const { optionalObjectId, optionalString } = require("#validators/common");

const CONTRACT_STATUSES = ["new", "approved", "rejected"];
const objectId = Joi.string().hex().length(24);

const createContractSchema = Joi.object({
  teacher: optionalObjectId(objectId),
  title: Joi.string().trim().min(2).max(500).required(),
  partnerOrganization: Joi.string().trim().min(2).max(500).required(),
  contractDate: Joi.date().required(),
  amount: Joi.number().min(0).required(),
  currentYearAmount: Joi.number().min(0).optional(),
  academicYear: optionalObjectId(objectId),
  fileSlots: Joi.string().optional(),
  media: Joi.any(),
});

const updateContractSchema = Joi.object({
  teacher: optionalObjectId(objectId),
  title: Joi.string().trim().min(2).max(500),
  partnerOrganization: Joi.string().trim().min(2).max(500),
  contractDate: Joi.date(),
  amount: Joi.number().min(0),
  currentYearAmount: Joi.number().min(0),
  academicYear: optionalObjectId(objectId),
  fileSlots: Joi.string(),
  media: Joi.any(),
}).min(1);

const rejectContractSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000).required(),
});

const contractQuerySchema = Joi.object({
  search: Joi.string().allow("").optional(),
  status: optionalString(Joi.string().valid(...CONTRACT_STATUSES)),
  academicYear: optionalString(),
  department: optionalString(Joi.string().hex().length(24)),
  dateFrom: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
  dateTo: optionalString(Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)),
});

const contractPaginateSchema = contractQuerySchema.keys({
  page: Joi.number().integer().min(1).required(),
  limit: Joi.number().integer().min(1).max(200).required(),
});

module.exports = {
  CONTRACT_STATUSES,
  createContractSchema,
  updateContractSchema,
  rejectContractSchema,
  contractQuerySchema,
  contractPaginateSchema,
};
