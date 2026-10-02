const Joi = require("joi");
const { optionalString, optionalObjectId } = require("#validators/common");

const objectId = Joi.string()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .message("ObjectId bo'lishi kerak");

const stir = Joi.string()
  .pattern(/^\d{9}$/)
  .message("STIR 9 xonali raqamdan iborat bo'lishi kerak");

const jshshir = Joi.string()
  .pattern(/^\d{14}$/)
  .message("JSHSHIR 14 xonali raqamdan iborat bo'lishi kerak");

const organizationSchema = Joi.object({
  title: Joi.string().min(1).required(),
  orgType: objectId.required(),
  stir: stir.required(),
  region: objectId.required(),
  district: objectId.required(),
  address: Joi.string().min(1).required(),
  headName: Joi.string().min(1).required(),
  headJshshir: jshshir.required(),
  headPhone: Joi.string().min(1).required(),
  email: Joi.string().email().allow("", null).optional(),
  capacity: Joi.number().min(0).allow(null).optional(),
  active: Joi.boolean().optional(),
  responsibleUsers: Joi.array().items(objectId).optional(),
});

const updateSchema = Joi.object({
  title: Joi.string().min(1).optional(),
  orgType: objectId.optional(),
  stir: stir.optional(),
  region: objectId.optional(),
  district: objectId.optional(),
  address: Joi.string().min(1).optional(),
  headName: Joi.string().min(1).optional(),
  headJshshir: jshshir.optional(),
  headPhone: Joi.string().min(1).optional(),
  email: Joi.string().email().allow("", null).optional(),
  capacity: Joi.number().min(0).allow(null).optional(),
  active: Joi.boolean().optional(),
  responsibleUsers: Joi.array().items(objectId).optional(),
});

const findAll = Joi.object({
  search: optionalString(),
  active: Joi.boolean().optional(),
  orgType: optionalObjectId(objectId),
  region: optionalObjectId(objectId),
  district: optionalObjectId(objectId),
});

const paginate = Joi.object({
  limit: Joi.number().integer().required(),
  page: Joi.number().integer().required(),
  search: optionalString(),
  active: Joi.boolean().optional(),
  orgType: optionalObjectId(objectId),
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
  organizationSchema,
  updateSchema,
  findAll,
  paginate,
  readSchema,
  deleteSchema,
};
