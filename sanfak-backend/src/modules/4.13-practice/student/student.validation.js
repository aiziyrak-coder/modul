const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ObjectId bo'lishi kerak");

const createSchema = Joi.object({
  fish: Joi.string().min(1).required(),
  academicYear: objectId.required(),
  direction: objectId.required(),
  course: Joi.number().integer().min(1).required(),
  group: Joi.string().min(1).required(),
  region: objectId.required(),
  district: objectId.required(),
  active: Joi.boolean().optional(),
});

const updateSchema = Joi.object({
  fish: Joi.string().min(1).optional(),
  academicYear: objectId.optional(),
  direction: objectId.optional(),
  course: Joi.number().integer().min(1).optional(),
  group: Joi.string().min(1).optional(),
  region: objectId.optional(),
  district: objectId.optional(),
  active: Joi.boolean().optional(),
});

const bulkCourseTransferSchema = Joi.object({
  studentIds: Joi.array().items(objectId).min(1).required(),
  toCourse: Joi.number().integer().min(1).required(),
});

const findAll = Joi.object({
  search: optionalString(),
  active: Joi.boolean().optional(),
  academicYear: optionalObjectId(objectId),
  direction: optionalObjectId(objectId),
  course: Joi.number().integer().optional(),
  region: optionalObjectId(objectId),
  district: optionalObjectId(objectId),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: optionalString(),
  active: Joi.boolean().optional(),
  academicYear: optionalObjectId(objectId),
  direction: optionalObjectId(objectId),
  course: Joi.number().integer().optional(),
  region: optionalObjectId(objectId),
  district: optionalObjectId(objectId),
});

const readSchema = Joi.object({
  id: Joi.string().required(),
});

const deleteSchema = Joi.object({
  id: Joi.string().required(),
});

module.exports = {
  createSchema,
  updateSchema,
  bulkCourseTransferSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
