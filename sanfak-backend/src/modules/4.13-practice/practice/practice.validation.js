const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ObjectId bo'lishi kerak");

const contractSchema = Joi.object({
  organization: objectId.required(),
  direction: objectId.required(),
  academicYear: objectId.required(),
  course: Joi.number().integer().min(1).optional(),
  group: Joi.string().allow("", null).optional(),
  students: Joi.array().items(objectId).min(1).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).required(),
  note: Joi.string().allow("", null).optional(),
});

const updateSchema = Joi.object({
  organization: objectId.optional(),
  direction: objectId.optional(),
  academicYear: objectId.optional(),
  course: Joi.number().integer().min(1).optional(),
  group: Joi.string().allow("", null).optional(),
  students: Joi.array().items(objectId).min(1).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  note: Joi.string().allow("", null).optional(),
});

const signSchema = Joi.object({
  eriSignature: Joi.string().allow("", null).optional(),
  eriData: Joi.string().allow("", null).optional(),
  certSerial: Joi.string().allow("", null).optional(),
  certSubject: Joi.string().allow("", null).optional(),
});

const rejectSchema = Joi.object({
  reason: Joi.string().min(1).required(),
  rejectedBy: optionalString(Joi.string().valid("rektor", "org_head")),
});

const statusFilter = Joi.alternatives().try(
  Joi.array().items(Joi.string()).min(1),
  Joi.string(),
);

const findAll = Joi.object({
  search: optionalString(),
  active: Joi.boolean().optional(),
  status: statusFilter.optional(),
  academicYear: optionalObjectId(objectId),
  direction: optionalObjectId(objectId),
  organization: optionalObjectId(objectId),
  course: Joi.number().integer().min(1).optional(),
  group: optionalString(),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: optionalString(),
  active: Joi.boolean().optional(),
  status: statusFilter.optional(),
  academicYear: optionalObjectId(objectId),
  direction: optionalObjectId(objectId),
  organization: optionalObjectId(objectId),
  course: Joi.number().integer().min(1).optional(),
  group: optionalString(),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  contractSchema,
  updateSchema,
  signSchema,
  rejectSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
