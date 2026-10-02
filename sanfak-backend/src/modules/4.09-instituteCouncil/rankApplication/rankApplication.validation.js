const Joi = require("joi");
const { optionalString, optionalObjectId, optionalEnum } = require("#validators/common");

const CATEGORY = ["rank", "position"];
const STATUS = ["new", "accepted", "returned"];

const submittedDocSchema = Joi.object({
  name: Joi.string().allow("", null).optional(),
  fileUrl: Joi.string().allow("", null).optional(),
});

const officialDocsSchema = Joi.object({
  organizationLetter: Joi.string().required(),
  guaranteeLetter: Joi.string().required(),
  councilApproval: Joi.string().required(),
});

const flexDocs = Joi.alternatives()
  .try(Joi.array().items(submittedDocSchema), Joi.string())
  .optional();

const createSchema = Joi.object({
  rankType: Joi.string().trim().required(),
  category: optionalEnum(Joi.string().valid(...CATEGORY)),
  department: optionalObjectId(),
  submittedDocs: flexDocs,
  docNames: Joi.any().optional(),
  media: Joi.any().optional(),
});

const updateSchema = Joi.object({
  rankType: Joi.string().trim().optional(),
  category: optionalEnum(Joi.string().valid(...CATEGORY)),
  department: optionalObjectId(),
  submittedDocs: flexDocs,
  docNames: Joi.any().optional(),
  media: Joi.any().optional(),
});

const acceptSchema = Joi.object({
  officialDocs: officialDocsSchema.optional(),
  organizationLetter: optionalString(),
  guaranteeLetter: optionalString(),
  councilApproval: optionalString(),
  docKeys: Joi.any().optional(),
  media: Joi.any().optional(),
});

const diplomaSchema = Joi.object({
  fileUrl: Joi.string().trim().allow("").optional(),
  date: Joi.date().optional(),
  media: Joi.any().optional(),
});

const returnSchema = Joi.object({
  reason: Joi.string().required(),
});

const statusFilter = Joi.alternatives().try(
  Joi.array().items(Joi.string().valid(...STATUS)).min(1),
  Joi.string().allow("", null),
);

const findSchema = Joi.object({
  search: optionalString(),
  tab: optionalString(Joi.string().valid("documents", "accepted", "archive")),
  status: statusFilter.optional(),
  rankType: optionalString(Joi.string().trim()),
  category: optionalEnum(Joi.string().valid(...CATEGORY)),
  hasDiploma: optionalEnum(Joi.boolean()),
  department: optionalObjectId(),
  applicant: optionalObjectId(),
});

const paginateSchema = findSchema.keys({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
});

module.exports = {
  createSchema,
  updateSchema,
  acceptSchema,
  diplomaSchema,
  returnSchema,
  findSchema,
  paginateSchema,
};
